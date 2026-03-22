import type { ConfidenceLevel, ClubLevel } from "./database";

/** A single extracted field with its confidence level */
export interface ExtractedField<T> {
  value: T | null;
  confidence: ConfidenceLevel;
}

/** Full extraction result from Claude API */
export interface ExtractionResult {
  full_name: ExtractedField<string>;
  email: ExtractedField<string>;
  phone: ExtractedField<string>;
  graduation_year: ExtractedField<number>;
  current_school: ExtractedField<string>;
  city: ExtractedField<string>;
  state: ExtractedField<string>;
  country: ExtractedField<string>;
  positions: ExtractedField<string[]>;
  preferred_foot: ExtractedField<string>;
  height_inches: ExtractedField<number>;
  weight_lbs: ExtractedField<number>;
  gpa: ExtractedField<number>;
  sat_score: ExtractedField<number>;
  act_score: ExtractedField<number>;
  club_team: ExtractedField<string>;
  club_level: ExtractedField<ClubLevel>;
  high_school_team: ExtractedField<string>;
  video_url: ExtractedField<string>;
}

/** Payload received from Zapier webhook */
export interface IngestEmailPayload {
  sender_email?: string;
  sender_name?: string;
  subject?: string;
  body_plain: string;
  body_html?: string;
  received_at?: string;
  attachments?: unknown[];
}
