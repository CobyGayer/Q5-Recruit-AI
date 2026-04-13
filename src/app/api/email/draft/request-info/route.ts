import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { generateRequestInfoDraft } from "@/lib/email/draft";
import type { Recruit, RecruitDqsScore } from "@/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const recruitId = typeof body.recruitId === "string" ? body.recruitId : "";
  const fields = Array.isArray(body.fields) ? body.fields : [];

  if (!recruitId) {
    return NextResponse.json({ error: "recruitId is required" }, { status: 400 });
  }
  if (fields.length === 0) {
    return NextResponse.json({ error: "fields array is required" }, { status: 400 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("full_name, program_id, role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const effectiveProgramId = overrideProgramId ?? coach?.program_id;
  const db = overrideProgramId ? createAdminClient() : supabase;

  const recruitQuery = db.from("recruits").select("*").eq("id", recruitId);
  if (overrideProgramId) recruitQuery.eq("program_id", overrideProgramId);
  const { data: recruit, error: recruitError } = await recruitQuery.single();

  if (recruitError || !recruit) {
    return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
  }

  const { data: dqsScore } = await db
    .from("recruit_dqs_scores")
    .select("*")
    .eq("recruit_id", recruitId)
    .maybeSingle();

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

  try {
    const draft = await generateRequestInfoDraft({
      recruit: recruit as Recruit,
      dqsScore: dqsScore as RecruitDqsScore | null,
      coachName: coach?.full_name ?? "Coach",
      programName,
      institution,
      missingFields: fields,
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Failed to generate request-info draft:", error);
    return NextResponse.json({ error: "Failed to generate email draft" }, { status: 500 });
  }
}
