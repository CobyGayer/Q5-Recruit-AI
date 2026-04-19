import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

/**
 * GET /api/recruits/duplicate-review/groups
 *
 * Returns all pending duplicate review groups for the current program,
 * each with the full recruit profiles of its members.
 * Used by the dashboard banner (?count_only=true) and the review page.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getEffectiveProgramContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No program context" }, { status: 400 });
  }

  const { effectiveProgramId, db } = ctx;

  // Fast path: dashboard banner only needs a count
  const countOnly = request.nextUrl.searchParams.get("count_only") === "true";
  if (countOnly) {
    const { count, error } = await db
      .from("recruit_duplicate_review_groups")
      .select("id", { count: "exact", head: true })
      .eq("program_id", effectiveProgramId)
      .eq("status", "pending");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: count ?? 0 });
  }

  // Fetch pending groups for this program
  const { data: groups, error: groupsError } = await db
    .from("recruit_duplicate_review_groups")
    .select("*")
    .eq("program_id", effectiveProgramId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (groupsError) {
    return NextResponse.json({ error: groupsError.message }, { status: 500 });
  }

  if (!groups || groups.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch members and their recruit profiles for each group
  const groupIds = groups.map((g) => g.id);

  const { data: members, error: membersError } = await db
    .from("recruit_duplicate_review_group_members")
    .select("group_id, recruit_id")
    .in("group_id", groupIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  // Gather all recruit IDs and fetch their full profiles
  const recruitIds = [...new Set((members ?? []).map((m) => m.recruit_id))];
  const { data: recruits, error: recruitsError } = recruitIds.length > 0
    ? await db
        .from("recruits")
        .select("*")
        .in("id", recruitIds)
    : { data: [], error: null };

  if (recruitsError) {
    return NextResponse.json({ error: recruitsError.message }, { status: 500 });
  }

  const recruitMap = new Map((recruits ?? []).map((r) => [r.id, r]));

  // Fetch ingested emails for each recruit (subject, sender address, date, body snippet)
  const { data: ingestedEmails } = recruitIds.length > 0
    ? await db
        .from("ingested_emails")
        .select("id, recruit_id, sender_email, subject, received_at, body_plain")
        .in("recruit_id", recruitIds)
        .order("received_at", { ascending: false })
    : { data: [] };

  // Build a map of recruit_id -> email messages
  const emailsMap = new Map<string, { id: string; sender_email: string | null; subject: string | null; received_at: string | null; body_snippet: string | null }[]>();
  for (const row of ingestedEmails ?? []) {
    if (!row.recruit_id) continue;
    const existing = emailsMap.get(row.recruit_id) ?? [];
    existing.push({
      id: row.id,
      sender_email: row.sender_email ?? null,
      subject: row.subject ?? null,
      received_at: row.received_at ?? null,
      body_snippet: row.body_plain ? row.body_plain.trim() : null,
    });
    emailsMap.set(row.recruit_id, existing);
  }

  // Assemble response
  const result = groups.map((group) => {
    const groupMembers = (members ?? [])
      .filter((m) => m.group_id === group.id)
      .map((m) => {
        const recruit = recruitMap.get(m.recruit_id);
        if (!recruit) return null;
        return { ...recruit, recruit_emails: emailsMap.get(recruit.id) ?? [] };
      })
      .filter(Boolean);

    return { ...group, members: groupMembers };
  });

  return NextResponse.json(result);
}
