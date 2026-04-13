import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import type { RecruitWithScore } from "@/types/database";

export async function GET() {
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

  // Validates the override cookie and confirms the program still exists
  const overrideProgramId = await getAdminProgramOverride(coach.role);
  const effectiveProgramId = overrideProgramId ?? coach.program_id;
  const dbClient = overrideProgramId ? createAdminClient() : supabase;

  const [recruitsResult, scoresResult, flagsResult] = await Promise.all([
    dbClient
      .from("recruits")
      .select("*")
      .eq("program_id", effectiveProgramId)
      .order("created_at", { ascending: false }),
    dbClient
      .from("recruit_dqs_scores")
      .select("*")
      .eq("program_id", effectiveProgramId),
    dbClient
      .from("coach_recruit_flags")
      .select("*")
      .eq("program_id", effectiveProgramId),
  ]);

  if (recruitsResult.error) {
    return NextResponse.json({ error: recruitsResult.error.message }, { status: 500 });
  }
  if (scoresResult.error) {
    return NextResponse.json({ error: scoresResult.error.message }, { status: 500 });
  }
  if (flagsResult.error) {
    return NextResponse.json({ error: flagsResult.error.message }, { status: 500 });
  }

  const scoresMap = new Map(
    (scoresResult.data ?? []).map((s) => [s.recruit_id, s])
  );
  const flagsMap = new Map(
    (flagsResult.data ?? []).map((f) => [f.recruit_id, f])
  );

  const joined: RecruitWithScore[] = (recruitsResult.data ?? []).map((r) => ({
    ...r,
    dqs_score: scoresMap.get(r.id) ?? null,
    flag: flagsMap.get(r.id) ?? null,
  }));

  return NextResponse.json(joined);
}
