import type { ConfidenceLevel } from "@/types/database";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
}

const COLORS: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-rose-500",
};

const LABELS: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — verify this field",
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span
      title={LABELS[confidence]}
      className={`inline-block w-2 h-2 rounded-full ${COLORS[confidence]}`}
    />
  );
}
