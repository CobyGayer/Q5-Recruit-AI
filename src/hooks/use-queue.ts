"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { IngestedEmail } from "@/types/database";

export function useQueue() {
  const [emails, setEmails] = useState<IngestedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("ingested_emails")
      .select("*")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEmails(data ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { emails, loading, error, refetch: fetchQueue };
}
