import Anthropic from "@anthropic-ai/sdk";
import { ExtractionResultSchema, type ExtractionResultType } from "./schema";
import { buildExtractionPrompt } from "./prompt";
import type { ProcessingStatus, ClubLevel, ConfidenceLevel } from "@/types/database";
import { lookupClubLevel } from "@/lib/data/club-directory";
import { normalizeEmail } from "@/lib/utils/email";
import { POSITIONS } from "@/types/config";

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

export function shouldInferGaAspireClubLevel(params: {
  subject?: string;
  bodyPlain: string;
  isBoys?: boolean;
  directoryLevel: ClubLevel;
}): boolean {
  if (params.isBoys !== false) {
    return false;
  }

  const emailText = [params.subject ?? "", params.bodyPlain].join(" ").toLowerCase();
  if (!/\baspire\b/.test(emailText)) {
    return false;
  }

  return params.directoryLevel === "ga" || params.directoryLevel === "unknown";
}

export function shouldInferEcrlClubLevel(params: {
  subject?: string;
  bodyPlain: string;
  isBoys?: boolean;
  directoryLevel: ClubLevel;
}): boolean {
  if (params.isBoys !== false) {
    return false;
  }

  const emailText = [params.subject ?? "", params.bodyPlain].join(" ").toLowerCase();
  if (!/\b(?:ecrl|ecnl[-\s]?rl|ecnl\s+regional)\b/.test(emailText)) {
    return false;
  }

  return params.directoryLevel === "ecnl";
}

export function shouldInferMlsNextSublevel(params: {
  subject?: string;
  bodyPlain: string;
  isBoys?: boolean;
  directoryLevel: ClubLevel;
  originalClubLevel?: ClubLevel | null;
}): boolean {
  // Only consider for boys or when isBoys omitted (MLS NEXT is primarily boys data)
  // but allow checks regardless — caller can pass isBoys as needed
  const emailText = [params.subject ?? "", params.bodyPlain].join(" ").toLowerCase();

  // Explicit cues we accept for sublevel inference
  const explicitCue = /\bhome-?grown\b|\bmls\s*next\s*academy\b|\bhomegrown academy\b/;

  const hasCue = explicitCue.test(emailText);

  // Feature flag to allow permissive acceptance of LLM sublevels even without explicit cue
  const permissive = process.env.ENABLE_MLS_NEXT_SUBLEVEL_INFERENCE === "true";

  // Only consider when the model returned a MLS Next sublevel
  if (params.originalClubLevel !== "mls_next_homegrown" && params.originalClubLevel !== "mls_next_academy") {
    return false;
  }

  // Accept the sublevel if we have an explicit cue or the feature-flag is enabled
  return hasCue || permissive;
}

