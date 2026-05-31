import Anthropic from "@anthropic-ai/sdk";
import type { Recruit, ProgramConfig } from "@/types/database";
import type { DQSResult } from "./dqs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export function formatSummaryScore(score: number | null, weight: number): string {
  if (weight === 0) {
    return "N/A";
  }

  return score != null ? String(Math.round(score)) : "N/A";
}

/**
 * Generate a 2-3 sentence scouting summary for a recruit using their
 * profile data and DQS scoring result. Uses Claude Haiku for speed/cost.
 * Returns null on failure (non-blocking — callers should not let this block scoring).
 */
export async function generateDQSSummary(
  recruit: Recruit,
  config: ProgramConfig,
  dqsResult: DQSResult
): Promise<string | null> {
  const prompt = buildSummaryPrompt(recruit, config, dqsResult);

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[AI Summary] No text response from Claude API");
      return null;
    }

    return textBlock.text.trim();
  } catch (err) {
    console.error("[AI Summary] Generation failed:", err);
    return null;
  }
}

function buildSummaryPrompt(
  recruit: Recruit,
  config: ProgramConfig,
  dqsResult: DQSResult
): string {
  const heightStr =
    recruit.height_inches != null
      ? `${Math.floor(recruit.height_inches / 12)}'${recruit.height_inches % 12}"`
      : "not provided";

  // Identify coach's top-weighted scoring components
  const weights = [
    { name: "academic", value: config.weight_academic },
    { name: "competition level", value: config.weight_competition },
    { name: "physical attributes", value: config.weight_physical },
    { name: "position fit", value: config.weight_position_fit },
    { name: "graduation year fit", value: config.weight_grad_year },
    { name: "profile completeness", value: config.weight_completeness },
  ].sort((a, b) => b.value - a.value);
  const topPriorities = weights
    .slice(0, 3)
    .map((w) => w.name)
    .join(", ");

  return `You are a college soccer scout writing a brief scouting note. Write 1-2 short sentences max. Be specific — reference actual data points. Mention the most important strength, the biggest concern or gap, and nothing else.

RULES:
- Extremely concise. No filler, no generic praise ("great candidate", "solid player").
- Reference specific numbers (GPA, test scores, height, club level).
- If the recruit is disqualified, state the reason in one sentence.
- If key data is missing, note the most important gap only.

RECRUIT PROFILE:
- Name: ${recruit.full_name || "Unknown"}
- Position(s): ${recruit.positions.length > 0 ? recruit.positions.join(", ") : "not provided"}
- Graduation Year: ${recruit.graduation_year ?? "not provided"}
- GPA: ${recruit.gpa ?? "not provided"}
- SAT: ${recruit.sat_score ?? "not provided"}
- ACT: ${recruit.act_score ?? "not provided"}
- Height: ${heightStr}
- Club Team: ${recruit.club_team ?? "not provided"}
- Club Level: ${recruit.club_level !== "unknown" ? recruit.club_level.replace("_", " ").toUpperCase() : "not provided"}
- Location: ${[recruit.city, recruit.state].filter(Boolean).join(", ") || "not provided"}
- Video: ${recruit.video_url ? "provided" : "not provided"}
- Missing Fields: ${recruit.fields_missing.length > 0 ? recruit.fields_missing.join(", ") : "none"}

DQS SCORING RESULT:
- Overall Score: ${dqsResult.score != null ? `${dqsResult.score}/100` : "N/A (disqualified)"}
- Qualified: ${dqsResult.isQualified ? "Yes" : "No"}
${!dqsResult.isQualified ? `- Disqualification Reasons: ${dqsResult.disqualificationReasons.join("; ")}` : ""}
- Academic Score: ${formatSummaryScore(dqsResult.componentScores.academic, config.weight_academic)}
- Competition Score: ${formatSummaryScore(dqsResult.componentScores.competition, config.weight_competition)}
- Physical Score: ${formatSummaryScore(dqsResult.componentScores.physical, config.weight_physical)}
- Position Fit Score: ${formatSummaryScore(dqsResult.componentScores.positionFit, config.weight_position_fit)}
- Grad Year Score: ${formatSummaryScore(dqsResult.componentScores.gradYear, config.weight_grad_year)}
- Completeness Score: ${formatSummaryScore(dqsResult.componentScores.completeness, config.weight_completeness)}
- Fit Boost Points: ${dqsResult.bonusPoints}
- Completeness Penalty: ${dqsResult.completenessPenalty}%

COACH PRIORITIES (highest to lowest weight): ${topPriorities}

Write 1-2 short sentences only. No bullet points. No headers.`;
}
