"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TIER_WEIGHTS } from "@/types/config";
import type { WeightFormData } from "@/types/config";
import type { PriorityTier } from "@/types/database";

interface WeightSelectorProps {
  data: WeightFormData;
  onChange: (data: WeightFormData) => void;
}

const TIERS: PriorityTier[] = ["critical", "high", "medium", "low"];

const TIER_LABELS: Record<PriorityTier, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TIER_COLORS: Record<PriorityTier, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-blue-100 text-blue-800 border-blue-300",
  low: "bg-gray-100 text-gray-800 border-gray-300",
};

const COMPONENT_LABELS: Record<keyof WeightFormData, { label: string; description: string }> = {
  weight_academic: {
    label: "Academic Strength",
    description: "GPA and standardized test scores",
  },
  weight_competition: {
    label: "Competition Level",
    description: "Club league tier (MLS Next, ECNL, etc.)",
  },
  weight_physical: {
    label: "Physical Attributes",
    description: "Height/weight relative to position",
  },
  weight_position_fit: {
    label: "Position Fit",
    description: "How well position matches your needs",
  },
  weight_grad_year: {
    label: "Graduation Year Fit",
    description: "Alignment with your recruiting timeline",
  },
  weight_completeness: {
    label: "Profile Completeness",
    description: "How many fields were extracted from the email",
  },
};

function calculatePercentages(data: WeightFormData): Record<string, number> {
  const total = (Object.values(data) as PriorityTier[]).reduce(
    (sum, tier) => sum + TIER_WEIGHTS[tier],
    0
  );
  const percentages: Record<string, number> = {};
  for (const [key, tier] of Object.entries(data) as [string, PriorityTier][]) {
    percentages[key] = total > 0 ? Math.round((TIER_WEIGHTS[tier] / total) * 100) : 0;
  }
  return percentages;
}

export function WeightSelector({ data, onChange }: WeightSelectorProps) {
  const percentages = calculatePercentages(data);

  function setWeight(key: keyof WeightFormData, tier: PriorityTier) {
    onChange({ ...data, [key]: tier });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Priority Weights</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Set how important each scoring component is for your program. The
          system will normalize these into percentages automatically.
        </p>
      </div>

      <div className="space-y-4">
        {(Object.keys(COMPONENT_LABELS) as Array<keyof WeightFormData>).map(
          (key) => {
            const { label, description } = COMPONENT_LABELS[key];
            return (
              <div key={key} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">
                    {percentages[key]}%
                  </span>
                </div>
                <div className="flex gap-2">
                  {TIERS.map((tier) => (
                    <Badge
                      key={tier}
                      variant="outline"
                      className={`cursor-pointer px-3 py-1 text-xs ${
                        data[key] === tier
                          ? TIER_COLORS[tier]
                          : "opacity-50 hover:opacity-75"
                      }`}
                      onClick={() => setWeight(key, tier)}
                    >
                      {TIER_LABELS[tier]}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          }
        )}
      </div>

      <div className="border rounded-lg p-4 bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Weight Preview</h4>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(COMPONENT_LABELS) as Array<keyof WeightFormData>).map(
            (key) => (
              <div key={key} className="text-xs">
                <span className="text-muted-foreground">
                  {COMPONENT_LABELS[key].label}:
                </span>{" "}
                <span className="font-medium">{percentages[key]}%</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
