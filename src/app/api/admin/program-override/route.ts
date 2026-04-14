import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_PROGRAM_OVERRIDE_COOKIE } from "@/lib/admin-cookies";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const cookieStore = await cookies();
  const overrideProgramId = cookieStore.get(ADMIN_PROGRAM_OVERRIDE_COOKIE)?.value ?? null;

  if (!overrideProgramId) {
    return NextResponse.json({ programId: null, program: null });
  }

  const adminSupabase = createAdminClient();
  const { data: program } = await adminSupabase
    .from("programs")
    .select("*")
    .eq("id", overrideProgramId)
    .single();

  return NextResponse.json({ programId: overrideProgramId, program: program ?? null });
}

export async function POST(request: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { programId } = await request.json();
  if (!programId) {
    return NextResponse.json({ error: "programId is required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: program } = await adminSupabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .single();

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const response = NextResponse.json({ programId, program });
  response.cookies.set(ADMIN_PROGRAM_OVERRIDE_COOKIE, programId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_PROGRAM_OVERRIDE_COOKIE);
  return response;
}
