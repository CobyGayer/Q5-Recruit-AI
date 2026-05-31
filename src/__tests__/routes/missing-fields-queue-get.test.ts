import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/program-context", () => ({ getEffectiveProgramContext: vi.fn() }));
vi.mock("@/lib/scoring/completeness", () => ({ adjustCompletenessForWeights: vi.fn() }));
vi.mock("@/lib/email/draft", () => ({ buildMissingFieldsRequestTemplate: vi.fn() }));

import { GET } from "@/app/api/recruits/missing-fields-queue/route";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";
import { buildMissingFieldsRequestTemplate } from "@/lib/email/draft";

const mockAdjust = vi.mocked(adjustCompletenessForWeights);
const mockTemplate = vi.mocked(buildMissingFieldsRequestTemplate);

function makeChain(result: { data?: unknown; error?: unknown; count?: number } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "update", "delete", "is", "single"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeReq(searchParams: Record<string, string> = {}) {
  const params = new URLSearchParams(searchParams);
  return {
    nextUrl: { searchParams: params },
  } as unknown as import("next/server").NextRequest;
}

function setupAuth(db: unknown, user: { id: string } | null = { id: "user-1" }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as never);
  vi.mocked(getEffectiveProgramContext).mockResolvedValue(
    user ? { effectiveProgramId: "prog-1", db } as never : null
  );
}

describe("GET /api/recruits/missing-fields-queue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    setupAuth(null, null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 400 when no program context", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    } as never);
    vi.mocked(getEffectiveProgramContext).mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  describe("count_only=true", () => {
    it("returns count when queue has pending entries", async () => {
      const db = { from: vi.fn().mockReturnValue(makeChain({ data: null, count: 3 })) };
      setupAuth(db);
      const res = await GET(makeReq({ count_only: "true" }));
      expect(res.status).toBe(200);
      expect((await res.json()).count).toBe(3);
    });

    it("returns 0 when count is null", async () => {
      const db = { from: vi.fn().mockReturnValue(makeChain({ data: null, count: null as never })) };
      setupAuth(db);
      const res = await GET(makeReq({ count_only: "true" }));
      expect((await res.json()).count).toBe(0);
    });

    it("returns 500 on DB error", async () => {
      const db = { from: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: "timeout" } })) };
      setupAuth(db);
      const res = await GET(makeReq({ count_only: "true" }));
      expect(res.status).toBe(500);
    });
  });

  describe("full response", () => {
    it("returns empty array when no queue rows", async () => {
      const db = { from: vi.fn().mockReturnValue(makeChain({ data: [] })) };
      setupAuth(db);
      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("returns 500 when queue fetch errors", async () => {
      const db = { from: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: "db error" } })) };
      setupAuth(db);
      const res = await GET(makeReq());
      expect(res.status).toBe(500);
    });

    it("returns formatted entries with email template", async () => {
      const queueRow = {
        id: "qrow-1",
        recruit_id: "r1",
        queued_at: "2024-01-01T00:00:00Z",
        missing_fields_snapshot: ["gpa"],
      };
      const recruitData = {
        id: "r1",
        full_name: "Jane Smith",
        email: "jane@example.com",
        graduation_year: 2025,
        positions: ["midfielder"],
        current_school: "Central High",
        club_team: "FC United",
        gpa: null,
        fields_missing: ["gpa"],
        fields_extracted: 4,
        fields_total: 5,
        club_level: null,
      };

      const fromFn = vi.fn()
        .mockReturnValueOnce(makeChain({ data: [queueRow] }))          // queue rows
        .mockReturnValueOnce(makeChain({ data: [recruitData] }))        // recruits
        .mockReturnValueOnce(makeChain({ data: null }))                 // program_config
        .mockReturnValueOnce(makeChain({ data: { full_name: "Coach Joe", program_id: "prog-1" } })) // coach
        .mockReturnValueOnce(makeChain({ data: { name: "State U", institution: "State University" } })); // program

      setupAuth({ from: fromFn });
      mockAdjust.mockReturnValue({ missing: ["gpa"], extracted: 4, total: 5, percentage: 80 });
      mockTemplate.mockReturnValue({ subject: "Missing info", body: "Please send GPA" });

      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("qrow-1");
      expect(body[0].recruit.id).toBe("r1");
      expect(body[0].effective_missing_fields).toEqual(["gpa"]);
      expect(body[0].pre_filled_subject).toBe("Missing info");
      expect(body[0].pre_filled_body).toBe("Please send GPA");
    });

    it("skips entries where all missing fields excluded by weights", async () => {
      const queueRow = { id: "qrow-1", recruit_id: "r1", queued_at: "2024-01-01T00:00:00Z", missing_fields_snapshot: ["gpa"] };
      const recruitData = { id: "r1", full_name: "Jane", email: null, graduation_year: null, positions: [], current_school: null, club_team: null, gpa: null, fields_missing: ["gpa"], fields_extracted: 4, fields_total: 5, club_level: null };

      const fromFn = vi.fn()
        .mockReturnValueOnce(makeChain({ data: [queueRow] }))
        .mockReturnValueOnce(makeChain({ data: [recruitData] }))
        .mockReturnValueOnce(makeChain({ data: null }))
        .mockReturnValueOnce(makeChain({ data: null }))
        .mockReturnValueOnce(makeChain({ data: null }));

      setupAuth({ from: fromFn });
      mockAdjust.mockReturnValue({ missing: [], extracted: 4, total: 5, percentage: 80 });

      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("returns MLS subleague when club level is mls_next", async () => {
      const queueRow = { id: "qrow-mls", recruit_id: "r2", queued_at: "2024-01-02T00:00:00Z", missing_fields_snapshot: [] };
      const recruitData = {
        id: "r2",
        full_name: "Sam",
        email: "sam@example.com",
        graduation_year: 2026,
        positions: [],
        current_school: null,
        club_team: null,
        gpa: null,
        fields_missing: [],
        fields_extracted: 5,
        fields_total: 5,
        club_level: "mls_next",
      };

      const fromFn = vi.fn()
        .mockReturnValueOnce(makeChain({ data: [queueRow] }))
        .mockReturnValueOnce(makeChain({ data: [recruitData] }))
        .mockReturnValueOnce(makeChain({ data: null }))
        .mockReturnValueOnce(makeChain({ data: { full_name: "Coach Joe", program_id: "prog-1" } }))
        .mockReturnValueOnce(makeChain({ data: { name: "State U", institution: "State University" } }));

      setupAuth({ from: fromFn });
      mockAdjust.mockReturnValue({ missing: [], extracted: 5, total: 5, percentage: 100 });
      mockTemplate.mockReturnValue({ subject: "Missing info", body: "Please reply" });

      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].effective_missing_fields).toEqual(["mls_subleague"]);
      expect(mockTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ missingFields: ["mls_subleague"] })
      );
    });
  });
});
