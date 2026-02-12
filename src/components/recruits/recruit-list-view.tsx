"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DqsBadge } from "@/components/scoring/dqs-badge";
import { CompletenessIndicator } from "@/components/scoring/completeness-indicator";
import { FlagButton } from "./flag-button";
import type { RecruitWithScore } from "@/types/database";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Video } from "lucide-react";

interface RecruitListViewProps {
  recruits: RecruitWithScore[];
}

const CLUB_LEVEL_LABELS: Record<string, string> = {
  mls_next: "MLS Next",
  ecnl: "ECNL",
  ga: "GA",
  regional: "Regional",
  other: "Other",
  unknown: "Unknown",
};

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function RecruitListView({ recruits }: RecruitListViewProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">DQS</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Pos</TableHead>
          <TableHead className="w-16">Year</TableHead>
          <TableHead className="w-14">GPA</TableHead>
          <TableHead className="w-16">Height</TableHead>
          <TableHead>Club</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="w-14">Video</TableHead>
          <TableHead className="w-24">Data</TableHead>
          <TableHead className="w-20"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recruits.map((recruit) => {
          const dqs = recruit.dqs_score;
          const hasLowConfidence = Object.values(
            recruit.extraction_confidence
          ).some((c) => c === "low");

          return (
            <TableRow
              key={recruit.id}
              className="cursor-pointer"
              onClick={() => router.push(`/recruits/${recruit.id}`)}
            >
              <TableCell>
                <DqsBadge
                  score={dqs?.overall_score ?? null}
                  isQualified={dqs?.is_qualified ?? true}
                  disqualificationReasons={dqs?.disqualification_reasons}
                  size="sm"
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {recruit.full_name || "Unknown Name"}
                  {hasLowConfidence && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>Needs review</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {recruit.positions.length > 0 ? (
                  <div className="flex gap-1">
                    {recruit.positions.map((pos) => (
                      <Badge
                        key={pos}
                        variant="secondary"
                        className="text-xs"
                      >
                        {pos}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {recruit.graduation_year ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {recruit.gpa != null ? (
                  recruit.gpa.toFixed(1)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {recruit.height_inches != null ? (
                  formatHeight(recruit.height_inches)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {recruit.club_level && recruit.club_level !== "unknown" ? (
                  CLUB_LEVEL_LABELS[recruit.club_level]
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {recruit.city || recruit.state ? (
                  [recruit.city, recruit.state].filter(Boolean).join(", ")
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {recruit.video_url && (
                  <Video className="h-4 w-4 text-primary" />
                )}
              </TableCell>
              <TableCell>
                <CompletenessIndicator
                  fieldsExtracted={recruit.fields_extracted}
                  fieldsTotal={recruit.fields_total}
                  fieldsMissing={recruit.fields_missing}
                />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <FlagButton
                  recruitId={recruit.id}
                  currentFlag={recruit.flag?.flag ?? null}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
