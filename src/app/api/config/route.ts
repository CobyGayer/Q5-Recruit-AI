import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/utils/api-key";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { z } from "zod";

const ProgramConfigUpdateSchema = z.object({
  min_gpa: z.number().min(0).max(5).nullable().optional(),
  min_sat: z.number().int().min(400).max(1600).nullable().optional(),
  min_act: z.number().int().min(1).max(36).nullable().optional(),
  min_height_by_position: z.record(z.string(), z.number()).optional(),
  accepted_grad_years: z.array(z.number().int()).optional(),
  accepted_positions: z.array(z.string()).optional(),
  weight_academic: z.number().int().min(0).max(100).optional(),
  weight_competition: z.number().int().min(0).max(100).optional(),
  weight_physical: z.number().int().min(0).max(100).optional(),
  weight_position_fit: z.number().int().min(0).max(100).optional(),
  weight_grad_year: z.number().int().min(0).max(100).optional(),
  weight_completeness: z.number().int().min(0).max(100).optional(),
  high_need_positions: z.record(z.string(), z.array(z.object({ position: z.string(), rank: z.number().int() }))).optional(),
  priority_grad_years: z.array(z.object({ year: z.number().int(), rank: z.number().int() })).optional(),
  roster_spots: z.record(z.string(), z.number().int()).optional(),
}).strict();

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("program_id, role")
    .eq("id", user.id)
    .single();

  if (coachError || !coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  // Validates the override cookie and confirms the program still exists
  const overrideProgramId = await getAdminProgramOverride(coach.role);
  const effectiveProgramId = overrideProgramId ?? coach.program_id;
  const dbClient = overrideProgramId ? createAdminClient() : supabase;

  const { data, error } = await dbClient
    .from("program_config")
    .select("*")
    .eq("program_id", effectiveProgramId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("program_id, role")
    .eq("id", user.id)
    .single();

  if (coachError || !coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  const raw = await request.json();
  const parsed = ProgramConfigUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Validates the override cookie and confirms the program still exists
  const overrideProgramId = await getAdminProgramOverride(coach.role);
  const effectiveProgramId = overrideProgramId ?? coach.program_id;

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("program_config")
    .upsert(
      { program_id: effectiveProgramId, coach_id: user.id, ...parsed.data },
      { onConflict: "program_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "generate_api_key") {
    const rawKey = generateApiKey();
    const hashedKey = hashApiKey(rawKey);

    // Use admin client to update the hashed key (bypasses RLS for the update)
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("coaches")
      .update({ api_key: hashedKey })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the raw key (only shown once)
    return NextResponse.json({ api_key: rawKey });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
