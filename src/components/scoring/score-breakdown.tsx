"use client";

import type { RecruitDqsScore } from "@/types/database";

interface ScoreBreakdownProps {
  score: RecruitDqsScore;
}

const COMPONENT_LABELS: Record<string, string> = {
  academic: "Academic",
  competition: "Competition Level",
  physical: "Physical",
  position_fit: "Position Fit",
  grad_year: "Grad Year Fit",
  completeness: "Completeness",
};

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const displayScore = score ?? 0;
  const barWidth = Math.max(0, Math.min(100, displayScore));

  let barColor = "bg-gray-300";
  if (score != null) {
    if (score >= 80) barColor = "bg-green-500";
    else if (score >= 60) barColor = "bg-yellow-500";
    else barColor = "bg-gray-400";
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {score != null ? Math.round(score) : "N/A"}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
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
          />
        ))}
      </div>

      <div className="border-t pt-3 space-y-1 text-sm">
        {score.bonus_points > 0 && (
          <div className="flex justify-between">
            <span className="text-green-600">Bonus Points</span>
            <span className="font-medium text-green-600">
              +{score.bonus_points}
            </span>
          </div>
        )}
        {score.completeness_penalty > 0 && (
          <div className="flex justify-between">
            <span className="text-orange-600">Completeness Penalty</span>
            <span className="font-medium text-orange-600">
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
