import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/scoring/completeness", () => ({ adjustCompletenessForWeights: vi.fn() }));

import { maybeQueueMissingFieldsRequest } from "@/lib/recruits/missing-fields-queue";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";

const mockAdjust = vi.mocked(adjustCompletenessForWeights);

function makeChain(result: { data?: unknown; error?: unknown } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "upsert", "is", "limit", "order"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeDb(responses: Array<{ data?: unknown; error?: unknown }> = []) {
  const fromFn = vi.fn();
  for (const r of responses) fromFn.mockReturnValueOnce(makeChain(r));
  fromFn.mockReturnValue(makeChain());
  return { from: fromFn } as unknown as SupabaseClient;
}

const RECRUIT_ID = "recruit-1";
const PROGRAM_ID = "prog-1";
const COACH_ID = "coach-1";
const RECRUIT_DATA = {
  fields_missing: ["gpa", "positions"],
  fields_extracted: 3,
  fields_total: 5,
  club_level: null,
};

beforeEach(() => vi.clearAllMocks());

describe("maybeQueueMissingFieldsRequest", () => {
  it("returns false when recruit not found", async () => {
    const db = makeDb([{ data: null }, { data: null }]);
    const result = await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(result).toBe(false);
    expect(mockAdjust).not.toHaveBeenCalled();
  });

  it("returns false when all missing fields excluded by weights", async () => {
    const db = makeDb([{ data: RECRUIT_DATA }, { data: null }]);
    mockAdjust.mockReturnValue({ missing: [], extracted: 3, total: 5, percentage: 60 });
    const result = await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(result).toBe(false);
    expect(db.from as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2);
  });

  it("queues MLS division when club level is mls_next", async () => {
    const recruit = { ...RECRUIT_DATA, club_level: "mls_next" };
    const recruitChain = makeChain({ data: recruit });
    const configChain = makeChain({ data: null });
    const upsertChain = makeChain({ data: [{ id: "queue-row-mls" }], error: null });
    const fromFn = vi.fn()
      .mockReturnValueOnce(recruitChain)
      .mockReturnValueOnce(configChain)
      .mockReturnValueOnce(upsertChain);
    const db = { from: fromFn } as unknown as SupabaseClient;

    mockAdjust.mockReturnValue({ missing: [], extracted: 3, total: 5, percentage: 60 });
    const result = await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(result).toBe(true);
    expect(upsertChain.upsert).toHaveBeenCalled();
    const payload = (upsertChain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.missing_fields_snapshot).toEqual(["mls_division"]);
  });

  it("returns false when upsert errors", async () => {
    const db = makeDb([
      { data: RECRUIT_DATA },
      { data: null },
      { data: null, error: { message: "unique violation" } },
    ]);
    mockAdjust.mockReturnValue({ missing: ["gpa"], extracted: 3, total: 5, percentage: 60 });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[missing-fields-queue] insert failed:",
      "unique violation"
    );
    consoleSpy.mockRestore();
  });

  it("returns false when upsert returns empty array (already queued)", async () => {
    const db = makeDb([
      { data: RECRUIT_DATA },
      { data: null },
      { data: [], error: null },
    ]);
    mockAdjust.mockReturnValue({ missing: ["gpa"], extracted: 3, total: 5, percentage: 60 });
    const result = await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(result).toBe(false);
  });

  it("returns true when new row inserted", async () => {
    const db = makeDb([
      { data: RECRUIT_DATA },
      { data: { weight_gpa: 1 } },
      { data: [{ id: "queue-row-1" }], error: null },
    ]);
    mockAdjust.mockReturnValue({ missing: ["gpa"], extracted: 3, total: 5, percentage: 60 });
    const result = await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(result).toBe(true);
  });

  it("passes config to adjustCompletenessForWeights", async () => {
    const config = { weight_gpa: 2 };
    const db = makeDb([
      { data: RECRUIT_DATA },
      { data: config },
      { data: [], error: null },
    ]);
    mockAdjust.mockReturnValue({ missing: [], extracted: 3, total: 5, percentage: 60 });
    await maybeQueueMissingFieldsRequest(db, RECRUIT_ID, PROGRAM_ID, COACH_ID);
    expect(mockAdjust).toHaveBeenCalledWith(
      RECRUIT_DATA.fields_missing,
      RECRUIT_DATA.fields_extracted,
      RECRUIT_DATA.fields_total,
      config,
      null
    );
  });
});
