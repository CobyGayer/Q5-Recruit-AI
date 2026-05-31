"use client";

import type { ProgramConfig, RecruitDqsScore, RigorGrade } from "@/types/database";
import { getScoreBarClass } from "@/lib/scoring/colors";

const RIGOR_GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 text-emerald-800",
  A: "bg-emerald-100 text-emerald-800",
  "A-": "bg-emerald-100 text-emerald-800",
  "B+": "bg-blue-100 text-blue-800",
  B: "bg-blue-100 text-blue-800",
  "B-": "bg-blue-100 text-blue-800",
  "C+": "bg-amber-100 text-amber-800",
  C: "bg-amber-100 text-amber-800",
  "C-": "bg-red-100 text-red-800",
  D: "bg-red-100 text-red-800",
};

interface ScoreBreakdownProps {
  score: RecruitDqsScore;
  rigorGrade?: RigorGrade | null;
  programConfig?: Pick<
    ProgramConfig,
    | "weight_academic"
    | "weight_competition"
    | "weight_physical"
    | "weight_position_fit"
    | "weight_grad_year"
    | "weight_completeness"
  > | null;
}

const COMPONENT_LABELS: Record<string, string> = {
  academic: "Academic",
  competition: "Competition Level",
  physical: "Physical",
  position_fit: "Position Fit",
  grad_year: "Grad Year Fit",
  completeness: "Completeness",
};

type ScoreComponentKey = keyof typeof COMPONENT_LABELS;

const COMPONENT_WEIGHT_KEYS: Record<
  ScoreComponentKey,
  keyof Pick<
    ProgramConfig,
    | "weight_academic"
    | "weight_competition"
    | "weight_physical"
    | "weight_position_fit"
    | "weight_grad_year"
    | "weight_completeness"
  >
> = {
  academic: "weight_academic",
  competition: "weight_competition",
  physical: "weight_physical",
  position_fit: "weight_position_fit",
  grad_year: "weight_grad_year",
  completeness: "weight_completeness",
};

export function getScoreDisplayValue(
  score: number | null,
  programConfig: ScoreBreakdownProps["programConfig"],
  componentKey: ScoreComponentKey
): string {
  const weightKey = COMPONENT_WEIGHT_KEYS[componentKey];
  const isZeroWeighted = programConfig?.[weightKey] === 0;

  if (isZeroWeighted) {
    return "NA";
  }

  return score != null ? String(Math.round(score)) : "N/A";
}

function ScoreBar({
  label,
  score,
  displayValue,
  badge,
}: {
  label: string;
  score: number | null;
  displayValue: string;
  badge?: React.ReactNode;
}) {
  const isUnavailable = displayValue === "NA" || displayValue === "N/A";
  const displayScore = isUnavailable ? 0 : score ?? 0;
  const barWidth = Math.max(0, Math.min(100, displayScore));

  const barColor =
    !isUnavailable && score != null ? getScoreBarClass(score) : "bg-stone-300";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {label}
          {badge}
        </span>
        <span className="font-medium">
          {displayValue}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreBreakdown({ score, rigorGrade, programConfig }: ScoreBreakdownProps) {
  const components = [
    { key: "academic", score: score.academic_score },
    { key: "competition", score: score.competition_score },
    { key: "physical", score: score.physical_score },
    { key: "position_fit", score: score.position_fit_score },
    { key: "grad_year", score: score.grad_year_score },
    { key: "completeness", score: score.completeness_score },
  ];

  const rawBoostReasons = (score.score_breakdown as Record<string, unknown> | null)?.bonus;
  const boostReasons = Array.isArray(rawBoostReasons)
    ? (rawBoostReasons.filter((r): r is string => typeof r === "string"))
    : [];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {components.map((comp) => (
          <ScoreBar
            key={comp.key}
            label={COMPONENT_LABELS[comp.key]}
            score={comp.score}
            displayValue={getScoreDisplayValue(
              comp.score,
              programConfig,
              comp.key as ScoreComponentKey
            )}
            badge={
              comp.key === "academic" && rigorGrade ? (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${RIGOR_GRADE_COLORS[rigorGrade]}`}
                  title="Transcript rigor grade"
                >
                  {rigorGrade}
                </span>
              ) : undefined
            }
          />
        ))}
      </div>

      <div className="border-t pt-3 space-y-1 text-sm">
        {score.bonus_points > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-primary">Fit Boosts</span>
              <span className="font-medium text-primary">
                +{score.bonus_points}
              </span>
            </div>
            {boostReasons.length > 0 && (
              <ul className="text-[11px] leading-snug text-muted-foreground space-y-0.5 pl-0.5">
                {boostReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {score.completeness_penalty > 0 && (
          <div className="flex justify-between">
            <span className="text-amber-600">Completeness Penalty</span>
            <span className="font-medium text-amber-600">
              -{score.completeness_penalty}%
            </span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-1 border-t">
          <span>Overall DQS</span>
          <span>
            {score.overall_score != null
              ? Math.round(score.overall_score)
              : "NQ"}
          </span>
        </div>
      </div>
    </div>
  );
}
