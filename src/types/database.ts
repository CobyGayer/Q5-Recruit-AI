export type CoachStatus = "pending" | "approved" | "rejected";
export type ProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "needs_review"
  | "insufficient"
  | "failed";
export type ClubLevel =
  | "mls_next"
  | "ecnl"
  | "ga"
  | "regional"
  | "other"
  | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";
export type FlagType = "interested" | "not_a_fit";
export type RigorGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D";
export type GradeTrend = "improving" | "declining" | "stable" | "inconsistent";
export type EmailMethod = "gmail" | "outlook" | "mailto" | "clipboard";
export type EmailPipelineStatus = "not_started" | "pending_setup" | "active";

export interface HeightRange {
  min?: number;
  max?: number;
}

export interface Program {
  id: string;
  name: string;
  institution: string;
  domain: string;
  division: string | null;
  conference: string | null;
  created_at: string;
  updated_at: string;
}

export interface Coach {
  id: string;
  program_id: string | null;
  full_name: string;
  email: string;
  role: "coach" | "admin";
  status: CoachStatus;
  api_key: string | null;
  onboarding_completed: boolean;
  email_pipeline_status: EmailPipelineStatus;
  missing_fields_email_subject: string | null;
  missing_fields_email_body: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramConfig {
  id: string;
  program_id: string;
  updated_by_coach_id: string | null;
  // Section A: Minimum Thresholds
  min_gpa: number | null;
  min_sat: number | null;
  min_act: number | null;
  min_height_by_position: Record<string, number>;
  accepted_grad_years: number[];
  accepted_positions: string[];
  preferred_foot_by_position: Record<string, "Either" | "Right" | "Left">;
  preferred_height_range_by_position: Record<string, HeightRange>;
  // Fit boost magnitudes (points awarded when a soft preference matches)
  boost_preferred_foot: number;
  boost_preferred_height: number;
  // Section B: Priority Weights (0-100 sliders)
  weight_academic: number;
  weight_competition: number;
  weight_physical: number;
  weight_position_fit: number;
  weight_grad_year: number;
  weight_completeness: number;
  // Section C: Roster Context
  high_need_positions: Record<string, Array<{ position: string; rank: number }>>;
  priority_grad_years: Array<{ year: number; rank: number }>;
  roster_spots: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface IngestedEmail {
  id: string;
  coach_id: string;
  program_id: string;
  recruit_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  subject: string | null;
  body_plain: string | null;
  body_html: string | null;
  received_at: string | null;
  attachments: string[];
  processing_status: ProcessingStatus;
  extracted_data: Record<string, unknown> | null;
  extraction_error: string | null;
  created_at: string;
}

export interface Recruit {
  id: string;
  coach_id: string;
  program_id: string;
  email: string | null;
  full_name: string | null;
  name_key: string | null;
  phone: string | null;
  graduation_year: number | null;
  current_school: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  positions: string[];
  preferred_foot: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  gpa: number | null;
  sat_score: number | null;
  act_score: number | null;
  club_team: string | null;
  club_level: ClubLevel;
  high_school_team: string | null;
  video_url: string | null;
  extraction_confidence: Record<string, ConfidenceLevel>;
  fields_missing: string[];
  fields_extracted: number;
  fields_total: number;
  created_at: string;
  updated_at: string;
}

export interface RecruitDqsScore {
  id: string;
  recruit_id: string;
  coach_id: string;
  program_id: string;
  overall_score: number | null;
  is_qualified: boolean;
  disqualification_reasons: string[];
  academic_score: number | null;
  competition_score: number | null;
  physical_score: number | null;
  position_fit_score: number | null;
  grad_year_score: number | null;
  completeness_score: number | null;
  bonus_points: number;
  completeness_penalty: number;
  score_breakdown: Record<string, unknown>;
  ai_summary: string | null;
  calculated_at: string;
}

export interface CoachRecruitFlag {
  id: string;
  coach_id: string;
  program_id: string;
  recruit_id: string;
  flag: FlagType;
  created_at: string;
}

export interface EmailLog {
  id: string;
  coach_id: string;
  recruit_id: string;
  subject: string;
  body: string;
  method: EmailMethod;
  created_at: string;
}

export interface TranscriptAnalysis {
  id: string;
  recruit_id: string;
  coach_id: string;
  email_id: string | null;
  rigor_grade: RigorGrade;
  rigor_score: number;
  confidence: ConfidenceLevel;
  transcript_readable: boolean;
  honors_ap_ib_count: number;
  total_academic_courses: number;
  rigor_ratio: number;
  strongest_subjects: string[];
  weakest_subjects: string[];
  notable_courses: string[];
  grade_trend: GradeTrend | null;
  freshman_gpa_estimate: number | null;
  senior_gpa_estimate: number | null;
  grade_trend_notes: string | null;
  red_flags: string[];
  strengths: string[];
  schedule_assessment: string | null;
  cumulative_gpa_from_transcript: number | null;
  raw_analysis: Record<string, unknown>;
  analyzed_at: string;
}

/** Recruit joined with its DQS score and flag for dashboard display */
export interface RecruitWithScore extends Recruit {
  dqs_score: RecruitDqsScore | null;
  flag: CoachRecruitFlag | null;
}

export type DuplicateReviewGroupStatus = "pending" | "resolved" | "dismissed";
export type DuplicateReviewGroupSource = "ingest" | "admin_scan";

export interface DuplicateReviewGroup {
  id: string;
  program_id: string;
  name_key: string;
  status: DuplicateReviewGroupStatus;
  source: DuplicateReviewGroupSource;
  resolved_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateReviewGroupMember {
  id: string;
  group_id: string;
  recruit_id: string;
  added_at: string;
}

/** A review group together with its full member recruit profiles */
export interface DuplicateReviewGroupWithMembers extends DuplicateReviewGroup {
  members: Recruit[];
}
