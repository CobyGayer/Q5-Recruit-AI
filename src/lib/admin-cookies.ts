import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const ADMIN_PROGRAM_OVERRIDE_COOKIE = "admin_program_override";

/**
 * Returns the override program_id for an admin user, or null if:
 * - the user is not an admin
 * - no override cookie is set
 * - the cookie value references a program that no longer exists
 */
export async function getAdminProgramOverride(role: string): Promise<string | null> {
  if (role !== "admin") return null;

  const cookieStore = await cookies();
  const overrideProgramId = cookieStore.get(ADMIN_PROGRAM_OVERRIDE_COOKIE)?.value ?? null;
  if (!overrideProgramId) return null;

  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from("programs")
    .select("id")
    .eq("id", overrideProgramId)
    .single();

  return data ? overrideProgramId : null;
}
