import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { normalizeEmail } from "@/lib/utils/email";
import { extractRecruitData } from "@/lib/extraction/extract";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";
import { findFirstPdfAttachment, analyzeTranscript } from "@/lib/transcript";
import { buildUpdateData } from "@/lib/recruits/update-data";
import { checkAndQueueDuplicateReview } from "@/lib/recruits/duplicate-review";
import type { Recruit, ProgramConfig, TranscriptAnalysis } from "@/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, email, program_id, role")
    .eq("id", user.id)
    .single();

  if (!coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  const overrideProgramId = await getAdminProgramOverride(coach.role);
  const effectiveProgramId = overrideProgramId ?? coach.program_id;

  // Fetch the failed email — admin client needed when override is active (RLS would block it)
  const { data: email } = await adminSupabase
    .from("ingested_emails")
    .select("*")
    .eq("id", id)
    .eq("program_id", effectiveProgramId)
    .single();

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  if (email.processing_status !== "failed") {
    return NextResponse.json(
      { error: "Only failed emails can be retried" },
      { status: 400 }
    );
  }

  // Mark as processing
  await adminSupabase
    .from("ingested_emails")
    .update({ processing_status: "processing", extraction_error: null })
    .eq("id", id);

  try {
    // Detect whether this was originally a forwarded email.
    // We use the same heuristic as the main ingest path.
    const isForwarded = /---------- Forwarded message -+/.test(email.body_plain ?? "") ||
      /^Begin forwarded message:/m.test(email.body_plain ?? "") ||
      /^----- Original Message -----/m.test(email.body_plain ?? "");

    const extraction = await extractRecruitData(
      email.subject,
      email.sender_name,
      email.sender_email,
      email.body_plain,
      isForwarded
    );

    // Normalize emails (same two-pass dedup as main ingest)
    const extractedEmail = normalizeEmail(extraction.recruitData.email as string);
    const senderEmail = normalizeEmail(email.sender_email);
    const coachEmail = normalizeEmail(coach.email);

    // For forwarded emails, sender is the coach — do not use as recruit email fallback
    if (isForwarded) {
      extraction.recruitData.email = extractedEmail ?? null;
    } else {
      extraction.recruitData.email = extractedEmail ?? senderEmail;
    }

    // Guard: skip if sender is the coach themselves (same as main ingest)
    const senderIsCoach = !isForwarded && coachEmail && senderEmail === coachEmail;
    if (senderIsCoach) {
      await adminSupabase
        .from("ingested_emails")
        .update({
          processing_status: "failed",
          extraction_error: "Skipped: sender is the coach (outbound email)",
        })
        .eq("id", id);
      return NextResponse.json({ error: "Skipped: sender is the coach" }, { status: 400 });
    }

    // Two-pass email dedup
    let existing: Record<string, unknown> | null = null;

    if (extractedEmail) {
      const { data } = await adminSupabase
        .from("recruits")
        .select("*")
        .eq("program_id", effectiveProgramId)
        .eq("email", extractedEmail)
        .single();
      existing = data;
    }

    if (!existing && !isForwarded && senderEmail && senderEmail !== extractedEmail) {
      const { data } = await adminSupabase
        .from("recruits")
        .select("*")
        .eq("program_id", effectiveProgramId)
        .eq("email", senderEmail)
        .single();
      existing = data;
      if (existing) {
        extraction.recruitData.email = senderEmail;
      }
    }

    let recruitId: string;

    if (existing) {
      // Confidence-based update (same logic as main ingest)
      const prevNameKey = (existing.name_key as string | null) ?? null;
      const updateData = buildUpdateData(
        existing,
        extraction.recruitData,
        extraction.confidence
      );

      const { data: updatedRecruit, error: updateError } = await adminSupabase
        .from("recruits")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError) throw new Error(`Failed to update recruit: ${updateError.message}`);

      recruitId = existing.id as string;
      if (!updatedRecruit) {
        console.warn(`[retry] Update returned no data for recruit ${recruitId}`);
      }

      // Use the persisted name_key from the updated row rather than recomputing
      // from extraction.recruitData — buildUpdateData() may have rejected the
      // extracted full_name due to low confidence, so the DB trigger's value is
      // the authoritative key.
      const newNameKey = (updatedRecruit?.name_key as string | null) ?? null;
      // Mirror ingest: fire on any truthy name_key, not just when it changed.
      // Unchanged keys still need to re-surface dismissed groups on touch.
      if (newNameKey) {
        checkAndQueueDuplicateReview(adminSupabase, effectiveProgramId, recruitId, prevNameKey, newNameKey, "ingest").catch((err) =>
          console.error("[retry] duplicate-review queue failed:", err)
        );
      }
    } else {
      // Create new recruit
      const { data: newRecruit, error: recruitError } = await adminSupabase
        .from("recruits")
        .insert({
          coach_id: user.id,
          program_id: effectiveProgramId,
          ...extraction.recruitData,
        })
        .select()
        .single();

      if (recruitError || !newRecruit) {
        throw new Error(`Failed to create recruit: ${recruitError?.message}`);
      }
      recruitId = newRecruit.id;

      // Use DB-persisted name_key — SQL unaccent() diverges from TS normalizeNameKey()
      // for chars like ł, ß, ı. Mirror ingest create path.
      const newNameKey = (newRecruit.name_key as string | null) ?? null;
      if (newNameKey) {
        checkAndQueueDuplicateReview(adminSupabase, effectiveProgramId, recruitId, null, newNameKey, "ingest").catch((err) =>
          console.error("[retry] duplicate-review queue failed:", err)
        );
      }
    }

    // Transcript analysis (same as main ingest)
    const attachments = Array.isArray(email.attachments) ? email.attachments : [];
    let transcriptAnalysis: TranscriptAnalysis | null = null;

    if (attachments.length > 0) {
      try {
        const pdfAttachment = await findFirstPdfAttachment(attachments);
        if (pdfAttachment) {
          const analysis = await analyzeTranscript(pdfAttachment.base64);
          if (analysis) {
            const { data: transcriptRow } = await adminSupabase
              .from("transcript_analyses")
              .upsert(
                {
                  recruit_id: recruitId,
                  coach_id: user.id,
                  email_id: id,
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
        console.warn("[retry/transcript] Non-blocking analysis error:", err);
      }
    }

    // Fetch existing transcript if none from this retry
    if (!transcriptAnalysis) {
      const { data: existingAnalysis } = await adminSupabase
        .from("transcript_analyses")
        .select("*")
        .eq("recruit_id", recruitId)
        .single();
      transcriptAnalysis = existingAnalysis as TranscriptAnalysis | null;
    }

    // Calculate DQS score using the effective program's config
    const { data: config } = await adminSupabase
      .from("program_config")
      .select("*")
      .eq("program_id", effectiveProgramId)
      .single();

    if (config) {
      const { data: recruit } = await adminSupabase
        .from("recruits")
        .select("*")
        .eq("id", recruitId)
        .single();

      if (recruit) {
        const dqsResult = calculateDQS(recruit as Recruit, config as ProgramConfig, transcriptAnalysis);
        const aiSummary = await generateDQSSummary(
          recruit as Recruit,
          config as ProgramConfig,
          dqsResult
        );

        await adminSupabase.from("recruit_dqs_scores").upsert(
          {
            recruit_id: recruitId,
            coach_id: user.id,
            program_id: effectiveProgramId,
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

    // Update email record with result
    const recruitEmailFinal = extraction.recruitData.email as string | null;
    const recruitNameFinal = extraction.recruitData.full_name as string | null;
    await adminSupabase
      .from("ingested_emails")
      .update({
        recruit_id: recruitId,
        processing_status: extraction.processingStatus,
        extracted_data: extraction.extractedData as unknown as Record<string, unknown>,
        extraction_error: null,
        ...(isForwarded && recruitEmailFinal
          ? { sender_email: recruitEmailFinal, sender_name: recruitNameFinal }
          : {}),
      })
      .eq("id", id);

    return NextResponse.json({ success: true, recruit_id: recruitId });
  } catch (err) {
    await adminSupabase
      .from("ingested_emails")
      .update({
        processing_status: "failed",
        extraction_error: String(err),
      })
      .eq("id", id);

    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
