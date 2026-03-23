import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/utils/api-key";

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
    .select("program_id")
    .eq("id", user.id)
    .single();

  if (coachError || !coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("program_config")
    .select("*")
    .eq("program_id", coach.program_id)
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
    .select("program_id")
    .eq("id", user.id)
    .single();

  if (coachError || !coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("program_config")
    .upsert(
      { updated_by_coach_id: user.id, program_id: coach.program_id, ...body },
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
