import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractRecruitData } from "@/lib/extraction/extract";
import { calculateDQS } from "@/lib/scoring/dqs";
import type { Recruit, ProgramConfig } from "@/types/database";

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

  // Get the failed email
  const { data: email } = await supabase
    .from("ingested_emails")
    .select("*")
    .eq("id", id)
    .eq("coach_id", user.id)
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

  // Update status to processing
  await adminSupabase
    .from("ingested_emails")
    .update({ processing_status: "processing", extraction_error: null })
    .eq("id", id);

  try {
    const extraction = await extractRecruitData(
      email.subject,
      email.sender_name,
      email.sender_email,
      email.body_plain
    );

    const recruitEmail =
      (extraction.recruitData.email as string) ?? email.sender_email;

    // Create or update recruit
    let recruitId: string;
    if (recruitEmail) {
      const { data: existing } = await adminSupabase
        .from("recruits")
        .select("id")
        .eq("coach_id", user.id)
        .eq("email", recruitEmail)
        .single();

      if (existing) {
        await adminSupabase
          .from("recruits")
          .update(extraction.recruitData)
          .eq("id", existing.id);
        recruitId = existing.id;
      } else {
        const { data: newRecruit } = await adminSupabase
          .from("recruits")
          .insert({ coach_id: user.id, ...extraction.recruitData })
          .select()
          .single();
        recruitId = newRecruit!.id;
      }
    } else {
      const { data: newRecruit } = await adminSupabase
        .from("recruits")
        .insert({ coach_id: user.id, ...extraction.recruitData })
        .select()
        .single();
      recruitId = newRecruit!.id;
    }

    // Calculate DQS
    const { data: config } = await adminSupabase
      .from("program_config")
      .select("*")
      .eq("coach_id", user.id)
      .single();

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

        await adminSupabase.from("recruit_dqs_scores").upsert(
          {
            recruit_id: recruitId,
            coach_id: user.id,
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

    // Update email record
    await adminSupabase
      .from("ingested_emails")
      .update({
        recruit_id: recruitId,
        processing_status: extraction.processingStatus,
        extracted_data: extraction.extractedData as unknown as Record<string, unknown>,
        extraction_error: null,
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
