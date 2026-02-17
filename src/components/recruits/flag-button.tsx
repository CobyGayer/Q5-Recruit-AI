"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { FlagType } from "@/types/database";
import { Star, ThumbsDown } from "lucide-react";

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

  async function handleFlag(e: React.MouseEvent, newFlag: FlagType) {
    e.preventDefault();
    e.stopPropagation();
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
    <div
      className="flex items-center gap-0.5"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${
          flag === "interested"
            ? "text-amber-500 hover:text-amber-600"
            : "text-stone-400 hover:text-amber-500"
        }`}
        onClick={(e) => handleFlag(e, "interested")}
        disabled={loading}
        title="Star recruit"
      >
        <Star
          className="h-4 w-4"
          fill={flag === "interested" ? "currentColor" : "none"}
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${
          flag === "not_a_fit"
            ? "text-rose-500 hover:text-rose-600"
            : "text-stone-400 hover:text-rose-500"
        }`}
        onClick={(e) => handleFlag(e, "not_a_fit")}
        disabled={loading}
        title="Not a fit"
      >
        <ThumbsDown
          className="h-3.5 w-3.5"
          fill={flag === "not_a_fit" ? "currentColor" : "none"}
        />
      </Button>
    </div>
  );
}
