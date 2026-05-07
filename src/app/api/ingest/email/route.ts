import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isValidApiKeyFormat } from "@/lib/utils/api-key";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { normalizeEmail } from "@/lib/utils/email";
import { IngestPayloadSchema } from "@/lib/extraction/schema";
import { extractRecruitData } from "@/lib/extraction/extract";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";
import { findFirstPdfAttachment, analyzeTranscript } from "@/lib/transcript";
import { findAndParseEmlAttachments, looksLikeEml, type ParsedEmail } from "@/lib/email/parse-eml";
import { buildUpdateData } from "@/lib/recruits/update-data";
import { checkAndQueueDuplicateReview } from "@/lib/recruits/duplicate-review";
import { maybeQueueMissingFieldsRequest } from "@/lib/recruits/missing-fields-queue";
import type { Recruit, ProgramConfig, TranscriptAnalysis } from "@/types/database";

export const maxDuration = 300;

/** Detect inline-forwarded email by checking for common forward markers */
function isForwardedEmail(body: string): boolean {
  return /---------- Forwarded message -+/.test(body) ||
    /^Begin forwarded message:/m.test(body) ||
    /^----- Original Message -----/m.test(body);
}

/**
 * Extract the original email's sent date from a forwarded message body.
 * Returns an ISO string if found, null otherwise.
 * Handles Gmail, Apple Mail, Outlook, and inline-quote formats.
 */
