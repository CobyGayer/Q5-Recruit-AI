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
import type { RecruitWithScore, FlagType } from "@/types/database";
import type { SortOption, SortDirection } from "@/types/recruit";
import { DEFAULT_SORT_DIRECTIONS } from "@/types/recruit";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Video, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";

interface RecruitListViewProps {
  recruits: RecruitWithScore[];
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSort: (field: SortOption) => void;
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

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/** Column definition for sortable table headers */
interface SortableColumn {
  label: string;
  sortKey: SortOption | null;
  className?: string;
}

const COLUMNS: SortableColumn[] = [
  { label: "", sortKey: null, className: "w-10" },
  { label: "DQS", sortKey: "dqs", className: "w-14" },
  { label: "Name", sortKey: "name" },
  { label: "Pos", sortKey: null },
  { label: "Year", sortKey: "grad_year", className: "w-16" },
  { label: "GPA", sortKey: "gpa", className: "w-14" },
  { label: "Height", sortKey: "height", className: "w-16" },
  { label: "Club", sortKey: null },
  { label: "Location", sortKey: null },
  { label: "Video", sortKey: null, className: "w-14" },
  { label: "Data", sortKey: "completeness", className: "w-20" },
];

function SortableHeader({
  column,
  sortBy,
  sortDirection,
  onSort,
}: {
  column: SortableColumn;
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSort: (field: SortOption) => void;
}) {
  const isActive = column.sortKey === sortBy;
  const isSortable = column.sortKey !== null;

  return (
    <TableHead
      className={`text-[10px] uppercase tracking-wider ${column.className ?? ""} ${
        isSortable ? "cursor-pointer select-none hover:text-foreground group" : ""
      }`}
      onClick={isSortable ? () => onSort(column.sortKey!) : undefined}
    >
      {column.label ? (
        <div className="flex items-center gap-1">
          {column.label}
          {isSortable &&
            (isActive ? (
              sortDirection === "asc" ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            ))}
        </div>
      ) : null}
    </TableHead>
  );
}

export function RecruitListView({
  recruits,
  sortBy,
  sortDirection,
  onSort,
  onFlagChange,
}: RecruitListViewProps) {
  const router = useRouter();

  function handleSort(field: SortOption) {
    onSort(field);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((col, i) => (
            <SortableHeader
              key={i}
              column={col}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          ))}
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
              className="cursor-pointer h-14"
              onClick={() => router.push(`/recruits/${recruit.id}`)}
            >
              <TableCell>
                <FlagButton
                  recruitId={recruit.id}
                  currentFlag={recruit.flag?.flag ?? null}
                  onFlagChange={(flag) => onFlagChange?.(recruit.id, flag)}
                />
              </TableCell>
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
                        variant="outline"
                        className="text-xs border-primary/40 text-primary"
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
