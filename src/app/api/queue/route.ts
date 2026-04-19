import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

export async function GET() {
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

  const { data, error } = await db
    .from("ingested_emails")
    .select("*")
    .eq("program_id", effectiveProgramId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
