import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";
import type { ClubLevel, ProgramConfig } from "@/types/database";

interface CompletenessIndicatorProps {
  fieldsExtracted: number;
  fieldsTotal: number;
  fieldsMissing?: string[];
  programConfig?: ProgramConfig | null;
  clubLevel?: ClubLevel | null;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  email: "Email",
  phone: "Phone",
  graduation_year: "Grad Year",
  current_school: "School",
  city: "City",
  state: "State",
  country: "Country",
  positions: "Position(s)",
  preferred_foot: "Preferred Foot",
  height_inches: "Height",
  weight_lbs: "Weight",
  gpa: "GPA",
  sat_score: "SAT",
  act_score: "ACT",
  club_team: "Club Team",
  club_level: "Club Level",
  high_school_team: "HS Team",
  video_url: "Video",
};

export function CompletenessIndicator({
  fieldsExtracted,
  fieldsTotal,
  fieldsMissing = [],
  programConfig,
  clubLevel,
}: CompletenessIndicatorProps) {
  const adjusted = adjustCompletenessForWeights(
    fieldsMissing,
    fieldsExtracted,
    fieldsTotal,
    programConfig,
    clubLevel
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground whitespace-nowrap cursor-help">
            {adjusted.extracted}/{adjusted.total}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium mb-1">
            {adjusted.extracted} of {adjusted.total} fields extracted
          </p>
          {adjusted.missing.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mb-1">Missing:</p>
              <div className="flex flex-wrap gap-1">
                {adjusted.missing.map((field) => (
                  <span
                    key={field}
                    className="text-xs bg-muted rounded px-1.5 py-0.5"
                  >
                    {FIELD_LABELS[field] ?? field}
                  </span>
                ))}
              </div>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
