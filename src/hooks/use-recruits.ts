"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RecruitWithScore, FlagType } from "@/types/database";

export function useRecruits() {
  const [recruits, setRecruits] = useState<RecruitWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchRecruits = useCallback(async () => {
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

    // Fetch recruits with their DQS scores and flags
    const { data: recruitData, error: recruitError } = await supabase
      .from("recruits")
      .select("*")
      .order("created_at", { ascending: false });

    if (recruitError) {
      setError(recruitError.message);
      setLoading(false);
      return;
    }

    // Fetch scores
    const { data: scores } = await supabase
      .from("recruit_dqs_scores")
      .select("*");

    // Fetch flags
    const { data: flags } = await supabase
      .from("coach_recruit_flags")
      .select("*");

    // Join data
    const scoresMap = new Map(scores?.map((s) => [s.recruit_id, s]) ?? []);
    const flagsMap = new Map(flags?.map((f) => [f.recruit_id, f]) ?? []);

    const joined: RecruitWithScore[] = (recruitData ?? []).map((r) => ({
      ...r,
      dqs_score: scoresMap.get(r.id) ?? null,
      flag: flagsMap.get(r.id) ?? null,
    }));

    // Sort by DQS score (highest first), then by name
    joined.sort((a, b) => {
      const scoreA = a.dqs_score?.overall_score ?? -1;
      const scoreB = b.dqs_score?.overall_score ?? -1;
      return scoreB - scoreA;
    });

    setRecruits(joined);
    setLoading(false);
  }, [supabase]);

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
