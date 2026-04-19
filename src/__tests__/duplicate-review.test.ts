import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkAndQueueDuplicateReview,
  bulkScanProgramForDuplicates,
} from "@/lib/recruits/duplicate-review";

/**
 * Chainable Supabase query builder mock.
 * Supports both direct await (thenable) and terminal methods (.single, .maybeSingle, .upsert).
 */
function makeChain(result: { data?: unknown; error?: unknown; count?: number } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "update", "delete"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  // Thenable: covers `await db.from(...).select(...).eq(...)` without a terminal method
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

/** Build a mock Supabase client. Each entry in `responses` is consumed by successive from() calls. */
function makeDb(responses: Array<{ data?: unknown; error?: unknown; count?: number }> = []) {
  const fromFn = vi.fn();
  for (const r of responses) fromFn.mockReturnValueOnce(makeChain(r));
  fromFn.mockReturnValue(makeChain()); // default: empty success
  return { from: fromFn } as unknown as SupabaseClient;
}

const PROG = "prog-1";
const RID = "recruit-1";

// ---------------------------------------------------------------------------
// checkAndQueueDuplicateReview
// ---------------------------------------------------------------------------

describe("checkAndQueueDuplicateReview — name unchanged", () => {
  it("no dismissed group → returns immediately without creating anything", async () => {
    const db = makeDb([{ data: null }]); // dismissed check → none
    await checkAndQueueDuplicateReview(db, PROG, RID, "john smith", "john smith");
    expect((db.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("dismissed group exists but only 1 recruit → does not resurface", async () => {
    const db = makeDb([
      { data: { id: "dismissed-1" } },   // dismissed check → found
      { data: [{ id: RID }] },            // recruits query → only 1 (below threshold)
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, "john smith", "john smith");
    // 2 from() calls: dismissed check + recruits fetch; no group creation
    expect((db.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("dismissed group with 2+ recruits → resurfaces a new pending group", async () => {
    const db = makeDb([
      { data: { id: "dismissed-1" } },          // dismissed check
      { data: [{ id: RID }, { id: "r2" }] },    // 2 recruits
      { data: null },                             // upsert: no existing pending
      { data: { id: "new-group" } },             // insert new group
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, "john smith", "john smith");
    const tables = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    expect(tables).toContain("recruit_duplicate_review_group_members");
  });
});

describe("checkAndQueueDuplicateReview — name changed", () => {
  it("prevNameKey null (new recruit) → no prune, creates group when matches found", async () => {
    const db = makeDb([
      { data: [{ id: "r2" }] },       // recruits: 1 match
      { data: null },                  // groups: no existing pending
      { data: { id: "group-1" } },    // groups: insert
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, null, "john smith");
    const tables = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    // group_members called once for member upsert, not for a prune
    expect(tables.filter((t) => t === "recruit_duplicate_review_group_members")).toHaveLength(1);
  });

  it("no matches in new name cluster → does not create a group", async () => {
    const db = makeDb([
      { data: { id: "old-group" } }, // prune: find old pending group
      { data: null },                 // prune: delete member (thenable)
      { count: 2, data: null },       // prune: 2 remain → old group keeps pending
      { data: [] },                   // recruits: no matches in new cluster
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, "old name", "new name");
    const tables = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    // group_members is called for prune (delete+count) but NOT for a member upsert
    expect(tables.filter((t) => t === "recruit_duplicate_review_group_members")).toHaveLength(2);
    // Only 4 from() calls total: groups check, group_members delete, group_members count, recruits
    expect(tables).toHaveLength(4);
  });

  it("old group drops to 1 member → old group is resolved", async () => {
    const db = makeDb([
      { data: { id: "old-group" } }, // prune: find old pending group
      { data: null },                 // prune: delete member
      { count: 1, data: null },       // prune: 1 remains → resolve group
      { data: null },                 // prune: update group status to resolved
      { data: [] },                   // recruits: no matches in new cluster
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, "old name", "new name");
    expect((db.from as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(5);
  });

  it("name cluster changed — prunes old group and creates new one", async () => {
    const db = makeDb([
      { data: { id: "old-group" } }, // prune: old pending group
      { data: null },                 // prune: delete member
      { count: 2, data: null },       // prune: 2 remain (old group stays)
      { data: [{ id: "r3" }] },       // recruits: 1 match in new cluster
      { data: null },                 // new group: no existing pending
      { data: { id: "new-group" } }, // new group: insert
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, "old name", "new name");
    const tables = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    expect(tables).toContain("recruit_duplicate_review_group_members");
  });
});

// ---------------------------------------------------------------------------
// bulkScanProgramForDuplicates
// ---------------------------------------------------------------------------

describe("bulkScanProgramForDuplicates", () => {
  it("no recruits in program → returns 0", async () => {
    const db = makeDb([{ data: [] }]);
    expect(await bulkScanProgramForDuplicates(db, PROG)).toBe(0);
  });

  it("all unique name keys → returns 0", async () => {
    const db = makeDb([{ data: [{ id: "r1", name_key: "alice" }, { id: "r2", name_key: "bob" }] }]);
    expect(await bulkScanProgramForDuplicates(db, PROG)).toBe(0);
  });

  it("one cluster of 2 → queues 1 group", async () => {
    const db = makeDb([
      { data: [{ id: "r1", name_key: "john smith" }, { id: "r2", name_key: "john smith" }] },
      { data: null },              // no existing pending group
      { data: { id: "g1" } },     // insert new group
    ]);
    expect(await bulkScanProgramForDuplicates(db, PROG)).toBe(1);
  });

  it("one cluster of 3 → queues 1 group (not 3)", async () => {
    const db = makeDb([
      { data: [
        { id: "r1", name_key: "john smith" },
        { id: "r2", name_key: "john smith" },
        { id: "r3", name_key: "john smith" },
      ]},
      { data: null },
      { data: { id: "g1" } },
    ]);
    expect(await bulkScanProgramForDuplicates(db, PROG)).toBe(1);
  });

  it("two separate clusters → queues 2 groups", async () => {
    const db = makeDb([
      { data: [
        { id: "r1", name_key: "alice" }, { id: "r2", name_key: "alice" },
        { id: "r3", name_key: "bob" },   { id: "r4", name_key: "bob" },
      ]},
      { data: null }, { data: { id: "g1" } }, // alice cluster
      { data: null }, { data: { id: "g2" } }, // bob cluster
    ]);
    expect(await bulkScanProgramForDuplicates(db, PROG)).toBe(2);
  });

  it("singleton + cluster → only queues group for the cluster", async () => {
    const db = makeDb([
      { data: [
        { id: "r1", name_key: "alice" },
        { id: "r2", name_key: "bob" },
        { id: "r3", name_key: "bob" },
      ]},
      { data: null }, { data: { id: "g1" } }, // bob cluster only
    ]);
    expect(await bulkScanProgramForDuplicates(db, PROG)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// upsertReviewGroup edge cases (exercised via checkAndQueueDuplicateReview)
// ---------------------------------------------------------------------------

describe("upsertReviewGroup edge cases", () => {
  it("existing pending group → updates timestamp and adds members", async () => {
    const db = makeDb([
      { data: [{ id: "r2" }] },          // recruits matches
      { data: { id: "existing-group" } }, // groups: existing pending found
      { data: null },                      // groups: update timestamp (thenable)
    ]);
    await checkAndQueueDuplicateReview(db, PROG, RID, null, "john smith");
    const tables = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
    expect(tables).toContain("recruit_duplicate_review_group_members");
    // 2 group table calls: existing check + timestamp update (no insert)
    expect(tables.filter((t) => t === "recruit_duplicate_review_groups")).toHaveLength(2);
  });

  it("race condition: insert returns error → re-reads winner and adds members", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: [{ id: "r2" }] }))                        // recruits
      .mockReturnValueOnce(makeChain({ data: null }))                                    // groups: no existing
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "unique vio" } })) // groups: insert fails
      .mockReturnValueOnce(makeChain({ data: { id: "race-winner" } }))                  // groups: re-read
      .mockReturnValue(makeChain());                                                      // group_members

    const db = { from: fromFn } as unknown as SupabaseClient;
    await expect(checkAndQueueDuplicateReview(db, PROG, RID, null, "john smith")).resolves.toBeUndefined();
    const tables = fromFn.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(tables).toContain("recruit_duplicate_review_group_members");
  });

  it("race condition: insert fails and re-read also fails → throws", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: [{ id: "r2" }] }))
      .mockReturnValueOnce(makeChain({ data: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "unique vio" } }))
      .mockReturnValue(makeChain({ data: null })); // re-read also returns null

    const db = { from: fromFn } as unknown as SupabaseClient;
    await expect(checkAndQueueDuplicateReview(db, PROG, RID, null, "john smith"))
      .rejects.toThrow("Failed to insert review group");
  });
});
