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
  if (score >= 80) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-gray-100 text-gray-800 border-gray-300";
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
              className={`${sizeClasses[size]} bg-red-50 text-red-700 border-red-300`}
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
        className={`${sizeClasses[size]} bg-gray-50 text-gray-500`}
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
