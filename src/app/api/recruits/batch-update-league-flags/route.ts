import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { z } from "zod";
import { batchEvaluateOutsideSelectionFlags } from "@/lib/data/league-preferences";

const BatchUpdateFlagsSchema = z.object({
  programId: z.string().uuid(),
});

/**
 * POST /api/recruits/batch-update-league-flags
 * 
 * When a coach changes their league preferences, this endpoint:
 * 1. Fetches all recruits in the program
 * 2. Evaluates each recruit's is_outside_selected_leagues flag
 * 3. Batch updates any recruits whose flag status changed
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BatchUpdateFlagsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { programId } = parsed.data;
  const overrideProgramId = await getAdminProgramOverride("coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  // Verify user has access to this program
  const { data: coach } = await supabase
    .from("coaches")
    .select("program_id")
    .eq("id", user.id)
    .single();

  if (!overrideProgramId && coach?.program_id !== programId) {
    return NextResponse.json(
      { error: "Access denied to this program" },
      { status: 403 }
    );
  }

  // Fetch program config to get league preferences
  const { data: config, error: configError } = await db
    .from("program_config")
    .select("league_preferences")
    .eq("program_id", programId)
    .single();

  if (configError || !config) {
    return NextResponse.json(
      { error: "Program config not found" },
      { status: 404 }
    );
  }

  // Fetch all recruits in the program
  const { data: recruits, error: recruitsError } = await db
    .from("recruits")
    .select("id, club_level, is_outside_selected_leagues")
    .eq("program_id", programId);

  if (recruitsError || !recruits) {
    return NextResponse.json(
      { error: "Could not fetch recruits" },
      { status: 500 }
    );
  }

  // Evaluate which recruits need flag updates
  const toUpdate = batchEvaluateOutsideSelectionFlags(
    recruits.map((r) => ({
      id: r.id,
      club_level: r.club_level,
      is_outside_selected_leagues: r.is_outside_selected_leagues,
      program_id: programId,
      full_name: null,
      email: null,
      phone: null,
      graduation_year: null,
      current_school: null,
      city: null,
      state: null,
      country: null,
      positions: [],
      preferred_foot: null,
      height_inches: null,
      weight_lbs: null,
      gpa: null,
      sat_score: null,
      act_score: null,
      club_team: null,
      high_school_team: null,
      video_url: null,
      extraction_confidence: {},
      fields_missing: [],
      fields_extracted: 0,
      fields_total: 0,
      name_key: null,
      coach_id: "",
      created_at: "",
      updated_at: "",
    } as any)) as any,
    config.league_preferences || []
  );

  if (toUpdate.length === 0) {
    return NextResponse.json({
      success: true,
      updated_count: 0,
      message: "No recruits needed flag updates",
    });
  }

  // Batch update the flagged recruits
  const updatePromises = toUpdate.map(({ recruitId, newFlagValue }) =>
    db
      .from("recruits")
      .update({ is_outside_selected_leagues: newFlagValue })
      .eq("id", recruitId)
  );

  const results = await Promise.all(updatePromises);
  const failedUpdates = results.filter((r) => r.error).length;

  return NextResponse.json({
    success: failedUpdates === 0,
    updated_count: toUpdate.length,
    failed_count: failedUpdates,
    message: `Updated ${toUpdate.length - failedUpdates} of ${toUpdate.length} recruits`,
  });
}
