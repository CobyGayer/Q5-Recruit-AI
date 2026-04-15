"use client";

import { useState, useEffect, useCallback } from "react";
import type { RecruitWithScore, FlagType } from "@/types/database";

export function useRecruits() {
  const [recruits, setRecruits] = useState<RecruitWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecruits = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/recruits");
    if (!res.ok) {
      setError("Failed to fetch recruits");
      setLoading(false);
      return;
    }

    const data: RecruitWithScore[] = await res.json();

    // Sort by DQS score (highest first), then by name
    data.sort((a, b) => {
      const scoreA = a.dqs_score?.overall_score ?? -1;
      const scoreB = b.dqs_score?.overall_score ?? -1;
      return scoreB - scoreA;
    });

    setRecruits(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecruits();
  }, [fetchRecruits]);

  /** Optimistically update a recruit's flag in local state (DB write happens in FlagButton) */
  const updateRecruitFlag = useCallback(
    (recruitId: string, newFlag: FlagType | null) => {
      setRecruits((prev) =>
        prev.map((r) =>
          r.id === recruitId
            ? {
                ...r,
                flag: newFlag
                  ? { ...r.flag, recruit_id: recruitId, flag: newFlag } as RecruitWithScore["flag"]
                  : null,
              }
            : r
        )
      );
    },
    []
  );

  return { recruits, loading, error, refetch: fetchRecruits, updateRecruitFlag };
}
