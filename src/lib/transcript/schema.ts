import { z } from "zod";

const CourseAnalysisSchema = z.object({
  honors_ap_ib_count: z.number().int().min(0),
  total_academic_courses: z.number().int().min(0),
  rigor_ratio: z.number().min(0).max(1),
  strongest_subjects: z.array(z.string()),
  weakest_subjects: z.array(z.string()),
  notable_courses: z.array(z.string()),
});

const GradeTrendsSchema = z.object({
  direction: z.enum(["improving", "declining", "stable", "inconsistent"]),
  freshman_gpa_estimate: z.number().min(0).max(5).nullable(),
  senior_gpa_estimate: z.number().min(0).max(5).nullable(),
  notes: z.string(),
});

export const TranscriptAnalysisResultSchema = z.object({
  rigor_score: z.number().min(0).max(100),
  course_analysis: CourseAnalysisSchema,
  grade_trends: GradeTrendsSchema,
  red_flags: z.array(z.string()),
  strengths: z.array(z.string()),
  schedule_assessment: z.string(),
  cumulative_gpa_from_transcript: z.number().min(0).max(5).nullable(),
  transcript_readable: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type TranscriptAnalysisResult = z.infer<typeof TranscriptAnalysisResultSchema>;
