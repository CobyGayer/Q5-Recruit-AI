import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/program-context", () => ({ getEffectiveProgramContext: vi.fn() }));
vi.mock("@/lib/scoring/dqs", () => ({ calculateDQS: vi.fn() }));
vi.mock("@/lib/scoring/summary", () => ({ generateDQSSummary: vi.fn() }));

import { POST } from "@/app/api/recruits/duplicate-review/merge/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveProgramContext } from "@/lib/program-context";
import { calculateDQS } from "@/lib/scoring/dqs";
import { generateDQSSummary } from "@/lib/scoring/summary";

function makeChain(result: { data?: unknown; error?: unknown; count?: number } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "update", "delete"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.upsert = vi.fn().mockResolvedValue({ error: result.error ?? null });
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeRecruit(id: string, fieldsExtracted = 2) {
  return {
    id,
    coach_id: "coach-1",
    program_id: "prog-1",
    name_key: "john smith",
    full_name: "John Smith",
    email: null, phone: null, graduation_year: null, current_school: null,
    city: null, state: null, country: null, positions: [],
    preferred_foot: null, height_inches: null, weight_lbs: null,
    gpa: null, sat_score: null, act_score: null, club_team: null,
    club_level: "unknown", high_school_team: null, video_url: null,
    extraction_confidence: {},
    fields_missing: [], fields_extracted: fieldsExtracted, fields_total: 10,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const mockDqsResult = {
  score: 75, isQualified: true, disqualificationReasons: [],
  componentScores: { academic: 15, competition: 15, physical: 15, positionFit: 10, gradYear: 5, completeness: 15 },
  bonusPoints: 0, completenessPenalty: 0, breakdown: [],
};

function makeReq(body?: unknown) {
  return {
    json: body === undefined
      ? vi.fn().mockRejectedValue(new SyntaxError("Bad JSON"))
      : vi.fn().mockResolvedValue(body),
  } as unknown as import("next/server").NextRequest;
}

function setupAuth(db: unknown, adminDb: unknown, user: { id: string } | null = { id: "user-1" }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as never);
  vi.mocked(getEffectiveProgramContext).mockResolvedValue(
    user ? { effectiveProgramId: "prog-1", db } as never : null
  );
  vi.mocked(createAdminClient).mockReturnValue(adminDb as never);
}

describe("POST /api/recruits/duplicate-review/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateDQS).mockReturnValue(mockDqsResult as never);
    vi.mocked(generateDQSSummary).mockResolvedValue("AI summary");
  });

  it("returns 401 when unauthenticated", async () => {
    setupAuth(null, null, null);
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no program context", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    } as never);
    vi.mocked(getEffectiveProgramContext).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({} as never);
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    setupAuth({ from: vi.fn() }, { from: vi.fn(), rpc: vi.fn() });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid json/i);
  });

  it("returns 400 when recruit_ids has fewer than 2 entries", async () => {
    setupAuth({ from: vi.fn() }, { from: vi.fn(), rpc: vi.fn() });
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when group_id is missing", async () => {
    setupAuth({ from: vi.fn() }, { from: vi.fn(), rpc: vi.fn() });
    const res = await POST(makeReq({ recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when group not found in program", async () => {
    const dbFromFn = vi.fn().mockReturnValue(makeChain({ data: null }));
    setupAuth({ from: dbFromFn }, { from: vi.fn(), rpc: vi.fn() });
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when group status is not pending", async () => {
    const dbFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "resolved", name_key: "john smith" } }));
    setupAuth({ from: dbFromFn }, { from: vi.fn(), rpc: vi.fn() });
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not pending/i);
  });

  it("returns 400 when a recruit_id is not a member of the group", async () => {
    const dbFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "pending", name_key: "john smith" } }))
      .mockReturnValueOnce(makeChain({ data: [{ recruit_id: "r1" }] })); // only r1 is a member

    setupAuth({ from: dbFromFn }, { from: vi.fn(), rpc: vi.fn() });
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r99"] })); // r99 not a member
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not members/i);
  });

  it("returns 500 when RPC fails", async () => {
    const r1 = makeRecruit("r1", 3);
    const r2 = makeRecruit("r2", 2);

    const dbFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "pending", name_key: "john smith" } }))
      .mockReturnValueOnce(makeChain({ data: [{ recruit_id: "r1" }, { recruit_id: "r2" }] }));

    const adminFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: [r1, r2] })); // recruits fetch

    const adminDb = {
      from: adminFromFn,
      rpc: vi.fn().mockResolvedValue({ error: { message: "rpc failed" } }),
    };

    setupAuth({ from: dbFromFn }, adminDb);
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("rpc failed");
  });

  it("returns 200 with survivor_id on successful merge", async () => {
    const r1 = makeRecruit("r1", 5);
    const r2 = makeRecruit("r2", 2);

    const dbFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "pending", name_key: "john smith" } }))
      .mockReturnValueOnce(makeChain({ data: [{ recruit_id: "r1" }, { recruit_id: "r2" }] }));

    const programConfig = { program_id: "prog-1" };
    const adminFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: [r1, r2] }))           // recruits fetch (in.eq thenable)
      .mockReturnValueOnce(makeChain({ data: programConfig }))        // program_config single
      .mockReturnValueOnce(makeChain({ data: r1 }))                   // survivor recruit single
      .mockReturnValueOnce(makeChain({ data: null }))                 // transcript maybeSingle
      .mockReturnValue(makeChain({ data: null }));                    // recruit_dqs_scores upsert

    const adminDb = {
      from: adminFromFn,
      rpc: vi.fn().mockResolvedValue({ error: null }),
    };

    setupAuth({ from: dbFromFn }, adminDb);
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.survivor_id).toBe("r1"); // r1 has more fields extracted
    expect(json.merged_count).toBe(1);
  });

  it("returns 200 with dqs_warning when DQS upsert fails", async () => {
    const r1 = makeRecruit("r1", 5);
    const r2 = makeRecruit("r2", 2);

    const dbFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "pending", name_key: "john smith" } }))
      .mockReturnValueOnce(makeChain({ data: [{ recruit_id: "r1" }, { recruit_id: "r2" }] }));

    const adminFromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: [r1, r2] }))
      .mockReturnValueOnce(makeChain({ data: { program_id: "prog-1" } }))
      .mockReturnValueOnce(makeChain({ data: r1 }))
      .mockReturnValueOnce(makeChain({ data: null }))
      // DQS upsert returns error
      .mockReturnValue(makeChain({ data: null, error: { message: "upsert fail" } }));

    const adminDb = {
      from: adminFromFn,
      rpc: vi.fn().mockResolvedValue({ error: null }),
    };

    setupAuth({ from: dbFromFn }, adminDb);
    const res = await POST(makeReq({ group_id: "g1", recruit_ids: ["r1", "r2"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.dqs_warning).toBeTruthy();
  });
});
