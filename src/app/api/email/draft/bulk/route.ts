import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { generateRecruitDraft } from "@/lib/email/draft";
import type { Recruit, RecruitDqsScore } from "@/types/database";

const MAX_BULK_SIZE = 25;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const recruitIds = Array.isArray(body.recruitIds) ? body.recruitIds : [];
  const purpose = typeof body.purpose === "string" ? body.purpose : undefined;

  if (recruitIds.length === 0) {
    return NextResponse.json({ error: "recruitIds array is required" }, { status: 400 });
  }
  if (recruitIds.length > MAX_BULK_SIZE) {
    return NextResponse.json({ error: `Maximum ${MAX_BULK_SIZE} recruits per batch` }, { status: 400 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("full_name, program_id, role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const effectiveProgramId = overrideProgramId ?? coach?.program_id;
  const db = overrideProgramId ? createAdminClient() : supabase;

  // Scope recruit fetch to the effective program to prevent cross-workspace lookups
  let recruitsQuery = db.from("recruits").select("*").in("id", recruitIds);
  if (overrideProgramId) recruitsQuery = recruitsQuery.eq("program_id", overrideProgramId);
  const { data: recruits } = await recruitsQuery;

  if (!recruits?.length) {
    return NextResponse.json({ error: "No recruits found" }, { status: 404 });
  }

  const { data: scores } = await db
    .from("recruit_dqs_scores")
    .select("*")
    .in("recruit_id", recruitIds);

  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.recruit_id, s as RecruitDqsScore])
  );

  let programName = "";
  let institution = "";
  if (effectiveProgramId) {
    const { data: program } = await db
      .from("programs")
      .select("name, institution")
      .eq("id", effectiveProgramId)
      .single();
    programName = program?.name ?? "";
    institution = program?.institution ?? "";
  }

  const results = await Promise.allSettled(
    recruits.map(async (recruit) => {
      const draft = await generateRecruitDraft({
        recruit: recruit as Recruit,
        dqsScore: scoreMap.get(recruit.id) ?? null,
        coachName: coach?.full_name ?? "Coach",
        programName,
        institution,
        purpose,
      });
      return { recruitId: recruit.id, ...draft };
    })
  );

  const drafts = results
    .filter(
      (r): r is PromiseFulfilledResult<{ recruitId: string; subject: string; body: string }> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);

  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r, i) => ({
      recruitId: recruits[i]?.id,
      error: (r as PromiseRejectedResult).reason?.message ?? "Unknown error",
    }));

  return NextResponse.json({ drafts, errors });
}
