/**
 * End-to-end tests for the round importer, run against a fresh
 * `:memory:` SQLite database per test. Covers:
 *
 *   - happy path: JSON fixture imports 1 round + 5 grantees + 2
 *     milestones, with row counts visible in the result
 *   - CSV happy path: the same logical round, parsed from the
 *     synthetic CSV, lands the same 5 grantees (CSV doesn't carry
 *     milestones)
 *   - idempotency: re-running the same JSON import is a no-op
 *     (zero inserts, all skips), satisfying the GIV-11 acceptance
 *     criterion
 *   - parse error: malformed JSON surfaces as `ImportParseError`
 *     (this is the "one parse-error case" required by GIV-11)
 *
 * The fixture is the one synthetic round committed to `fixtures/`, so
 * the same file exercises the importer here and the CLI script in
 * dev/CI.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { count, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Db, createDb, migrateDb, sqliteSchema } from "../db/index.js";
import {
  ImportParseError,
  importRound,
  parseRoundCsv,
  parseRoundJson,
} from "./index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(HERE, "../../fixtures");

let db: Db;

beforeEach(async () => {
  db = createDb({ dialect: "sqlite", url: ":memory:" });
  await migrateDb(db);
});

afterEach(() => {
  // `:memory:` handle is GC'd when `db` is reassigned in the next
  // `beforeEach`. No explicit teardown needed.
});

describe("importRound — happy path (JSON)", () => {
  it("inserts a round, 5 grantees, and 2 milestones from the synthetic fixture", async () => {
    const json = readFileSync(path.join(FIXTURE_DIR, "round-synthetic-v0.json"), "utf8");
    const payload = parseRoundJson(json);

    const result = await importRound({ db, payload });

    expect(result.existed).toBe(false);
    expect(result.inserted).toEqual({ grantees: 5, milestones: 3 });
    expect(result.skipped).toEqual({ grantees: 0, milestones: 0 });
    expect(result.publicSlug).toBe("synthetic-foundation-2026-q2");

    // Confirm DB rows.
    if (db.$dialect !== "sqlite") throw new Error("expected sqlite in test setup");
    const granteeCount = await db.select({ n: count() }).from(sqliteSchema.grantees);
    expect(granteeCount[0]?.n).toBe(5);
    const milestoneCount = await db.select({ n: count() }).from(sqliteSchema.milestones);
    expect(milestoneCount[0]?.n).toBe(3);

    // Confirm one grantee's denormalised data round-trips correctly.
    const openTide = await db
      .select()
      .from(sqliteSchema.grantees)
      .where(eq(sqliteSchema.grantees.projectName, "Open Tide"))
      .limit(1);
    expect(openTide).toHaveLength(1);
    const first = openTide[0];
    expect(first).toBeDefined();
    expect(first?.githubUrls).toEqual([
      "https://github.com/example-org/open-tide-core",
      "https://github.com/example-org/open-tide-docs",
    ]);
    expect(first?.osoProjectId).toBe("open-tide");
  });
});

describe("importRound — CSV happy path", () => {
  it("imports the same 5 grantees from the synthetic CSV (milestones are JSON-only)", async () => {
    const csv = readFileSync(path.join(FIXTURE_DIR, "round-synthetic-v0.csv"), "utf8");
    const payload = parseRoundCsv(csv);

    const result = await importRound({ db, payload });

    expect(result.existed).toBe(false);
    expect(result.inserted.grantees).toBe(5);
    // CSV format doesn't carry milestones by design.
    expect(result.inserted.milestones).toBe(0);
    expect(result.publicSlug).toBe("synthetic-foundation-2026-q2");
  });
});

describe("importRound — idempotency", () => {
  it("re-importing the same round is a no-op (zero new rows)", async () => {
    const json = readFileSync(path.join(FIXTURE_DIR, "round-synthetic-v0.json"), "utf8");
    const payload = parseRoundJson(json);

    const first = await importRound({ db, payload });
    expect(first.existed).toBe(false);
    expect(first.inserted.grantees).toBe(5);

    const second = await importRound({ db, payload });
    expect(second.existed).toBe(true);
    expect(second.inserted).toEqual({ grantees: 0, milestones: 0 });
    expect(second.skipped).toEqual({ grantees: 5, milestones: 3 });
    expect(second.roundId).toBe(first.roundId);

    // Sanity: row counts are unchanged.
    if (db.$dialect !== "sqlite") throw new Error("expected sqlite in test setup");
    const granteeCount = await db.select({ n: count() }).from(sqliteSchema.grantees);
    expect(granteeCount[0]?.n).toBe(5);
    const milestoneCount = await db.select({ n: count() }).from(sqliteSchema.milestones);
    expect(milestoneCount[0]?.n).toBe(3);
  });
});

describe("importRound — parse errors surface as ImportParseError", () => {
  it("malformed JSON throws a typed parse error with a hint", () => {
    const malformed = '{"funder": "X", "name":'; // truncated
    expect(() => parseRoundJson(malformed)).toThrowError(ImportParseError);
    try {
      parseRoundJson(malformed);
    } catch (err) {
      expect(err).toBeInstanceOf(ImportParseError);
      const e = err as ImportParseError;
      expect(e.message).toMatch(/JSON is not well-formed/);
      expect(e.hint).toBeDefined();
    }
  });

  it("missing required field throws ImportParseError", () => {
    const missingFunder = JSON.stringify({
      name: "X",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-12-31T23:59:59Z",
      currency: "USD",
      totalAwarded: "1",
      publicSlug: "x",
      grantees: [{ projectName: "P", awardedAmount: "1" }],
    });
    expect(() => parseRoundJson(missingFunder)).toThrowError(/missing required string field: "funder"/);
  });
});
