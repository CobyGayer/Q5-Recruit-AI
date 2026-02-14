import Anthropic from "@anthropic-ai/sdk";
import { ExtractionResultSchema, type ExtractionResultType } from "./schema";
import { buildExtractionPrompt } from "./prompt";
import type { ProcessingStatus, ClubLevel, ConfidenceLevel } from "@/types/database";
import { lookupClubLevel } from "@/lib/data/club-directory";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface ExtractionOutput {
  extractedData: ExtractionResultType;
  processingStatus: ProcessingStatus;
  recruitData: Record<string, unknown>;
  confidence: Record<string, ConfidenceLevel>;
  fieldsMissing: string[];
  fieldsExtracted: number;
}

/** All extractable field keys */
const EXTRACTABLE_FIELDS = [
  "full_name",
  "email",
  "phone",
  "graduation_year",
  "current_school",
  "city",
  "state",
  "country",
  "positions",
  "preferred_foot",
  "height_inches",
  "weight_lbs",
  "gpa",
  "sat_score",
  "act_score",
  "club_team",
  "club_level",
  "high_school_team",
  "video_url",
] as const;

/**
 * Extract structured recruit data from an email using Claude API.
 */
export async function extractRecruitData(
  subject: string | undefined,
  senderName: string | undefined,
  senderEmail: string | undefined,
  bodyPlain: string
): Promise<ExtractionOutput> {
  const prompt = buildExtractionPrompt(subject, senderName, senderEmail, bodyPlain);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text from response
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  // Parse JSON response
  let rawJson: unknown;
  try {
    // Handle potential markdown code block wrapping
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    rawJson = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse extraction response as JSON: ${textBlock.text.substring(0, 200)}`);
  }

  // Validate with Zod schema
  const parsed = ExtractionResultSchema.parse(rawJson);

  // Override club_level from authoritative directory when club_team is known
  if (parsed.club_team.value) {
    const directoryLevel = lookupClubLevel(parsed.club_team.value);
    if (directoryLevel) {
      parsed.club_level.value = directoryLevel;
      parsed.club_level.confidence = "high";
    }
  }

  // Process extraction results
  const confidence: Record<string, ConfidenceLevel> = {};
  const fieldsMissing: string[] = [];
  let fieldsExtracted = 0;
  let hasLowConfidence = false;

  for (const field of EXTRACTABLE_FIELDS) {
    const entry = parsed[field];
    if (entry.value != null) {
      fieldsExtracted++;
      confidence[field] = entry.confidence;
      if (entry.confidence === "low") {
        hasLowConfidence = true;
      }
    } else {
      fieldsMissing.push(field);
    }
  }

  // SAT and ACT are either/or — having one satisfies the test score requirement
  const hasSat = parsed.sat_score.value != null;
  const hasAct = parsed.act_score.value != null;
  if ((hasSat && !hasAct) || (!hasSat && hasAct)) {
    const missingTest = hasSat ? "act_score" : "sat_score";
    const idx = fieldsMissing.indexOf(missingTest);
    if (idx !== -1) {
      fieldsMissing.splice(idx, 1);
    }
  }

  // Determine processing status
  let processingStatus: ProcessingStatus;
  if (fieldsExtracted < 3) {
    processingStatus = "insufficient";
  } else if (hasLowConfidence) {
    processingStatus = "needs_review";
  } else {
    processingStatus = "processed";
  }

  // Build flat recruit data for database insertion
  const recruitData: Record<string, unknown> = {
    full_name: parsed.full_name.value,
    email: parsed.email.value ?? senderEmail,
    phone: parsed.phone.value,
    graduation_year: parsed.graduation_year.value,
    current_school: parsed.current_school.value,
    city: parsed.city.value,
    state: parsed.state.value,
    country: parsed.country.value ?? "USA",
    positions: parsed.positions.value ?? [],
    preferred_foot: parsed.preferred_foot.value,
    height_inches: parsed.height_inches.value,
    weight_lbs: parsed.weight_lbs.value,
    gpa: parsed.gpa.value,
    sat_score: parsed.sat_score.value,
    act_score: parsed.act_score.value,
    club_team: parsed.club_team.value,
    club_level: (parsed.club_level.value as ClubLevel) ?? "unknown",
    high_school_team: parsed.high_school_team.value,
    video_url: parsed.video_url.value,
    extraction_confidence: confidence,
    fields_missing: fieldsMissing,
    fields_extracted: fieldsExtracted,
    fields_total: (hasSat && !hasAct) || (!hasSat && hasAct)
      ? EXTRACTABLE_FIELDS.length - 1
      : EXTRACTABLE_FIELDS.length,
  };

  return {
    extractedData: parsed,
    processingStatus,
    recruitData,
    confidence,
    fieldsMissing,
    fieldsExtracted,
  };
}
