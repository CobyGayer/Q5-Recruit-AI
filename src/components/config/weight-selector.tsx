"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { WeightFormData } from "@/types/config";

interface WeightSelectorProps {
  data: WeightFormData;
  onChange: (data: WeightFormData) => void;
}

const COMPONENT_LABELS: Record<keyof WeightFormData, { label: string; description: string }> = {
  weight_academic: {
    label: "Academic Strength",
    description: "GPA and standardized test scores",
  },
  weight_competition: {
    label: "Competition Level",
    description: "Club league tier (MLS NEXT, ECNL, etc.)",
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
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  const percentages: Record<string, number> = {};
  for (const [key, val] of Object.entries(data)) {
    percentages[key] = total > 0 ? Math.round((val / total) * 100) : 0;
  }
  return percentages;
}

export function WeightSelector({ data, onChange }: WeightSelectorProps) {
  const percentages = calculatePercentages(data);

  function setWeight(key: keyof WeightFormData, value: number) {
    onChange({ ...data, [key]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Priority Weights</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag each slider to set how important each scoring component is for
          your program. The system will normalize these into percentages
          automatically.
        </p>
      </div>

      <div className="space-y-4">
        {(Object.keys(COMPONENT_LABELS) as Array<keyof WeightFormData>).map(
          (key) => {
            const { label, description } = COMPONENT_LABELS[key];
            return (
              <div key={key} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium w-8 text-right">
                      {data[key]}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      ({percentages[key]}%)
                    </span>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[data[key]]}
                  onValueChange={([val]) => setWeight(key, val)}
                />
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
