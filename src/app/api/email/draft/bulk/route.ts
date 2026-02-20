import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    return NextResponse.json(
      { error: "recruitIds array is required" },
      { status: 400 }
    );
  }

  if (recruitIds.length > MAX_BULK_SIZE) {
    return NextResponse.json(
      { error: `Maximum ${MAX_BULK_SIZE} recruits per batch` },
      { status: 400 }
    );
  }

  // Fetch all recruits (RLS ensures coach isolation)
  const { data: recruits } = await supabase
    .from("recruits")
    .select("*")
    .in("id", recruitIds);

  if (!recruits?.length) {
    return NextResponse.json(
      { error: "No recruits found" },
      { status: 404 }
    );
  }

  // Fetch all DQS scores
  const { data: scores } = await supabase
    .from("recruit_dqs_scores")
    .select("*")
    .in("recruit_id", recruitIds);

  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.recruit_id, s as RecruitDqsScore])
  );

  // Fetch coach + program info
  const { data: coach } = await supabase
    .from("coaches")
    .select("full_name, program_id")
    .eq("id", user.id)
    .single();

  let programName = "";
  let institution = "";
  if (coach?.program_id) {
    const { data: program } = await supabase
      .from("programs")
      .select("name, institution")
      .eq("id", coach.program_id)
      .single();
    programName = program?.name ?? "";
    institution = program?.institution ?? "";
  }

  // Generate drafts in parallel
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
