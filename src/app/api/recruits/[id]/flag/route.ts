import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";
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

  const ctx = await getEffectiveProgramContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }
  const { effectiveProgramId, db } = ctx;

  const { data, error } = await db
    .from("coach_recruit_flags")
    .upsert(
      {
        coach_id: user.id,
        program_id: effectiveProgramId,
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
  _request: NextRequest,
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

  const ctx = await getEffectiveProgramContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
  }
  const { effectiveProgramId, db } = ctx;

  const { error, count } = await db
    .from("coach_recruit_flags")
    .delete()
    .eq("recruit_id", recruitId)
    .eq("program_id", effectiveProgramId);

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
