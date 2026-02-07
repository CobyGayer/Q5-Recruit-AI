import type { ConfidenceLevel } from "@/types/database";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
}

const COLORS: Record<ConfidenceLevel, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
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
