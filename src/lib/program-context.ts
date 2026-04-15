import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";

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
