import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, isValidApiKeyFormat } from "@/lib/utils/api-key";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { IngestPayloadSchema } from "@/lib/extraction/schema";
import { extractRecruitData } from "@/lib/extraction/extract";
import { calculateDQS } from "@/lib/scoring/dqs";
import type { Recruit, ProgramConfig, ConfidenceLevel } from "@/types/database";

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
    .select("id, status")
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
      processing_status: "processing",
    })
    .select()
    .single();

  if (emailError || !emailRecord) {
    return NextResponse.json(
      { error: "Failed to store email", details: emailError?.message },
      { status: 500 }
    );
  }

  // Step 5: Extract data with Claude API
  try {
    const extraction = await extractRecruitData(
      payload.subject,
      payload.sender_name,
      payload.sender_email,
      payload.body_plain
    );

    // Determine the recruit's email for dedup
    const recruitEmail =
      (extraction.recruitData.email as string) ?? payload.sender_email;

    let recruitId: string;

    if (recruitEmail) {
      // Check for existing recruit (deduplication)
      const { data: existing } = await supabase
        .from("recruits")
        .select("*")
        .eq("coach_id", coach.id)
        .eq("email", recruitEmail)
        .single();

      if (existing) {
        // Update existing recruit (only overwrite if new confidence >= existing)
        const updateData = buildUpdateData(
          existing,
          extraction.recruitData,
          extraction.confidence
        );

        const { data: updated } = await supabase
          .from("recruits")
          .update(updateData)
          .eq("id", existing.id)
          .select()
          .single();

        recruitId = existing.id;
      } else {
        // Create new recruit
        const { data: newRecruit, error: recruitError } = await supabase
          .from("recruits")
          .insert({
            coach_id: coach.id,
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
    } else {
      // No email found — create recruit without dedup
      const { data: newRecruit, error: recruitError } = await supabase
        .from("recruits")
        .insert({
          coach_id: coach.id,
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

    // Step 6: Calculate DQS score
    const { data: config } = await supabase
      .from("program_config")
      .select("*")
      .eq("coach_id", coach.id)
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

        await supabase.from("recruit_dqs_scores").upsert(
          {
            recruit_id: recruitId,
            coach_id: coach.id,
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
            calculated_at: new Date().toISOString(),
          },
          { onConflict: "recruit_id" }
        );
      }
    }

    // Step 7: Update email record with results
    await supabase
      .from("ingested_emails")
      .update({
        recruit_id: recruitId,
        processing_status: extraction.processingStatus,
        extracted_data: extraction.extractedData as unknown as Record<string, unknown>,
      })
      .eq("id", emailRecord.id);

    return NextResponse.json({
      success: true,
      profile_id: recruitId,
      status: extraction.processingStatus,
      fields_extracted: extraction.fieldsExtracted,
      fields_missing: extraction.fieldsMissing,
    });
  } catch (err) {
    // Update email record with failure
    await supabase
      .from("ingested_emails")
      .update({
        processing_status: "failed",
        extraction_error: String(err),
      })
      .eq("id", emailRecord.id);

    return NextResponse.json(
      {
        error: "Extraction failed",
        details: String(err),
      },
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
