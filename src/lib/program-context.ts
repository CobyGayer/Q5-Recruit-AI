import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";

/**
 * Resolves the effective program ID and DB client for a given user,
 * applying the admin program override cookie when present.
 * Returns null if the coach has no program_id set.
 */
export async function getEffectiveProgramContext(
  supabase: SupabaseClient,
  userId: string
): Promise<{ effectiveProgramId: string; db: SupabaseClient } | null> {
  const { data: coach } = await supabase
    .from("coaches")
    .select("program_id, role")
    .eq("id", userId)
    .single();

  if (!coach?.program_id) return null;

  const overrideProgramId = await getAdminProgramOverride(coach.role);
  const effectiveProgramId = overrideProgramId ?? coach.program_id;
  const db: SupabaseClient = overrideProgramId ? createAdminClient() : supabase;

  return { effectiveProgramId, db };
}
