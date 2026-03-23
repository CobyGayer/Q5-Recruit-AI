import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FlagType } from "@/types/database";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recruitId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const flag = body.flag as FlagType;

  const { data: coach } = await supabase
    .from("coaches")
    .select("program_id")
    .eq("id", user.id)
    .single();

  if (!coach?.program_id) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("coach_recruit_flags")
    .upsert(
      {
        coach_id: user.id,
        program_id: coach.program_id,
        recruit_id: recruitId,
        flag,
      },
      { onConflict: "program_id,recruit_id" }
    )
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
  const { id: recruitId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error, count } = await supabase
    .from("coach_recruit_flags")
    .delete()
    .eq("recruit_id", recruitId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!count || count === 0) {
    return NextResponse.json(
      { success: true, message: "No flag found to delete" },
      { status: 200 }
    );
  }

  return NextResponse.json({ success: true, deleted: count });
}
