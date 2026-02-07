import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  if (coach?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  // Fetch stats
  const [coachesResult, emailsResult, recruitsResult] = await Promise.all([
    adminSupabase.from("coaches").select("id, status", { count: "exact" }),
    adminSupabase.from("ingested_emails").select("processing_status", { count: "exact" }),
    adminSupabase.from("recruits").select("fields_extracted"),
  ]);

  const coaches = coachesResult.data ?? [];
  const emails = emailsResult.data ?? [];
  const recruits = recruitsResult.data ?? [];

  const totalCoaches = coaches.length;
  const pendingCoaches = coaches.filter((c) => c.status === "pending").length;
  const totalEmails = emails.length;
  const processedEmails = emails.filter(
    (e) => e.processing_status === "processed"
  ).length;
  const failedEmails = emails.filter(
    (e) => e.processing_status === "failed"
  ).length;
  const needsReviewEmails = emails.filter(
    (e) => e.processing_status === "needs_review"
  ).length;

  const avgFieldsExtracted =
    recruits.length > 0
      ? recruits.reduce((sum, r) => sum + (r.fields_extracted ?? 0), 0) /
        recruits.length
      : 0;

  return NextResponse.json({
    total_coaches: totalCoaches,
    pending_coaches: pendingCoaches,
    total_emails: totalEmails,
    processed_emails: processedEmails,
    failed_emails: failedEmails,
    needs_review_emails: needsReviewEmails,
    avg_fields_extracted: avgFieldsExtracted,
  });
}
