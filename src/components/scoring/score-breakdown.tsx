"use client";

import type { RecruitDqsScore, RigorGrade } from "@/types/database";
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
}

const COMPONENT_LABELS: Record<string, string> = {
  academic: "Academic",
  competition: "Competition Level",
  physical: "Physical",
  position_fit: "Position Fit",
  grad_year: "Grad Year Fit",
  completeness: "Completeness",
};

function ScoreBar({ label, score, badge }: { label: string; score: number | null; badge?: React.ReactNode }) {
  const displayScore = score ?? 0;
  const barWidth = Math.max(0, Math.min(100, displayScore));

  const barColor = score != null ? getScoreBarClass(score) : "bg-stone-300";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {label}
          {badge}
        </span>
        <span className="font-medium">
          {score != null ? Math.round(score) : "N/A"}
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

export function ScoreBreakdown({ score, rigorGrade }: ScoreBreakdownProps) {
  const components = [
    { key: "academic", score: score.academic_score },
    { key: "competition", score: score.competition_score },
    { key: "physical", score: score.physical_score },
    { key: "position_fit", score: score.position_fit_score },
    { key: "grad_year", score: score.grad_year_score },
    { key: "completeness", score: score.completeness_score },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {components.map((comp) => (
          <ScoreBar
            key={comp.key}
            label={COMPONENT_LABELS[comp.key]}
            score={comp.score}
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
          <div className="flex justify-between">
            <span className="text-primary">Bonus Points</span>
            <span className="font-medium text-primary">
              +{score.bonus_points}
            </span>
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
