"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { FlagType } from "@/types/database";
import { Star, X } from "lucide-react";

interface FlagButtonProps {
  recruitId: string;
  currentFlag: FlagType | null;
  onFlagChange?: (flag: FlagType | null) => void;
}

export function FlagButton({
  recruitId,
  currentFlag,
  onFlagChange,
}: FlagButtonProps) {
  const [flag, setFlag] = useState<FlagType | null>(currentFlag);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleFlag(newFlag: FlagType) {
    setLoading(true);
    const targetFlag = flag === newFlag ? null : newFlag;

    if (targetFlag === null) {
      // Remove flag
      await supabase
        .from("coach_recruit_flags")
        .delete()
        .eq("recruit_id", recruitId);
    } else {
      // Upsert flag
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("coach_recruit_flags").upsert(
          {
            coach_id: user.id,
            recruit_id: recruitId,
            flag: targetFlag,
          },
          { onConflict: "coach_id,recruit_id" }
        );
      }
    }

    setFlag(targetFlag);
    onFlagChange?.(targetFlag);
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 ${
          flag === "interested"
            ? "text-yellow-500 hover:text-yellow-600"
            : "text-gray-400 hover:text-yellow-500"
        }`}
        onClick={() => handleFlag("interested")}
        disabled={loading}
        title="Mark as interested"
      >
        <Star
          className="h-4 w-4"
          fill={flag === "interested" ? "currentColor" : "none"}
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 ${
          flag === "not_a_fit"
            ? "text-red-500 hover:text-red-600"
            : "text-gray-400 hover:text-red-500"
        }`}
        onClick={() => handleFlag("not_a_fit")}
        disabled={loading}
        title="Mark as not a fit"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
