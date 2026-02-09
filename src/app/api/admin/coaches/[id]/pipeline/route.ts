import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/utils/api-key";
import type { EmailPipelineStatus } from "@/types/database";

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
  const adminSupabase = createAdminClient();

  // Generate a new API key for this coach
  if (body.action === "generate_api_key") {
    const rawKey = generateApiKey();
    const hashedKey = hashApiKey(rawKey);

    const { error } = await adminSupabase
      .from("coaches")
      .update({ api_key: hashedKey })
      .eq("id", coachId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ api_key: rawKey });
  }

  // Update the email pipeline status
  if (body.action === "update_pipeline_status") {
    const status = body.status as EmailPipelineStatus;
    if (!["not_started", "pending_setup", "active"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await adminSupabase
      .from("coaches")
      .update({ email_pipeline_status: status })
      .eq("id", coachId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
