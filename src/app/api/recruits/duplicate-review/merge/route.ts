import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveProgramContext } from "@/lib/program-context";
import { chooseSurvivor, buildMergedPayload } from "@/lib/recruits/merge-payload";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";
import type { Recruit, ProgramConfig, TranscriptAnalysis } from "@/types/database";

/**
 * POST /api/recruits/duplicate-review/merge
 *
 * Atomically merges a subset of recruits within a review group.
 * Body: { group_id: string, recruit_ids: string[] }
 *
 * - Chooses the survivor (most complete, then newest).
 * - Builds a field-level merged payload.
 * - Calls the Postgres merge RPC for atomic rewiring and cleanup.
 * - Recomputes DQS for the survivor.
 * - Refreshes the review group — if fewer than 2 members remain,
 *   the group is auto-resolved by the RPC; otherwise it stays pending
 *   for the coach to continue working through the rest.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getEffectiveProgramContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No program context" }, { status: 400 });
  }

  const { effectiveProgramId, db } = ctx;
  const adminDb = createAdminClient();

  const body = await request.json();
  const groupId = body.group_id as string | undefined;
  const recruitIds = body.recruit_ids as unknown;

  if (
    !groupId ||
    !Array.isArray(recruitIds) ||
    recruitIds.length < 2 ||
    recruitIds.some((id) => typeof id !== "string")
  ) {
    return NextResponse.json(
      { error: "group_id and at least 2 recruit_ids are required" },
      { status: 400 }
    );
  }

  const validatedRecruitIds = recruitIds as string[];

  // Verify the group belongs to this program
  const { data: group } = await db
    .from("recruit_duplicate_review_groups")
    .select("id, status, name_key")
    .eq("id", groupId)
    .eq("program_id", effectiveProgramId)
    .single();

  if (!group) {
    return NextResponse.json({ error: "Review group not found" }, { status: 404 });
  }

  if (group.status !== "pending") {
    return NextResponse.json({ error: "Group is not pending" }, { status: 400 });
  }

  // Verify all recruitIds are actual members of this group
  const { data: groupMembers } = await db
    .from("recruit_duplicate_review_group_members")
    .select("recruit_id")
    .eq("group_id", groupId);

  const memberIdSet = new Set((groupMembers ?? []).map((m) => m.recruit_id));
  const outsideGroup = validatedRecruitIds.filter((id) => !memberIdSet.has(id));
  if (outsideGroup.length > 0) {
    return NextResponse.json(
      { error: "One or more recruits are not members of this review group" },
      { status: 400 }
    );
  }

  // Fetch full recruit records — use admin client to ensure we can read all members
  const { data: recruits, error: recruitsError } = await adminDb
    .from("recruits")
    .select("*")
    .in("id", validatedRecruitIds)
    .eq("program_id", effectiveProgramId);

  if (recruitsError || !recruits || recruits.length < 2) {
    return NextResponse.json(
      { error: "Could not fetch the selected recruits" },
      { status: 400 }
    );
  }

  if (recruits.length !== validatedRecruitIds.length) {
    return NextResponse.json(
      { error: "Some recruits could not be found in this program" },
      { status: 400 }
    );
  }

  const typedRecruits = recruits as Recruit[];

  // Choose survivor and compute merged payload in TypeScript
  const survivor = chooseSurvivor(typedRecruits);
  const losers = typedRecruits.filter((r) => r.id !== survivor.id);
  const loserIds = losers.map((r) => r.id);
  const mergedPayload = buildMergedPayload(typedRecruits);

  // Call the atomic merge Postgres RPC
  const { error: rpcError } = await adminDb.rpc("merge_duplicate_recruits", {
    p_survivor_id: survivor.id,
    p_loser_ids: loserIds,
    p_survivor_data: mergedPayload,
  });

  if (rpcError) {
    console.error("[merge] RPC error:", rpcError.message);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // Recompute DQS for the survivor after the merge
  try {
    const [configResult, survivorResult, transcriptResult] = await Promise.all([
      adminDb
        .from("program_config")
        .select("*")
        .eq("program_id", effectiveProgramId)
        .single(),
      adminDb.from("recruits").select("*").eq("id", survivor.id).single(),
      adminDb.from("transcript_analyses").select("*").eq("recruit_id", survivor.id).maybeSingle(),
    ]);

    if (configResult.data && survivorResult.data) {
      const dqsResult = calculateDQS(
        survivorResult.data as Recruit,
        configResult.data as ProgramConfig,
        transcriptResult.data as TranscriptAnalysis | null
      );
      const aiSummary = await generateDQSSummary(
        survivorResult.data as Recruit,
        configResult.data as ProgramConfig,
        dqsResult
      );

      const { error: dqsUpsertError } = await adminDb.from("recruit_dqs_scores").upsert(
        {
          recruit_id: survivor.id,
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
      if (dqsUpsertError) {
        console.error("[merge] DQS upsert failed:", dqsUpsertError.message);
        return NextResponse.json({
          success: true,
          survivor_id: survivor.id,
          merged_count: loserIds.length,
          dqs_warning: "Merge succeeded but DQS score could not be updated. It will refresh on next page load.",
        });
      }
    }
  } catch (err) {
    console.error("[merge] DQS recompute error:", err);
    return NextResponse.json({
      success: true,
      survivor_id: survivor.id,
      merged_count: loserIds.length,
      dqs_warning: "Merge succeeded but DQS recompute failed. It will refresh on next page load.",
    });
  }

  return NextResponse.json({
    success: true,
    survivor_id: survivor.id,
    merged_count: loserIds.length,
  });
}
