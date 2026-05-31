import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: createMock };
    constructor() {}
  },
}));

import { extractRecruitData } from "@/lib/extraction/extract";

const baseField = { value: null, confidence: "low" as const };

function makeExtractionInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    full_name: baseField,
    email: baseField,
    phone: baseField,
    graduation_year: baseField,
    current_school: baseField,
    city: baseField,
    state: baseField,
    country: baseField,
    positions: baseField,
    preferred_foot: baseField,
    height_inches: baseField,
    weight_lbs: baseField,
    gpa: { value: 4.5, confidence: "high" as const },
    sat_score: baseField,
    act_score: baseField,
    club_team: baseField,
    club_level: { value: null, confidence: "low" as const },
    high_school_team: baseField,
    video_url: baseField,
    ...overrides,
  };
}

describe("extractRecruitData GPA bounds", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("drops GPA values outside 0-4 for new extractions", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: makeExtractionInput(),
        },
      ],
    });

    const result = await extractRecruitData(
      "Intro",
      "Sam Recruit",
      "sam@example.com",
      "Here is my GPA: 4.5",
      false
    );

    expect(result.extractedData.gpa.value).toBeNull();
    expect(result.extractedData.gpa.confidence).toBe("low");
    expect(result.recruitData.gpa).toBeNull();
  });
});
