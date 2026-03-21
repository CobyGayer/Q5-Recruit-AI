import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const RecruitUpdateSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  graduation_year: z.number().int().min(2020).max(2035).nullable().optional(),
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

  const { data, error } = await supabase
    .from("recruits")
    .select("*")
    .eq("id", id)
    .eq("coach_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
  }

  return NextResponse.json(data);
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

  const raw = await request.json();
  const parsed = RecruitUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { data, error } = await supabase
    .from("recruits")
    .update(parsed.data)
    .eq("id", id)
    .eq("coach_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
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

  const { error } = await supabase
    .from("recruits")
    .delete()
    .eq("id", id)
    .eq("coach_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
