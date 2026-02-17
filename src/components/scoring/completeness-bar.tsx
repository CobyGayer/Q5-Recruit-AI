import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCompletenessBarClass } from "@/lib/scoring/colors";

interface CompletenessBarProps {
  fieldsExtracted: number;
  fieldsTotal: number;
  fieldsMissing?: string[];
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

/**
 * SAT and ACT are alternative test scores — having either one satisfies
 * the requirement. If only one is in fieldsMissing, the other was extracted,
 * so we drop the missing one from display and adjust the counts.
 */
function adjustForAlternativeFields(
  missing: string[],
  extracted: number,
  total: number
): { missing: string[]; extracted: number; total: number } {
  const hasMissingSat = missing.includes("sat_score");
  const hasMissingAct = missing.includes("act_score");

  // Only one is missing → the other was found, so drop the missing one
  if (hasMissingSat !== hasMissingAct) {
    const drop = hasMissingSat ? "sat_score" : "act_score";
    return {
      missing: missing.filter((f) => f !== drop),
      extracted,
      total: total - 1,
    };
  }

  return { missing, extracted, total };
}

export function CompletenessBar({
  fieldsExtracted,
  fieldsTotal,
  fieldsMissing = [],
}: CompletenessBarProps) {
  const adjusted = adjustForAlternativeFields(
    fieldsMissing,
    fieldsExtracted,
    fieldsTotal
  );
  const pct =
    adjusted.total > 0 ? (adjusted.extracted / adjusted.total) * 100 : 0;
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
