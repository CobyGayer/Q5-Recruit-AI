import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/recruits/duplicate-review", () => ({ bulkScanProgramForDuplicates: vi.fn() }));

import { POST } from "@/app/api/admin/coaches/[id]/duplicate-scan/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bulkScanProgramForDuplicates } from "@/lib/recruits/duplicate-review";

function makeChain(result: { data?: unknown; error?: unknown } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "update", "delete"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeReq() {
  return {} as unknown as import("next/server").NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/coaches/[id]/duplicate-scan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);
    const res = await POST(makeReq(), makeParams("coach-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not admin", async () => {
    const fromFn = vi.fn()
      .mockReturnValue(makeChain({ data: { role: "coach" } })); // coach role

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: fromFn,
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const res = await POST(makeReq(), makeParams("coach-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when target coach not found", async () => {
    const userFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: { role: "admin" } }));

    const adminFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: null, error: { message: "not found" } }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: userFromFn,
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({ from: adminFromFn } as never);
    const res = await POST(makeReq(), makeParams("missing-coach"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when target coach has no program", async () => {
    const userFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: { role: "admin" } }));

    const adminFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: { id: "coach-1", full_name: "Coach X", program_id: null } }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: userFromFn,
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({ from: adminFromFn } as never);
    const res = await POST(makeReq(), makeParams("coach-1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not assigned to a program/i);
  });

  it("returns 200 with groups_queued count on success", async () => {
    const userFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: { role: "admin" } }));

    const adminFromFn = vi.fn()
      .mockReturnValue(makeChain({ data: { id: "coach-1", full_name: "Coach X", program_id: "prog-1" } }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: userFromFn,
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({ from: adminFromFn } as never);
    vi.mocked(bulkScanProgramForDuplicates).mockResolvedValue(3);

    const res = await POST(makeReq(), makeParams("coach-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.groups_queued).toBe(3);
    expect(json.program_id).toBe("prog-1");
    // Scan should be scoped to the target coach's program, not all programs
    expect(vi.mocked(bulkScanProgramForDuplicates)).toHaveBeenCalledWith(
      expect.anything(),
      "prog-1"
    );
  });
});
