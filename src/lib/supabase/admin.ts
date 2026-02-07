import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side operations
 * that need to bypass RLS (e.g., API routes with API key auth).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
