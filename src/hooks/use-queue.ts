"use client";

import { useState, useEffect, useCallback } from "react";
import type { IngestedEmail } from "@/types/database";

export function useQueue() {
  const [emails, setEmails] = useState<IngestedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/queue");
    if (!res.ok) {
      setError("Failed to fetch queue");
    } else {
      setEmails(await res.json());
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { emails, loading, error, refetch: fetchQueue };
}
