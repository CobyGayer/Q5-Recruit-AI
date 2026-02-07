import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CompletenessIndicatorProps {
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

export function CompletenessIndicator({
  fieldsExtracted,
  fieldsTotal,
  fieldsMissing = [],
}: CompletenessIndicatorProps) {
  const percentage = fieldsTotal > 0 ? (fieldsExtracted / fieldsTotal) * 100 : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Progress value={percentage} className="h-1.5 w-16" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {fieldsExtracted}/{fieldsTotal}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium mb-1">
            {fieldsExtracted} of {fieldsTotal} fields extracted
          </p>
          {fieldsMissing.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mb-1">Missing:</p>
              <div className="flex flex-wrap gap-1">
                {fieldsMissing.map((field) => (
                  <span
                    key={field}
                    className="text-xs bg-gray-100 rounded px-1.5 py-0.5"
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
