import Anthropic from "@anthropic-ai/sdk";
import { TranscriptAnalysisResultSchema, type TranscriptAnalysisResult } from "./schema";
import { buildTranscriptAnalysisPrompt } from "./prompt";
import type { RigorGrade } from "@/types/database";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/** Map a 0-100 rigor score to a letter grade */
export function rigorScoreToGrade(score: number): RigorGrade {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 70) return "C";
  if (score >= 60) return "C-";
  return "D";
}

export interface TranscriptAnalysisOutput {
  result: TranscriptAnalysisResult;
  rigorGrade: RigorGrade;
}

/**
 * Analyze a PDF transcript using Claude's document vision API.
 * Returns null on any failure (non-blocking — pipeline continues without transcript data).
 */
export async function analyzeTranscript(
  pdfBase64: string
): Promise<TranscriptAnalysisOutput | null> {
  try {
    const prompt = buildTranscriptAnalysisPrompt();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract text from response
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn("[transcript] No text response from Claude API");
      return null;
    }

    // Parse JSON response
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const rawJson = JSON.parse(jsonText);
    const result = TranscriptAnalysisResultSchema.parse(rawJson);
    const rigorGrade = rigorScoreToGrade(result.rigor_score);

    return { result, rigorGrade };
  } catch (err) {
    console.warn("[transcript] Analysis failed:", err);
    return null;
  }
}
