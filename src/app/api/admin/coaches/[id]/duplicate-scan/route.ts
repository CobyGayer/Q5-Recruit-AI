import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bulkScanProgramForDuplicates } from "@/lib/recruits/duplicate-review";

/**
 * POST /api/admin/coaches/[id]/duplicate-scan
 *
 * Temporary admin-only backfill trigger. Bulk-scans the target coach's entire
 * program for same-name recruit clusters and queues pending duplicate review
 * groups so coaches are prompted on their next dashboard visit.
 *
 * This route does NOT merge anything — it only queues reviews.
 */
export async function POST(
  _request: NextRequest,
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

  // Validate admin role
  const { data: admin } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  if (admin?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  // Resolve the target coach's program
  const { data: targetCoach, error: fetchError } = await adminSupabase
    .from("coaches")
    .select("id, full_name, program_id")
    .eq("id", coachId)
    .single();

  if (fetchError || !targetCoach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  if (!targetCoach.program_id) {
    return NextResponse.json(
      { error: "Coach is not assigned to a program" },
      { status: 400 }
    );
  }

  const groupsQueued = await bulkScanProgramForDuplicates(adminSupabase, targetCoach.program_id);

  return NextResponse.json({
    success: true,
    program_id: targetCoach.program_id,
    groups_queued: groupsQueued,
    message: `Scanned program for ${targetCoach.full_name}. ${groupsQueued} duplicate review group(s) queued.`,
  });
}
