import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();
  if (coach?.role !== "admin") return null;
  return user;
}

export async function GET() {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("programs")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, institution, domain, division, conference } = body;

  if (!name || !institution || !domain) {
    return NextResponse.json(
      { error: "name, institution, and domain are required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("programs")
    .insert({ name, institution, domain: domain.toLowerCase().trim(), division: division || null, conference: conference || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
