"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProgramConfig } from "@/types/database";

export function useConfig() {
  const [config, setConfig] = useState<ProgramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      setConfig(data);
    } else {
      setError("Failed to load config");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, refetch: fetchConfig };
}
