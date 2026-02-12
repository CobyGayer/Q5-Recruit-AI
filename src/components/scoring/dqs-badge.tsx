import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DqsBadgeProps {
  score: number | null;
  isQualified: boolean;
  disqualificationReasons?: string[];
  size?: "sm" | "md" | "lg";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-stone-100 text-stone-600 border-stone-200";
}

export function DqsBadge({
  score,
  isQualified,
  disqualificationReasons = [],
  size = "md",
}: DqsBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-lg px-3 py-1.5 font-bold",
  };

  if (!isQualified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant="outline"
              className={`${sizeClasses[size]} bg-rose-50 text-rose-600 border-rose-200`}
            >
              NQ
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium mb-1">Not Qualified</p>
            <ul className="text-xs space-y-0.5">
              {disqualificationReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (score == null) {
    return (
      <Badge
        variant="outline"
        className={`${sizeClasses[size]} bg-stone-50 text-stone-400`}
      >
        --
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`${sizeClasses[size]} ${getScoreColor(score)}`}
    >
      {Math.round(score)}
    </Badge>
  );
}