function parseForwardedEmailDate(body: string): string | null {
  // Gmail/Apple Mail forwarding header: "Date: Mon, 14 Apr 2024 at 10:30 AM"
  // Outlook forwarding header: "Sent: Monday, April 14, 2024 10:30 AM"
  const headerMatch = body.match(/^(?:Date|Sent):\s*(.+)$/m);
  if (headerMatch) {
    // Normalize "at" separator used by Gmail ("Apr 14, 2024 at 10:30 AM" → "Apr 14, 2024 10:30 AM")
    const normalized = headerMatch[1].trim().replace(/\s+at\s+/, " ");
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Inline quote: "On Mon, Apr 14, 2024 at 10:30 AM, John Smith <...> wrote:"
  // Capture everything between "On " and the first ", [Name]" or "<email>" segment
  const inlineMatch = body.match(/^On\s+(.+?)\s+wrote:/m);
  if (inlineMatch) {
    // Strip trailing sender info after a comma-space followed by a name/email
    const candidate = inlineMatch[1]
      .replace(/,\s*[^,]+<[^>]+>.*$/, "")  // strip ", Name <email>"
      .replace(/,\s*<[^>]+>.*$/, "")        // strip ", <email>"
      .replace(/\s+at\s+/, " ")
      .trim();
    const d = new Date(candidate);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

/** Normalize attachments into an array (Zapier may send a string, object, or array) */
function normalizeAttachments(attachments: unknown): unknown[] {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  return [attachments];
}

interface ResolvedCoach {
  id: string;
  status: string;
  email: string;
  program_id: string;
  isIntakeForward: boolean;
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  // --- Parse payload first (needed for intake auth) ---
  let payload;
  let body;
  try {
    body = await request.json();
    console.log("[ingest] Raw payload keys:", Object.keys(body));
    console.log("[ingest] Attachments field:", JSON.stringify(body.attachments)?.substring(0, 500));
    payload = IngestPayloadSchema.parse(body);
  } catch (err) {
    console.error("[ingest] Payload validation failed:", err);
    return NextResponse.json(
      { error: "Invalid payload", details: String(err) },
      { status: 422 }
    );
  }

  // --- Dual-auth: per-coach API key OR shared intake secret ---
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key" },
      { status: 401 }
    );
  }

  let coach: ResolvedCoach;

  if (isValidApiKeyFormat(apiKey)) {
    // Legacy path: per-coach API key
    const hashedKey = hashApiKey(apiKey);
    const { data, error } = await supabase
      .from("coaches")
      .select("id, status, email, program_id")
      .eq("api_key", hashedKey)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    coach = { ...data, isIntakeForward: false };
  } else if (apiKey === process.env.INTAKE_WEBHOOK_SECRET) {
    // Intake path: shared secret + coach identified by sender_email
    const senderEmail = normalizeEmail(payload.sender_email);
    if (!senderEmail) {
      return NextResponse.json(
        { error: "Intake mode requires sender_email" },
        { status: 422 }
      );
    }

    const { data, error } = await supabase
      .from("coaches")
      .select("id, status, email, program_id")
      .eq("email", senderEmail)
      .single();

    if (error || !data) {
      console.warn(`[ingest] No coach found for intake sender: ${senderEmail}`);
      return NextResponse.json(
        { error: "No coach account found for this email address" },
        { status: 403 }
      );
    }

    coach = { ...data, isIntakeForward: true };
  } else {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (coach.status !== "approved") {
    return NextResponse.json(
      { error: "Coach account not approved" },
      { status: 403 }
    );
  }

  if (!coach.program_id) {
    return NextResponse.json(
      { error: "Coach is not assigned to a program" },
      { status: 403 }
    );
  }

  // --- Check for Mode B: .eml attachments (bulk forward) ---
  const normalizedAttachments = normalizeAttachments(payload.attachments);
  const hasEmlFiles = normalizedAttachments.some(looksLikeEml);

  if (coach.isIntakeForward && hasEmlFiles) {
    // Mode B: parse each .eml and process separately
    return handleBulkForward(supabase, coach, payload, normalizedAttachments);
  }

  // --- Rate limit (single email) ---
  const rateResult = checkRateLimit(coach.id);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        remaining: rateResult.remaining,
        reset_at: new Date(rateResult.resetAt).toISOString(),
      },
      { status: 429 }
    );
  }

  // --- Mode A (inline forward) or legacy: store and process single email ---
  const isForwarded = coach.isIntakeForward && isForwardedEmail(payload.body_plain);

  if (coach.isIntakeForward && !isForwarded) {
    console.warn(
      `[ingest] isIntakeForward=true but no forwarding marker detected in body (email_id pending, coach=${coach.id}). ` +
      "Unrecognized mail client? Recruit email fallback and dedup will use sender_email (coach's address)."
    );
  }

  // For forwarded emails, Zapier captures the forward date (today), not the original email date.
  // Override with the date parsed from the forwarding headers in the email body.
  const receivedAt = isForwarded
    ? (parseForwardedEmailDate(payload.body_plain) ?? payload.received_at)
    : payload.received_at;

  const { data: emailRecord, error: emailError } = await supabase
    .from("ingested_emails")
    .insert({
      coach_id: coach.id,
      program_id: coach.program_id,
      sender_email: payload.sender_email,
      sender_name: payload.sender_name,
      subject: payload.subject,
      body_plain: payload.body_plain,
      body_html: payload.body_html,
      received_at: receivedAt,
      attachments: normalizedAttachments,
      processing_status: "pending",
    })
    .select()
    .single();

  if (emailError || !emailRecord) {
    return NextResponse.json(
      { error: "Failed to store email", details: emailError?.message },
      { status: 500 }
    );
  }

  after(() => processEmail(emailRecord.id, coach.id, coach.email, coach.program_id, payload, normalizedAttachments, isForwarded).catch((err) => console.error("[processEmail] unhandled:", err)));

  return NextResponse.json({ success: true, queued: true }, { status: 202 });
}

/**
 * Mode B: Handle bulk-forwarded emails with .eml attachments.
 * Parses each .eml, creates a separate ingested_emails record, and processes independently.
 */
