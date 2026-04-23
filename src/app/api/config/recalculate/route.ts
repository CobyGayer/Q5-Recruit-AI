import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";
import type { Recruit, ProgramConfig } from "@/types/database";
import { POSITIONS } from "@/types/config";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("program_id, role")
    .eq("id", user.id)
    .single();

  if (!coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  const overrideProgramId = await getAdminProgramOverride(coach.role);
  const effectiveProgramId = overrideProgramId ?? coach.program_id;
  const adminSupabase = createAdminClient();

  const { data: config } = await adminSupabase
    .from("program_config")
    .select("*")
    .eq("program_id", effectiveProgramId)
    .single();

  if (!config) {
    return NextResponse.json({ error: "No configuration found" }, { status: 404 });
  }

  const { data: recruits } = await adminSupabase
    .from("recruits")
    .select("*")
    .eq("program_id", effectiveProgramId);

  if (!recruits || recruits.length === 0) {
    return NextResponse.json({ recalculated: 0 });
  }

  let recalculated = 0;

  for (const recruit of recruits) {
    // Patch recruits with no recognized positions — treat as missing.
    const knownPositions = (recruit.positions as string[]).filter((pos) =>
      (POSITIONS as readonly string[]).includes(pos)
    );
    const confidence = recruit.extraction_confidence as Record<string, unknown> ?? {};
    const hasUnrecognizedPositions =
      (recruit.positions.length > 0 && knownPositions.length === 0) ||
      (recruit.positions.length === 0 && "positions" in confidence);
    if (hasUnrecognizedPositions) {
      const fieldsMissing: string[] = Array.isArray(recruit.fields_missing)
        ? [...recruit.fields_missing]
        : [];
      if (!fieldsMissing.includes("positions")) {
        fieldsMissing.push("positions");
      }
      const updatedConfidence = { ...confidence };
      delete updatedConfidence["positions"];
      await adminSupabase
        .from("recruits")
        .update({
          positions: [],
          fields_missing: fieldsMissing,
          fields_extracted: Math.max(0, (recruit.fields_extracted as number) - 1),
          extraction_confidence: updatedConfidence,
        })
        .eq("id", recruit.id);
      recruit.positions = [];
      recruit.fields_missing = fieldsMissing;
      recruit.fields_extracted = Math.max(0, (recruit.fields_extracted as number) - 1);
      recruit.extraction_confidence = updatedConfidence;
    }

    const dqsResult = calculateDQS(recruit as Recruit, config as ProgramConfig);

    const aiSummary = await generateDQSSummary(
      recruit as Recruit,
      config as ProgramConfig,
      dqsResult
    );

    await adminSupabase.from("recruit_dqs_scores").upsert(
      {
        recruit_id: recruit.id,
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
    recalculated++;
  }

  return NextResponse.json({ recalculated });
}
