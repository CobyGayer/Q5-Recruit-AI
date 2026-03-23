import { z } from "zod";

const ConfidenceEnum = z.enum(["high", "medium", "low"]);

const ClubLevelEnum = z.enum([
  "mls_next",
  "ecnl",
  "ga",
  "regional",
  "other",
  "unknown",
]);

/** Schema for a single extracted field with confidence */
function extractedField<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: ConfidenceEnum,
  });
}

/** Full extraction result schema from Claude API */
export const ExtractionResultSchema = z.object({
  full_name: extractedField(z.string()),
  email: extractedField(z.string()),
  phone: extractedField(z.string()),
  graduation_year: extractedField(z.number()),
  current_school: extractedField(z.string()),
  city: extractedField(z.string()),
  state: extractedField(z.string()),
  country: extractedField(z.string()),
  positions: extractedField(z.array(z.string())),
  preferred_foot: extractedField(z.string()),
  height_inches: extractedField(z.number()),
  weight_lbs: extractedField(z.number()),
  gpa: extractedField(z.number()),
  sat_score: extractedField(z.number()),
  act_score: extractedField(z.number()),
  club_team: extractedField(z.string()),
  club_level: extractedField(ClubLevelEnum),
  high_school_team: extractedField(z.string()),
  video_url: extractedField(z.string()),
});

export type ExtractionResultType = z.infer<typeof ExtractionResultSchema>;

/** Payload from Zapier webhook */
export const IngestPayloadSchema = z.object({
  sender_email: z.string().optional(),
  sender_name: z.string().optional(),
  subject: z.string().optional(),
  body_plain: z.string().min(1, "Email body is required"),
  body_html: z.string().optional(),
  received_at: z.string().optional(),
  attachments: z.union([z.array(z.any()), z.string(), z.any()]).optional(),
});
