import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractRecruitData } from "@/lib/extraction/extract";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";
import { buildSampleEmailPayload } from "@/lib/sample-email";
import type { Recruit, ProgramConfig, ConfidenceLevel } from "@/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: coachId } = await params;

  // Auth: session + admin role check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  if (admin?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  // Verify target coach exists and is approved
  const { data: coach, error: coachError } = await adminSupabase
    .from("coaches")
    .select("id, status")
    .eq("id", coachId)
    .single();

  if (coachError || !coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  if (coach.status !== "approved") {
    return NextResponse.json(
      { error: "Coach must be approved before sending sample" },
      { status: 400 }
    );
  }

  // Fetch config early so we can tailor the sample to the coach's thresholds
  const { data: config } = await adminSupabase
    .from("program_config")
    .select("*")
    .eq("coach_id", coachId)
    .single();

  // Step 1: Create ingested_emails record
  const payload = buildSampleEmailPayload(
    config as ProgramConfig | null
  );
  const { data: emailRecord, error: emailError } = await adminSupabase
    .from("ingested_emails")
    .insert({
      coach_id: coachId,
      sender_email: payload.sender_email,
      sender_name: payload.sender_name,
      subject: payload.subject,
      body_plain: payload.body_plain,
      processing_status: "processing",
      attachments: [],
    })
    .select()
    .single();

  if (emailError || !emailRecord) {
    return NextResponse.json(
      { error: "Failed to store email", details: emailError?.message },
      { status: 500 }
    );
  }

  // Step 2: Extract data with Claude API
  try {
    const extraction = await extractRecruitData(
      payload.subject,
      payload.sender_name,
      payload.sender_email,
      payload.body_plain
    );

    const recruitEmail =
      (extraction.recruitData.email as string) ?? payload.sender_email;

    let recruitId: string;

    // Step 3: Dedup check + create/update recruit
    if (recruitEmail) {
      const { data: existing } = await adminSupabase
        .from("recruits")
        .select("*")
        .eq("coach_id", coachId)
        .eq("email", recruitEmail)
        .single();

      if (existing) {
        const updateData = buildUpdateData(
          existing,
          extraction.recruitData,
          extraction.confidence
        );
        await adminSupabase
          .from("recruits")
          .update(updateData)
          .eq("id", existing.id);
        recruitId = existing.id;
      } else {
        const { data: newRecruit, error: recruitError } = await adminSupabase
          .from("recruits")
          .insert({ coach_id: coachId, ...extraction.recruitData })
          .select()
          .single();

        if (recruitError || !newRecruit) {
          throw new Error(
            `Failed to create recruit: ${recruitError?.message}`
          );
        }
        recruitId = newRecruit.id;
      }
    } else {
      const { data: newRecruit, error: recruitError } = await adminSupabase
        .from("recruits")
        .insert({ coach_id: coachId, ...extraction.recruitData })
        .select()
        .single();

      if (recruitError || !newRecruit) {
        throw new Error(
          `Failed to create recruit: ${recruitError?.message}`
        );
      }
      recruitId = newRecruit.id;
    }

    // Step 4: Calculate DQS score (reuses config fetched above)
    if (config) {
      const { data: recruit } = await adminSupabase
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

        await adminSupabase.from("recruit_dqs_scores").upsert(
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

    // Step 5: Update email record with results
    await adminSupabase
      .from("ingested_emails")
      .update({
        recruit_id: recruitId,
        processing_status: extraction.processingStatus,
        extracted_data: extraction.extractedData as unknown as Record<
          string,
          unknown
        >,
      })
      .eq("id", emailRecord.id);

    return NextResponse.json({
      success: true,
      recruit_id: recruitId,
      status: extraction.processingStatus,
      fields_extracted: extraction.fieldsExtracted,
      fields_missing: extraction.fieldsMissing,
    });
  } catch (err) {
    await adminSupabase
      .from("ingested_emails")
      .update({
        processing_status: "failed",
        extraction_error: String(err),
      })
      .eq("id", emailRecord.id);

    return NextResponse.json(
      { error: "Sample email processing failed", details: String(err) },
      { status: 422 }
    );
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
    if (
      field === "extraction_confidence" ||
      field === "fields_missing" ||
      field === "fields_extracted" ||
      field === "fields_total"
    ) {
      continue;
    }

    if (value == null) continue;

    const existingConf = existingConfidence[field];
    const newConf = newConfidence[field];

    if (!existingConf || !newConf) {
      update[field] = value;
    } else if (confidenceRank[newConf] >= confidenceRank[existingConf]) {
      update[field] = value;
    }
  }

  update.extraction_confidence = {
    ...existingConfidence,
    ...newConfidence,
  };
  update.fields_missing = newData.fields_missing;
  update.fields_extracted = newData.fields_extracted;
  update.fields_total = newData.fields_total;

  return update;
}
