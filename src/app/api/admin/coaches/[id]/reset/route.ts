import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ResetLevel = "full" | "pre_onboarding" | "clear_data";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: coachId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: admin } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  if (admin?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const level = body.level as ResetLevel;

  if (!["full", "pre_onboarding", "clear_data"].includes(level)) {
    return NextResponse.json({ error: "Invalid reset level" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Verify target coach exists
  const { data: targetCoach, error: fetchError } = await adminSupabase
    .from("coaches")
    .select("id, full_name")
    .eq("id", coachId)
    .single();

  if (fetchError || !targetCoach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  // Delete dependent data
  // recruit_dqs_scores and coach_recruit_flags have ON DELETE CASCADE from recruits
  await adminSupabase.from("ingested_emails").delete().eq("coach_id", coachId);
  await adminSupabase.from("recruits").delete().eq("coach_id", coachId);

  if (level === "full" || level === "pre_onboarding") {
    await adminSupabase.from("program_config").delete().eq("coach_id", coachId);
  }

  // Update coach row based on reset level
  const coachUpdate: Record<string, unknown> =
    level === "full"
      ? {
          status: "pending",
          onboarding_completed: false,
          program_id: null,
          api_key: null,
          email_pipeline_status: "not_started",
        }
      : level === "pre_onboarding"
        ? {
            onboarding_completed: false,
            program_id: null,
            api_key: null,
            email_pipeline_status: "not_started",
          }
        : {
            api_key: null,
            email_pipeline_status: "not_started",
          };

  const { data: updatedCoach, error: updateError } = await adminSupabase
    .from("coaches")
    .update(coachUpdate)
    .eq("id", coachId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Coach "${targetCoach.full_name}" reset (${level})`,
    coach: updatedCoach,
  });
}
