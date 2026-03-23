import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isValidApiKeyFormat } from "@/lib/utils/api-key";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { IngestPayloadSchema } from "@/lib/extraction/schema";
import { extractRecruitData } from "@/lib/extraction/extract";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";
import type { Recruit, ProgramConfig, ConfidenceLevel } from "@/types/database";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  // Step 1: Authenticate via API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || !isValidApiKeyFormat(apiKey)) {
    return NextResponse.json(
      { error: "Missing or invalid API key" },
      { status: 401 }
    );
  }

  const hashedKey = hashApiKey(apiKey);
  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, status, email")
    .eq("api_key", hashedKey)
    .single();

  if (coachError || !coach) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (coach.status !== "approved") {
    return NextResponse.json(
      { error: "Coach account not approved" },
      { status: 403 }
    );
  }

  // Step 2: Rate limiting
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

  // Step 3: Validate payload
  let payload;
  try {
    const body = await request.json();
    payload = IngestPayloadSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid payload", details: String(err) },
      { status: 422 }
    );
  }

  // Step 4: Create ingested_emails record
  const { data: emailRecord, error: emailError } = await supabase
    .from("ingested_emails")
    .insert({
      coach_id: coach.id,
      sender_email: payload.sender_email,
      sender_name: payload.sender_name,
      subject: payload.subject,
      body_plain: payload.body_plain,
      body_html: payload.body_html,
      received_at: payload.received_at,
      attachments: payload.attachments ?? [],
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

  // Step 5: Queue background processing and return immediately
  after(() => processEmail(emailRecord.id, coach.id, coach.email as string, payload).catch((err) => console.error("[processEmail] unhandled:", err)));

  return NextResponse.json({ success: true, queued: true }, { status: 202 });
}

async function processEmail(
  emailId: string,
  coachId: string,
  coachEmailRaw: string,
  payload: z.infer<typeof IngestPayloadSchema>
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
      payload.body_plain
    );

    // Normalize emails for dedup comparison
    const extractedEmail =
      ((extraction.recruitData.email as string) || null)
        ?.toLowerCase()
        .trim() ?? null;
    const senderEmail =
      (payload.sender_email || null)?.toLowerCase().trim() ?? null;

    // Store the normalized email in recruitData
    extraction.recruitData.email = extractedEmail ?? senderEmail;

    let recruitId: string;
    let existing: Record<string, unknown> | null = null;

    // Two-pass dedup: check extracted email first, then sender_email
    if (extractedEmail) {
      const { data } = await supabase
        .from("recruits")
        .select("*")
        .eq("coach_id", coachId)
        .eq("email", extractedEmail)
        .single();
      existing = data;
    }

    if (!existing && senderEmail && senderEmail !== extractedEmail) {
      const { data } = await supabase
        .from("recruits")
        .select("*")
        .eq("coach_id", coachId)
        .eq("email", senderEmail)
        .single();
      existing = data;

      if (data) {
        // Matched via sender_email — the extracted email was wrong.
        // Override recruitData.email to prevent buildUpdateData from
        // overwriting the recruit's correct email with the bad extraction.
        extraction.recruitData.email = senderEmail;
      }
    }

    // Guard: if sender is the coach themselves (outbound email processed by
    // Zapier due to thread-level labeling), skip creation of a new recruit.
    // Updates to existing recruits are still allowed (via extracted email match).
    const coachEmail = coachEmailRaw?.toLowerCase().trim() ?? null;
    const senderIsCoach = coachEmail && senderEmail === coachEmail;

    if (existing) {
      // Update existing recruit (only overwrite if new confidence >= existing)
      const updateData = buildUpdateData(
        existing,
        extraction.recruitData,
        extraction.confidence
      );

      await supabase
        .from("recruits")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();

      recruitId = existing.id as string;
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
    }

    // Calculate DQS score
    const { data: config } = await supabase
      .from("program_config")
      .select("*")
      .eq("coach_id", coachId)
      .single();

    if (config) {
      const { data: recruit } = await supabase
        .from("recruits")
        .select("*")
        .eq("id", recruitId)
        .single();

      if (recruit) {
        const dqsResult = calculateDQS(
          recruit as Recruit,
          config as ProgramConfig
        );

        const aiSummary = await generateDQSSummary(
          recruit as Recruit,
          config as ProgramConfig,
          dqsResult
        );

        await supabase.from("recruit_dqs_scores").upsert(
          {
            recruit_id: recruitId,
            coach_id: coachId,
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
      }
    }

    // Update email record with results
    const { error: finalUpdateError } = await supabase
      .from("ingested_emails")
      .update({
        recruit_id: recruitId,
        processing_status: extraction.processingStatus,
        extracted_data: extraction.extractedData as unknown as Record<string, unknown>,
      })
      .eq("id", emailId);
    if (finalUpdateError) throw new Error(`Failed to update final email status: ${finalUpdateError.message}`);
  } catch (err) {
    // Update email record with failure
    await supabase
      .from("ingested_emails")
      .update({
        processing_status: "failed",
        extraction_error: String(err),
      })
      .eq("id", emailId);
  }
}

/**
 * Build update data for an existing recruit, only overwriting fields
 * where the new extraction has equal or higher confidence.
 */
function buildUpdateData(
  existing: Record<string, unknown>,
  newData: Record<string, unknown>,
  newConfidence: Record<string, ConfidenceLevel>
): Record<string, unknown> {
  const existingConfidence = (existing.extraction_confidence ?? {}) as Record<
    string,
    ConfidenceLevel
  >;
  const confidenceRank: Record<ConfidenceLevel, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const update: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(newData)) {
    if (field === "extraction_confidence" || field === "fields_missing" || field === "fields_extracted" || field === "fields_total") {
      continue; // Handle these separately
    }

    if (value == null) continue; // Don't overwrite with null

    const existingConf = existingConfidence[field];
    const newConf = newConfidence[field];

    if (!existingConf || !newConf) {
      // No confidence data — overwrite if we have a value
      update[field] = value;
    } else if (confidenceRank[newConf] >= confidenceRank[existingConf]) {
      update[field] = value;
    }
    // Otherwise keep existing value (higher confidence)
  }

  // Always update metadata
  update.extraction_confidence = {
    ...existingConfidence,
    ...newConfidence,
  };
  update.fields_missing = newData.fields_missing;
  update.fields_extracted = newData.fields_extracted;
  update.fields_total = newData.fields_total;

  return update;
}
