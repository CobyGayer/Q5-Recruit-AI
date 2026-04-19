/**
 * Database-backed integration scenarios for the duplicate-review feature.
 *
 * These tests require a real Postgres/Supabase instance with migrations applied.
 * Run them with: DATABASE_URL=<url> npm run test:integration
 *
 * All tests are skipped in the default `npm test` suite.
 * To implement, spin up a local Supabase container, apply all migrations in
 * supabase/migrations/, seed minimum relational fixtures, and replace
 * `it.skip` with `it` plus real Supabase client calls.
 */
import { describe, it } from "vitest";

describe.skip("SQL: name_key trigger behavior", () => {
  it("INSERT recruit sets name_key via normalize_name_key() trigger");

  it("UPDATE recruit.full_name updates name_key");

  it("SQL and TypeScript normalizeNameKey agree for ASCII names");

  it("SQL and TypeScript diverge for ł (SQL gives l, TS strips it) — documented divergence");

  it("SQL and TypeScript diverge for ß (SQL gives ss, TS strips it) — documented divergence");
});

describe.skip("SQL: merge_duplicate_recruits RPC", () => {
  it("rewires ingested_emails from loser to survivor");

  it("rewires email_log from loser to survivor");

  it("rewires coach_recruit_flags from loser to survivor");

  it("rewires transcript_analyses from loser to survivor");

  it("rewires recruit_dqs_scores from loser to survivor");

  it("deletes loser recruit after rewiring");

  it("returns error when survivor_id does not exist");

  it("returns error when any loser_id is the same as survivor_id");
});

describe.skip("SQL: partial merge group lifecycle", () => {
  it("merging 2 of 3 members leaves group pending with 2 remaining members");

  it("merging the final 2 members resolves the group");
});

describe.skip("SQL: auto-resolve trigger (011 migration)", () => {
  it("deleting a recruit from a 2-member group auto-resolves the group");

  it("deleting a recruit from a 3-member group leaves group pending with 2 members");
});
