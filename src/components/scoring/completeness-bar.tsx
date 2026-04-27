import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCompletenessBarClass } from "@/lib/scoring/colors";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";
import type { ClubLevel, ProgramConfig } from "@/types/database";

interface CompletenessBarProps {
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

export function CompletenessBar({
  fieldsExtracted,
  fieldsTotal,
  fieldsMissing = [],
  programConfig,
  clubLevel,
}: CompletenessBarProps) {
  const adjusted = adjustCompletenessForWeights(
    fieldsMissing,
    fieldsExtracted,
    fieldsTotal,
    programConfig,
    clubLevel
  );
  const pct = adjusted.ratio * 100;
  const barClass = getCompletenessBarClass(pct);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full h-0.5 bg-border/40 rounded-full overflow-hidden cursor-help">
            <div
              className={`h-full rounded-full transition-all opacity-50 ${barClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent
          sideOffset={6}
          className="bg-white text-foreground border border-border/60 shadow-lg rounded-lg max-w-xs p-3 [&>:last-child]:hidden"
        >
          <p className="font-medium text-xs text-foreground">
            {adjusted.extracted} of {adjusted.total} fields filled
          </p>
          {adjusted.missing.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Missing
              </p>
              <div className="flex flex-wrap gap-1">
                {adjusted.missing.map((field) => (
                  <span
                    key={field}
                    className="text-[10px] bg-stone-100 text-stone-500 rounded-md px-1.5 py-0.5"
                  >
                    {FIELD_LABELS[field] ?? field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
