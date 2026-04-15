import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

/**
 * GET /api/recruits/duplicate-review/groups
 *
 * Returns all pending duplicate review groups for the current program,
 * each with the full recruit profiles of its members.
 * Used by the dashboard banner and the review page.
 */
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
    return NextResponse.json({ error: "No program context" }, { status: 400 });
  }

  const { effectiveProgramId, db } = ctx;

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

  // Assemble response
  const result = groups.map((group) => {
    const groupMembers = (members ?? [])
      .filter((m) => m.group_id === group.id)
      .map((m) => recruitMap.get(m.recruit_id))
      .filter(Boolean);

    return { ...group, members: groupMembers };
  });

  return NextResponse.json(result);
}
