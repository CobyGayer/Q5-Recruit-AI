import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRecruitDraft } from "@/lib/email/draft";
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
  const purpose = typeof body.purpose === "string" ? body.purpose : undefined;

  if (!recruitId) {
    return NextResponse.json(
      { error: "recruitId is required" },
      { status: 400 }
    );
  }

  // Fetch recruit (RLS ensures coach can only access their own)
  const { data: recruit, error: recruitError } = await supabase
    .from("recruits")
    .select("*")
    .eq("id", recruitId)
    .single();

  if (recruitError || !recruit) {
    return NextResponse.json(
      { error: "Recruit not found" },
      { status: 404 }
    );
  }

  // Fetch DQS score
  const { data: dqsScore } = await supabase
    .from("recruit_dqs_scores")
    .select("*")
    .eq("recruit_id", recruitId)
    .single();

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

  try {
    const draft = await generateRecruitDraft({
      recruit: recruit as Recruit,
      dqsScore: dqsScore as RecruitDqsScore | null,
      coachName: coach?.full_name ?? "Coach",
      programName,
      institution,
      purpose,
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Failed to generate email draft:", error);
    return NextResponse.json(
      { error: "Failed to generate email draft" },
      { status: 500 }
    );
  }
}
