import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bulkScanProgramForMissingFields } from "@/lib/recruits/missing-fields-queue";

/**
 * POST /api/admin/coaches/[id]/missing-fields-scan
 *
 * Temporary admin-only backfill trigger. Bulk-scans the target coach's entire
 * program for recruits with missing fields and queues pending review entries
 * so coaches are prompted on their next dashboard visit.
 *
 * Skips recruits already in the queue or with no weight-adjusted missing fields.
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

  const { data: admin } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  if (admin?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

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

  const queued = await bulkScanProgramForMissingFields(adminSupabase, targetCoach.program_id);

  return NextResponse.json({
    success: true,
    program_id: targetCoach.program_id,
    queued,
    message: `Scanned program for ${targetCoach.full_name}. ${queued} recruit(s) added to the missing-fields queue.`,
  });
}
