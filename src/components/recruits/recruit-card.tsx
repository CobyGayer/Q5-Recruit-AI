"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DqsBadge } from "@/components/scoring/dqs-badge";
import { CompletenessIndicator } from "@/components/scoring/completeness-indicator";
import { FlagButton } from "./flag-button";
import type { RecruitWithScore } from "@/types/database";
import { MapPin, GraduationCap, Ruler, Video, AlertTriangle } from "lucide-react";

interface RecruitCardProps {
  recruit: RecruitWithScore;
}

const CLUB_LEVEL_LABELS: Record<string, string> = {
  mls_next: "MLS Next",
  ecnl: "ECNL",
  ga: "GA",
  regional: "Regional",
  other: "Other",
  unknown: "Unknown",
};

export function RecruitCard({ recruit }: RecruitCardProps) {
  const dqs = recruit.dqs_score;
  const hasLowConfidence = Object.values(recruit.extraction_confidence).some(
    (c) => c === "low"
  );

  return (
    <Link href={`/recruits/${recruit.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: Score + Name */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <DqsBadge
                score={dqs?.overall_score ?? null}
                isQualified={dqs?.is_qualified ?? true}
                disqualificationReasons={dqs?.disqualification_reasons}
                size="lg"
              />
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">
                  {recruit.full_name || "Unknown Name"}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {recruit.positions.length > 0 && (
                    <div className="flex gap-1">
                      {recruit.positions.map((pos) => (
                        <Badge key={pos} variant="secondary" className="text-xs">
                          {pos}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {recruit.graduation_year && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {recruit.graduation_year}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Flags */}
            <FlagButton
              recruitId={recruit.id}
              currentFlag={recruit.flag?.flag ?? null}
            />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
            {recruit.gpa != null && (
              <span>GPA: <strong className="text-foreground">{recruit.gpa.toFixed(1)}</strong></span>
            )}
            {recruit.height_inches != null && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                {Math.floor(recruit.height_inches / 12)}&apos;{recruit.height_inches % 12}&quot;
              </span>
            )}
            {recruit.club_level && recruit.club_level !== "unknown" && (
              <span>{CLUB_LEVEL_LABELS[recruit.club_level]}</span>
            )}
            {(recruit.city || recruit.state) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[recruit.city, recruit.state].filter(Boolean).join(", ")}
              </span>
            )}
            {recruit.video_url && (
              <span className="flex items-center gap-1 text-primary">
                <Video className="h-3 w-3" />
                Video
              </span>
            )}
          </div>

          {/* Bottom row: Completeness + badges */}
          <div className="flex items-center justify-between mt-3">
            <CompletenessIndicator
              fieldsExtracted={recruit.fields_extracted}
              fieldsTotal={recruit.fields_total}
              fieldsMissing={recruit.fields_missing}
            />
            {hasLowConfidence && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-50 text-amber-700 border-amber-200"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Needs Review
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