async function handleBulkForward(
  supabase: ReturnType<typeof createAdminClient>,
  coach: ResolvedCoach,
  originalPayload: z.infer<typeof IngestPayloadSchema>,
  attachments: unknown[]
) {
  let parsedEmails: ParsedEmail[];
  try {
    parsedEmails = await findAndParseEmlAttachments(attachments);
  } catch (err) {
    console.error("[ingest] Failed to parse .eml attachments:", err);
    return NextResponse.json(
      { error: "Failed to parse .eml attachments", details: String(err) },
      { status: 422 }
    );
  }

  if (parsedEmails.length === 0) {
    return NextResponse.json(
      { error: "No valid .eml attachments found" },
      { status: 422 }
    );
  }

  const MAX_EML_ATTACHMENTS = 50;
  if (parsedEmails.length > MAX_EML_ATTACHMENTS) {
    return NextResponse.json(
      {
        error: `Bulk request exceeds the maximum of ${MAX_EML_ATTACHMENTS} .eml attachments`,
        count: parsedEmails.length,
      },
      { status: 422 }
    );
  }

  // Rate limit: check if we have enough headroom for all emails in this batch
  const rateResult = checkRateLimit(coach.id);
  if (!rateResult.allowed || rateResult.remaining < parsedEmails.length) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        remaining: rateResult.remaining,
        reset_at: new Date(rateResult.resetAt).toISOString(),
      },
      { status: 429 }
    );
  }

  // Create an ingested_emails record for each parsed .eml and queue processing
  const queuedIds: string[] = [];

  for (const parsed of parsedEmails) {
    // Convert nested .eml attachments to the format our pipeline expects
    const emlAttachments = parsed.attachments.map((att) => ({
      url: `data:${att.contentType};base64,${att.content}`,
      filename: att.filename,
      content_type: att.contentType,
    }));

    const { data: emailRecord, error: emailError } = await supabase
      .from("ingested_emails")
      .insert({
        coach_id: coach.id,
        program_id: coach.program_id,
        sender_email: parsed.senderEmail,
        sender_name: parsed.senderName,
        subject: parsed.subject,
        body_plain: parsed.bodyPlain,
        body_html: parsed.bodyHtml,
        received_at: parsed.receivedAt,
        attachments: emlAttachments,
        processing_status: "pending",
      })
      .select()
      .single();

    if (emailError || !emailRecord) {
      console.error("[ingest] Failed to store parsed .eml:", emailError?.message);
      continue;
    }

    // Build a synthetic payload from the parsed .eml data
    const syntheticPayload: z.infer<typeof IngestPayloadSchema> = {
      sender_email: parsed.senderEmail ?? undefined,
      sender_name: parsed.senderName ?? undefined,
      subject: parsed.subject ?? undefined,
      body_plain: parsed.bodyPlain,
      body_html: parsed.bodyHtml ?? undefined,
      received_at: parsed.receivedAt ?? undefined,
      attachments: emlAttachments,
    };

    // .eml bodies are already the original recruit email — no forwarding inversion needed
    after(() => processEmail(emailRecord.id, coach.id, coach.email, coach.program_id, syntheticPayload, emlAttachments, false).catch((err) => console.error("[processEmail] unhandled:", err)));

    queuedIds.push(emailRecord.id);
  }

  return NextResponse.json(
    { success: true, queued: queuedIds.length, email_ids: queuedIds },
    { status: 202 }
  );
}

