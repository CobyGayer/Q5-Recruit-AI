"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DqsBadge } from "@/components/scoring/dqs-badge";
import { CompletenessBar } from "@/components/scoring/completeness-bar";
import { FlagButton } from "./flag-button";
import { Play } from "lucide-react";
import type { RecruitWithScore, FlagType, ProgramConfig } from "@/types/database";
import { POSITIONS } from "@/types/config";
import { getDisplayLeagueLabel } from "@/lib/data/league-preferences";


interface RecruitCardProps {
  recruit: RecruitWithScore;
  onFlagChange?: (recruitId: string, flag: FlagType | null) => void;
  selected?: boolean;
  onToggleSelect?: (recruitId: string) => void;
  programConfig?: ProgramConfig | null;
}

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

interface Stat {
  label: string;
  value: string;
  truncate?: boolean;
  icon?: React.ReactNode;
}

/** Priority-ordered list of stats to display — first available wins */
function getAvailableStats(recruit: RecruitWithScore): Stat[] {
  const all: (Stat | null)[] = [
    recruit.gpa != null
      ? { label: "GPA", value: recruit.gpa.toFixed(1) }
      : null,
    recruit.height_inches != null
      ? { label: "Height", value: formatHeight(recruit.height_inches) }
      : null,
    recruit.club_level
      ? { label: "League", value: getDisplayLeagueLabel(recruit) }
      : null,
    recruit.city || recruit.state
      ? {
          label: "Location",
          value: [recruit.city, recruit.state].filter(Boolean).join(", "),
          truncate: true,
        }
      : null,
    recruit.video_url
      ? {
          label: "Video",
          value: "has video",
          icon: <Play className="h-3.5 w-3.5 text-primary" />,
        }
      : null,
  ];

  return all.filter((s): s is Stat => s !== null).slice(0, 4);
}

function StatCell({ label, value, truncate, icon }: Stat) {
  return (
    <div className="flex flex-col items-center text-center min-w-0 flex-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </span>
      <span
        className={`text-xs font-medium mt-0.5 leading-tight text-foreground ${
          truncate ? "truncate max-w-full" : ""
        }`}
        title={truncate ? value : undefined}
      >
        {icon ?? value}
      </span>
    </div>
  );
}

export function RecruitCard({ recruit, onFlagChange, selected, onToggleSelect, programConfig }: RecruitCardProps) {
  const dqs = recruit.dqs_score;
  const stats = getAvailableStats(recruit);

  return (
    <Link href={`/recruits/${recruit.id}`} className="block h-full">
      <Card className={`hover:shadow-md hover:border-primary/20 transition-all duration-150 cursor-pointer border-primary/10 py-0 gap-0 h-full flex flex-col ${selected ? "ring-2 ring-primary/50 border-primary/30" : ""}`}>
        <CardContent className="px-3 py-3 sm:px-4 sm:py-4 flex-1 flex flex-col">
          {/* Zone 1: Identity Header */}
          <div className="flex items-start gap-3">
            {onToggleSelect && (
              <div
                className="shrink-0 flex items-center pt-0.5"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect(recruit.id);
                }}
              >
                <Checkbox checked={selected} />
              </div>
            )}
            <div className="shrink-0">
              <DqsBadge
                score={dqs?.overall_score ?? null}
                isQualified={dqs?.is_qualified ?? true}
                disqualificationReasons={dqs?.disqualification_reasons}
                size="md"
              />
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
              {(() => {
                const knownPositions = recruit.positions.filter((pos) => (POSITIONS as readonly string[]).includes(pos));
                return knownPositions.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {knownPositions.map((pos) => (
                    <Badge
                      key={pos}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-primary/40 text-primary"
                    >
                      {pos}
                    </Badge>
                  ))}
                </div>
              );})()}
            </div>

            <div className="shrink-0">
              <FlagButton
                recruitId={recruit.id}
                currentFlag={recruit.flag?.flag ?? null}
                onFlagChange={(flag) => onFlagChange?.(recruit.id, flag)}
              />
            </div>
          </div>

          {/* Zone 2: Available Stats */}
          {stats.length > 0 && (
            <>
              <div className="border-t border-border/50 my-2.5" />
              <div className="flex gap-1">
                {stats.map((stat) => (
                  <StatCell key={stat.label} {...stat} />
                ))}
              </div>
            </>
          )}
        </CardContent>

        {/* Zone 3: Completeness Bar */}
        <div className="px-3 pb-2 sm:px-4 mt-auto">
          <CompletenessBar
            fieldsExtracted={recruit.fields_extracted}
            fieldsTotal={recruit.fields_total}
            fieldsMissing={recruit.fields_missing}
            programConfig={programConfig}
            clubLevel={recruit.club_level}
          />
        </div>
      </Card>
    </Link>
  );
}
