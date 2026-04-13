import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { z } from "zod";
import { normalizeEmail } from "@/lib/utils/email";

const RecruitUpdateSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional().refine((v) => v == null || z.string().email().safeParse(v).success, { message: "Invalid email" }),
  phone: z.string().nullable().optional(),
  graduation_year: z.number().int().min(2015).max(2035).nullable().optional(),
  current_school: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  positions: z.array(z.string()).optional(),
  preferred_foot: z.string().nullable().optional(),
  height_inches: z.number().int().min(48).max(96).nullable().optional(),
  weight_lbs: z.number().int().min(80).max(350).nullable().optional(),
  gpa: z.number().min(0).max(5).nullable().optional(),
  sat_score: z.number().int().min(400).max(1600).nullable().optional(),
  act_score: z.number().int().min(1).max(36).nullable().optional(),
  club_team: z.string().nullable().optional(),
  club_level: z.enum(["mls_next", "ecnl", "ga", "regional", "other", "unknown"]).optional(),
  high_school_team: z.string().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  // When override is active, scope the recruit query to the overridden program so
  // the admin cannot reach records outside the currently selected workspace.
  const recruitQuery = db.from("recruits").select("*").eq("id", id);
  if (overrideProgramId) recruitQuery.eq("program_id", overrideProgramId);

  const [recruitResult, scoreResult, flagResult, emailResult, transcriptResult] =
    await Promise.all([
      recruitQuery.single(),
      db.from("recruit_dqs_scores").select("*").eq("recruit_id", id).maybeSingle(),
      db.from("coach_recruit_flags").select("*").eq("recruit_id", id).maybeSingle(),
      db.from("ingested_emails")
        .select("body_plain, received_at")
        .eq("recruit_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("transcript_analyses").select("*").eq("recruit_id", id).maybeSingle(),
    ]);

  if (recruitResult.error || !recruitResult.data) {
    return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
  }

  return NextResponse.json({
    recruit: recruitResult.data,
    dqs_score: scoreResult.data ?? null,
    flag: flagResult.data ?? null,
    original_email: emailResult.data ?? null,
    transcript_analysis: transcriptResult.data ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  const raw = await request.json();
  const parsed = RecruitUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updateData = {
    ...parsed.data,
    ...(parsed.data.email !== undefined && { email: normalizeEmail(parsed.data.email) }),
  };

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  // When override is active, scope the update to the overridden program_id to
  // prevent cross-program writes if the recruit ID somehow belongs elsewhere.
  let query = db.from("recruits").update(updateData).eq("id", id);
  if (overrideProgramId) {
    query = query.eq("program_id", overrideProgramId);
  }
  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  let query = db.from("recruits").delete().eq("id", id);
  if (overrideProgramId) {
    query = query.eq("program_id", overrideProgramId);
  }
  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