async function processEmail(
  emailId: string,
  coachId: string,
  coachEmailRaw: string,
  programId: string,
  payload: z.infer<typeof IngestPayloadSchema>,
  attachments: unknown[],
  isForwarded: boolean
) {
  const supabase = createAdminClient();

  try {
    const { error: statusError } = await supabase
      .from("ingested_emails")
      .update({ processing_status: "processing" })
      .eq("id", emailId);
    if (statusError) throw new Error(`Failed to update status to processing: ${statusError.message}`);

    const extraction = await extractRecruitData(
      payload.subject,
      payload.sender_name,
      payload.sender_email,
      payload.body_plain,
      isForwarded
    );

    // Normalize emails for dedup comparison
    const extractedEmail = normalizeEmail(extraction.recruitData.email as string);
    const senderEmail = normalizeEmail(payload.sender_email);

    // Store the normalized email in recruitData
    // For forwarded emails, senderEmail is the coach — don't use as recruit email fallback
    if (isForwarded) {
      extraction.recruitData.email = extractedEmail ?? null;
    } else {
      extraction.recruitData.email = extractedEmail ?? senderEmail;
    }

    let recruitId: string;
    let existing: Record<string, unknown> | null = null;

    // Two-pass dedup: check extracted email first, then sender_email
    if (extractedEmail) {
      const { data } = await supabase
        .from("recruits")
        .select("*")
        .eq("program_id", programId)
        .eq("email", extractedEmail)
        .single();
      existing = data;
    }

    // For forwarded emails, skip sender-based dedup (sender is the coach)
    if (!existing && !isForwarded && senderEmail && senderEmail !== extractedEmail) {
      const { data } = await supabase
        .from("recruits")
        .select("*")
        .eq("program_id", programId)
        .eq("email", senderEmail)
        .single();
      existing = data;

      if (data) {
        extraction.recruitData.email = senderEmail;
      }
    }

    // Guard: if sender is the coach themselves (outbound email processed by
    // Zapier due to thread-level labeling), skip creation of a new recruit.
    // For intake forwards, the sender IS the coach by definition — skip this guard.
    const coachEmail = normalizeEmail(coachEmailRaw);
    const senderIsCoach = !isForwarded && coachEmail && senderEmail === coachEmail;

    if (existing) {
      // Update existing recruit (only overwrite if new confidence >= existing)
      const prevNameKey = (existing.name_key as string | null) ?? null;
      const updateData = buildUpdateData(
        existing,
        extraction.recruitData,
        extraction.confidence
      );

      const { data: updatedRecruit, error: updateError } = await supabase
        .from("recruits")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError) throw new Error(`Failed to update recruit: ${updateError.message}`);

      recruitId = existing.id as string;
      if (!updatedRecruit) {
        console.warn(`[processEmail] Update returned no data for recruit ${recruitId} — proceeding with ID only`);
      }

      // Use the persisted name_key from the updated row rather than recomputing
      // from extraction.recruitData — buildUpdateData() may have rejected the
      // extracted full_name due to low confidence, so the DB trigger's value is
      // the authoritative key.
      const newNameKey = (updatedRecruit?.name_key as string | null) ?? null;
      // Always fire when there's a name key: handles both name-change (re-queue
      // pending group) and name-unchanged (re-surface a dismissed group if the
      // email touch is the promised re-prompt trigger).
      if (newNameKey) {
        checkAndQueueDuplicateReview(supabase, programId, recruitId, prevNameKey, newNameKey, "ingest").catch((err) =>
          console.error("[ingest] duplicate-review queue failed:", err)
        );
      }
    } else if (senderIsCoach) {
      // Coach's own outbound email — don't create a duplicate recruit
      await supabase
        .from("ingested_emails")
        .update({
          processing_status: "failed",
          extraction_error: "Skipped: sender is the coach (outbound email)",
        })
        .eq("id", emailId);
      return;
    } else {
      // Create new recruit
      const { data: newRecruit, error: recruitError } = await supabase
        .from("recruits")
        .insert({
          coach_id: coachId,
          program_id: programId,
          ...extraction.recruitData,
        })
        .select()
        .single();

      if (recruitError || !newRecruit) {
        throw new Error(
          `Failed to create recruit: ${recruitError?.message}`
        );
      }
      recruitId = newRecruit.id;

      // Use the DB-persisted name_key — the trigger applies unaccent() which
      // diverges from the TS helper for chars like ł, ß, ı.
      const newNameKey = (newRecruit.name_key as string | null) ?? null;
      if (newNameKey) {
        checkAndQueueDuplicateReview(supabase, programId, recruitId, null, newNameKey, "ingest")
          .then((groupCreated) => {
            if (!groupCreated) {
              return maybeQueueMissingFieldsRequest(supabase, recruitId, programId, coachId);
            }
          })
          .catch((err) => console.error("[ingest] post-create queue failed:", err));
      } else {
        maybeQueueMissingFieldsRequest(supabase, recruitId, programId, coachId)
          .catch((err) => console.error("[ingest] missing-fields queue failed:", err));
      }
    }

    // Transcript analysis (non-blocking)
    let transcriptAnalysis: TranscriptAnalysis | null = null;
    if (attachments.length > 0) {
      try {
        const pdfAttachment = await findFirstPdfAttachment(attachments);
        if (pdfAttachment) {
          const analysis = await analyzeTranscript(pdfAttachment.base64);
          if (analysis) {
            const { data: transcriptRow } = await supabase
              .from("transcript_analyses")
              .upsert(
                {
                  recruit_id: recruitId,
                  coach_id: coachId,
                  email_id: emailId,
                  rigor_grade: analysis.rigorGrade,
                  rigor_score: analysis.result.rigor_score,
                  confidence: analysis.result.confidence,
                  transcript_readable: analysis.result.transcript_readable,
                  honors_ap_ib_count: analysis.result.course_analysis.honors_ap_ib_count,
                  total_academic_courses: analysis.result.course_analysis.total_academic_courses,
                  rigor_ratio: analysis.result.course_analysis.rigor_ratio,
                  strongest_subjects: analysis.result.course_analysis.strongest_subjects,
                  weakest_subjects: analysis.result.course_analysis.weakest_subjects,
                  notable_courses: analysis.result.course_analysis.notable_courses,
                  grade_trend: analysis.result.grade_trends.direction,
                  freshman_gpa_estimate: analysis.result.grade_trends.freshman_gpa_estimate,
                  senior_gpa_estimate: analysis.result.grade_trends.senior_gpa_estimate,
                  grade_trend_notes: analysis.result.grade_trends.notes,
                  red_flags: analysis.result.red_flags,
                  strengths: analysis.result.strengths,
                  schedule_assessment: analysis.result.schedule_assessment,
                  cumulative_gpa_from_transcript: analysis.result.cumulative_gpa_from_transcript,
                  raw_analysis: analysis.result as unknown as Record<string, unknown>,
                },
                { onConflict: "recruit_id" }
              )
              .select()
              .single();

            transcriptAnalysis = transcriptRow as TranscriptAnalysis | null;
          }
        }
      } catch (err) {
        console.warn("[transcript] Non-blocking analysis error:", err);
      }
    }

    // Calculate DQS score
    const { data: config } = await supabase
      .from("program_config")
      .select("*")
      .eq("program_id", programId)
      .single();

    // If no transcript analysis from this email, check for existing one
    if (!transcriptAnalysis) {
      const { data: existingAnalysis } = await supabase
        .from("transcript_analyses")
        .select("*")
        .eq("recruit_id", recruitId)
        .single();
      transcriptAnalysis = existingAnalysis as TranscriptAnalysis | null;
    }

    if (!config) {
      console.warn(`[processEmail] No program_config found for program ${programId} — scoring skipped for recruit ${recruitId}`);
    } else {
      const { data: recruit } = await supabase
        .from("recruits")
        .select("*")
        .eq("id", recruitId)
        .single();

      if (recruit) {
        const dqsResult = calculateDQS(
          recruit as Recruit,
          config as ProgramConfig,
          transcriptAnalysis
        );

        const aiSummary = await generateDQSSummary(
          recruit as Recruit,
          config as ProgramConfig,
          dqsResult
        );

        const { error: upsertError } = await supabase.from("recruit_dqs_scores").upsert(
          {
            recruit_id: recruitId,
            coach_id: coachId,
            program_id: programId,
            overall_score: dqsResult.score,
            is_qualified: dqsResult.isQualified,
            disqualification_reasons: dqsResult.disqualificationReasons,
            academic_score: dqsResult.componentScores.academic,
            competition_score: dqsResult.componentScores.competition,
            physical_score: dqsResult.componentScores.physical,
            position_fit_score: dqsResult.componentScores.positionFit,
            grad_year_score: dqsResult.componentScores.gradYear,
            completeness_score: dqsResult.componentScores.completeness,
            bonus_points: dqsResult.bonusPoints,
            completeness_penalty: dqsResult.completenessPenalty,
            score_breakdown: dqsResult.breakdown,
            ai_summary: aiSummary,
            calculated_at: new Date().toISOString(),
          },
          { onConflict: "recruit_id" }
        );
        if (upsertError) {
          console.error(`[processEmail] DQS upsert failed for recruit ${recruitId}:`, upsertError.message);
        }
      } else {
        console.error(`[processEmail] Could not fetch recruit ${recruitId} for DQS calculation`);
      }
    }

    // Update email record with results
    const recruitEmail = extraction.recruitData.email as string | null;
    const recruitName = extraction.recruitData.full_name as string | null;
    const { error: finalUpdateError } = await supabase
      .from("ingested_emails")
      .update({
        recruit_id: recruitId,
        processing_status: extraction.processingStatus,
        extracted_data: extraction.extractedData as unknown as Record<string, unknown>,
        // Overwrite sender fields with recruit's info (forwarded email sender is the coach)
        ...(isForwarded && recruitEmail ? { sender_email: recruitEmail, sender_name: recruitName } : {}),
      })
      .eq("id", emailId);
    if (finalUpdateError) throw new Error(`Failed to update final email status: ${finalUpdateError.message}`);
  } catch (err) {
    // Update email record with failure
    const { error: failureUpdateError } = await supabase
      .from("ingested_emails")
      .update({
        processing_status: "failed",
        extraction_error: String(err),
      })
      .eq("id", emailId);
    if (failureUpdateError) {
      console.error("[processEmail] Failed to update email status to failed:", failureUpdateError.message);
    }
  }
}

