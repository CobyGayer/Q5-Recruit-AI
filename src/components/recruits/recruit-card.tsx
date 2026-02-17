"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DqsBadge } from "@/components/scoring/dqs-badge";
import { FlagButton } from "./flag-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GraduationCap, Ruler, Shield, MapPin } from "lucide-react";
import type { RecruitWithScore, FlagType } from "@/types/database";

interface RecruitCardProps {
  recruit: RecruitWithScore;
  onFlagChange?: (recruitId: string, flag: FlagType | null) => void;
}

const CLUB_LEVEL_LABELS: Record<string, string> = {
  mls_next: "MLS Next",
  ecnl: "ECNL",
  ga: "GA",
  regional: "Regional",
  other: "Other",
  unknown: "Unknown",
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  email: "Email",
  phone: "Phone",
  graduation_year: "Grad Year",
  current_school: "School",
  city: "City",
  state: "State",
  country: "Country",
  positions: "Position(s)",
  preferred_foot: "Preferred Foot",
  height_inches: "Height",
  weight_lbs: "Weight",
  gpa: "GPA",
  sat_score: "SAT",
  act_score: "ACT",
  club_team: "Club Team",
  club_level: "Club Level",
  high_school_team: "HS Team",
  video_url: "Video",
};

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function RecruitCard({ recruit, onFlagChange }: RecruitCardProps) {
  const dqs = recruit.dqs_score;

  // Build filtered stats — only include non-empty values
  const stats: { icon: React.ReactNode; value: string; truncate?: boolean }[] = [];

  if (recruit.gpa != null) {
    stats.push({
      icon: <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
      value: recruit.gpa.toFixed(1),
    });
  }

  if (recruit.height_inches != null) {
    stats.push({
      icon: <Ruler className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
      value: formatHeight(recruit.height_inches),
    });
  }

  if (recruit.club_level && recruit.club_level !== "unknown") {
    stats.push({
      icon: <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
      value: CLUB_LEVEL_LABELS[recruit.club_level],
    });
  }

  if (recruit.city || recruit.state) {
    stats.push({
      icon: <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
      value: [recruit.city, recruit.state].filter(Boolean).join(", "),
      truncate: true,
    });
  }


  return (
    <Link href={`/recruits/${recruit.id}`} className="block h-full">
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/10 py-0 gap-0 h-full">
        <CardContent className="px-3 py-4 sm:px-4 sm:py-5">
          {/* Row 1: Score badge + Name + Flag buttons */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center shrink-0">
              <DqsBadge
                score={dqs?.overall_score ?? null}
                isQualified={dqs?.is_qualified ?? true}
                disqualificationReasons={dqs?.disqualification_reasons}
                size="md"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-muted-foreground mt-0.5 cursor-help">
                      {recruit.fields_extracted}/{recruit.fields_total}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3">
                    <p className="font-medium text-xs">
                      {recruit.fields_extracted} of {recruit.fields_total} fields filled
                    </p>
                    {recruit.fields_missing.length > 0 && (
                      <div className="mt-1.5">
                        <p className="text-[10px] text-white/50 mb-1">Missing</p>
                        <div className="flex flex-wrap gap-1">
                          {recruit.fields_missing.map((field) => (
                            <span
                              key={field}
                              className="text-[10px] bg-white/10 text-white/70 rounded px-1.5 py-0.5"
                            >
                              {FIELD_LABELS[field] ?? field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">
                  {recruit.full_name || "Unknown Name"}
                </h3>
                {recruit.graduation_year && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    &apos;{String(recruit.graduation_year).slice(-2)}
                  </span>
                )}
              </div>
              {recruit.positions.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {recruit.positions.map((pos) => (
                    <Badge
                      key={pos}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-primary/40 text-primary"
                    >
                      {pos}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0">
              <FlagButton
                recruitId={recruit.id}
                currentFlag={recruit.flag?.flag ?? null}
                onFlagChange={(flag) => onFlagChange?.(recruit.id, flag)}
              />
            </div>
          </div>

          {/* Row 2: Horizontal stats with icons */}
          {stats.length > 0 && (
            <div className="flex items-center gap-3 mt-2 ml-[52px] overflow-hidden">
              {stats.map((stat, i) => (
                <div key={i} className={`flex items-center gap-1 ${stat.truncate ? "min-w-0" : "shrink-0"}`}>
                  {stat.icon}
                  <span className={`text-xs text-muted-foreground ${stat.truncate ? "truncate" : ""}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>
    </Link>
  );
}