/** All extractable field keys */
export const EXTRACTABLE_FIELDS = [
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

const EXTRACT_RECRUIT_TOOL: Anthropic.Tool = {
  name: "extract_recruit_data",
  description: "Extract structured recruit information from a soccer recruiting email.",
  input_schema: {
    type: "object",
    properties: {
      full_name: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      email: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      phone: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      graduation_year: {
        type: "object",
        properties: { value: { type: ["number", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      current_school: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      city: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      state: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      country: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      positions: {
        type: "object",
        properties: {
          value: { type: ["array", "null"], items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      preferred_foot: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      height_inches: {
        type: "object",
        properties: { value: { type: ["number", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      weight_lbs: {
        type: "object",
        properties: { value: { type: ["number", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      gpa: {
        type: "object",
        properties: { value: { type: ["number", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      sat_score: {
        type: "object",
        properties: { value: { type: ["number", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      act_score: {
        type: "object",
        properties: { value: { type: ["number", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      club_team: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      club_level: {
        type: "object",
        properties: {
          value: { type: ["string", "null"], enum: ["mls_next", "mls_next_homegrown", "mls_next_academy", "ecnl", "ecrl", "ga", "ga_aspire", "regional", "other", "unknown", null] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      high_school_team: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
      video_url: {
        type: "object",
        properties: { value: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["value", "confidence"],
        additionalProperties: false,
      },
    },
    required: [
      "full_name", "email", "phone", "graduation_year", "current_school",
      "city", "state", "country", "positions", "preferred_foot",
      "height_inches", "weight_lbs", "gpa", "sat_score", "act_score",
      "club_team", "club_level", "high_school_team", "video_url",
    ],
    additionalProperties: false,
  },
};

/**
 * Extract structured recruit data from an email using Claude API.
 * 
 * @param subject Email subject line
 * @param senderName Email sender name
 * @param senderEmail Email sender address
 * @param bodyPlain Plain text email body
 * @param isForwarded Whether the email was forwarded
 * @param isBoys Optional: true for boys club directory, false for girls; defaults to true
 */
export async function extractRecruitData(
  subject: string | undefined,
  senderName: string | undefined,
  senderEmail: string | undefined,
  bodyPlain: string,
  isForwarded?: boolean,
  isBoys?: boolean
): Promise<ExtractionOutput> {
  const prompt = buildExtractionPrompt(subject, senderName, senderEmail, bodyPlain, isForwarded);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    tools: [EXTRACT_RECRUIT_TOOL],
    tool_choice: { type: "tool", name: "extract_recruit_data" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = message.content.find((block) => block.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("No tool_use response from Claude API");
  }

  // Validate with Zod schema
  const parsed = ExtractionResultSchema.parse(toolBlock.input);
  const originalClubLevel = parsed.club_level.value as ClubLevel | null;

  // Override club_level from authoritative directory when club_team is known.
  // Use gender-specific lookup if isBoys flag is provided.
  const directoryLevel = parsed.club_team.value
    ? lookupClubLevel(
        parsed.club_team.value,
        isBoys !== undefined ? isBoys : true
      )
    : "unknown";

  if (parsed.club_team.value) {
    if (directoryLevel !== "unknown") {
      // If the directory maps to MLS Next and the LLM originally returned
      // a MLS Next sublevel, only accept the more specific LLM result when
      // explicit cues are present or the permissive feature-flag is enabled.
      if (
        directoryLevel === "mls_next" &&
        (originalClubLevel === "mls_next_homegrown" || originalClubLevel === "mls_next_academy")
      ) {
        if (shouldInferMlsNextSublevel({ subject, bodyPlain, isBoys, directoryLevel, originalClubLevel })) {
          parsed.club_level.value = originalClubLevel;
          // keep the model-provided confidence
        } else {
          parsed.club_level.value = directoryLevel;
          parsed.club_level.confidence = "high";
        }
      } else {
        parsed.club_level.value = directoryLevel;
        parsed.club_level.confidence = "high";
      }
    } else {
      parsed.club_level.value = "unknown";
      parsed.club_level.confidence = "low";
    }
  }

  if (shouldInferGaAspireClubLevel({
    subject,
    bodyPlain,
    isBoys,
    directoryLevel,
  })) {
    parsed.club_level.value = "ga_aspire";
    parsed.club_level.confidence = "high";
  }

  if (shouldInferEcrlClubLevel({
    subject,
    bodyPlain,
    isBoys,
    directoryLevel,
  })) {
    parsed.club_level.value = "ecrl";
    parsed.club_level.confidence = "high";
  }

  // Filter positions to recognized values only — unrecognized strings (e.g. "forward")
  // are treated as if the field was not found.
  if (parsed.positions.value != null) {
    const recognized = parsed.positions.value.filter((pos) =>
      (POSITIONS as readonly string[]).includes(pos)
    );
    parsed.positions.value = recognized.length > 0 ? recognized : null;
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

  // SAT and ACT count as a single completeness slot. If both are present, the
  // pair still contributes only once to completeness.
  const hasSat = parsed.sat_score.value != null;
  const hasAct = parsed.act_score.value != null;
  if (hasSat && hasAct) {
    fieldsExtracted--;
  } else if (hasSat !== hasAct) {
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
    email: normalizeEmail(parsed.email.value ?? (isForwarded ? null : senderEmail)),
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
    fields_total: EXTRACTABLE_FIELDS.length - 1,
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
