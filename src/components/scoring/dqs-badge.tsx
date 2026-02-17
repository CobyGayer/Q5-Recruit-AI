import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getScoreBadgeClass } from "@/lib/scoring/colors";

interface DqsBadgeProps {
  score: number | null;
  isQualified: boolean;
  disqualificationReasons?: string[];
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs rounded-lg",
  md: "w-10 h-10 text-sm rounded-xl",
  lg: "w-12 h-12 text-lg rounded-xl",
};

export function DqsBadge({
  score,
  isQualified,
  disqualificationReasons = [],
  size = "md",
}: DqsBadgeProps) {
  if (!isQualified) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div
              className={`${sizeClasses[size]} bg-rose-500 text-white flex items-center justify-center font-bold shrink-0`}
            >
              NQ
            </div>
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
      <div
        className={`${sizeClasses[size]} bg-muted text-muted-foreground flex items-center justify-center font-bold shrink-0`}
      >
        --
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${getScoreBadgeClass(score)} flex items-center justify-center font-bold shrink-0`}
    >
      {Math.round(score)}
    </div>
  );
}
