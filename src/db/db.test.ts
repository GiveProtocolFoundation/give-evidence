/**
 * Smoke tests for the v0 data model against a fresh SQLite database.
 *
 * Each test gets its own `:memory:` SQLite connection so they are
 * order-independent. The same migrations folder used in production
 * (`drizzle/sqlite/`) is applied here, so a passing test proves the
 * migration also applies cleanly on a fresh SQLite DB — one of the
 * acceptance criteria on GIV-10.
 *
 * Postgres is exercised in CI via the matrix job, not in this file —
 * we keep the unit tests dependency-free so contributors can run them
 * with `pnpm test` on a clean checkout.
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type Db,
  createDb,
  findEvidenceByIdempotencyKey,
  findRoundBySlug,
  insertEvidence,
  insertGrantee,
  insertRound,
  listEvidenceForGrantee,
  migrateDb,
} from "./index.js";

let db: Db;

beforeEach(async () => {
  db = createDb({ dialect: "sqlite", url: ":memory:" });
  await migrateDb(db);
});

afterEach(() => {
  // Drizzle keeps a reference to the underlying better-sqlite3 handle
  // in the inner client; for `:memory:` databases the handle is GC'd
  // when `db` is reassigned in the next `beforeEach`.
});

describe("v0 data model — fresh SQLite", () => {
  it("applies migrations and accepts a round → grantee → evidence chain", async () => {
    const roundId = randomUUID();
    await insertRound(db, {
      id: roundId,
      funder: "Test Funder",
      name: "Test Round",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-12-31T23:59:59Z",
      currency: "USD",
      totalAwarded: "100000",
      publicSlug: "test-round",
    });

    const granteeId = randomUUID();
    await insertGrantee(db, {
      id: granteeId,
      roundId,
      projectName: "Public Goods Project",
      githubUrls: ["https://github.com/example/repo"],
      deployUrls: ["https://example.org"],
      awardedAmount: "10000",
    });

    const evId = randomUUID();
    await insertEvidence(db, {
      id: evId,
      granteeId,
      source: "github",
      sourceEventId: "issue:42",
      kind: "issue_closed",
      occurredAt: "2026-02-15T12:00:00Z",
      url: "https://github.com/example/repo/issues/42",
      payloadJson: { title: "Add docs", state: "closed" },
      contentHash: "sha256:deadbeef",
    });

    const round = await findRoundBySlug(db, "test-round");
    expect(round).toEqual({
      id: roundId,
      name: "Test Round",
      funder: "Test Funder",
    });

    const evidenceRows = await listEvidenceForGrantee(db, granteeId);
    expect(evidenceRows).toHaveLength(1);
    expect(evidenceRows[0]?.id).toBe(evId);
    expect(evidenceRows[0]?.payloadJson).toEqual({
      title: "Add docs",
      state: "closed",
    });
  });

  it("rejects duplicate evidence by idempotency key", async () => {
    const roundId = randomUUID();
    await insertRound(db, {
      id: roundId,
      funder: "F",
      name: "R",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-12-31T23:59:59Z",
      currency: "USD",
      totalAwarded: "1",
      publicSlug: `slug-${roundId}`,
    });
    const granteeId = randomUUID();
    await insertGrantee(db, {
      id: granteeId,
      roundId,
      projectName: "P",
      awardedAmount: "1",
    });

    const key = {
      source: "oso",
      sourceEventId: "metric:stars-2026-02",
      contentHash: "sha256:abc",
    };

    await insertEvidence(db, {
      id: randomUUID(),
      granteeId,
      ...key,
      kind: "metric",
      occurredAt: "2026-02-01T00:00:00Z",
      payloadJson: { stars: 100 },
    });

    // Re-running the same adapter should hit the unique index.
    await expect(
      insertEvidence(db, {
        id: randomUUID(),
        granteeId,
        ...key,
        kind: "metric",
        occurredAt: "2026-02-01T00:00:00Z",
        payloadJson: { stars: 100 },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/);

    // The lookup helper sees the existing row and returns its id.
    const existing = await findEvidenceByIdempotencyKey(db, {
      granteeId,
      ...key,
    });
    expect(existing).not.toBeNull();
  });

  it("cascades deletes from rounds → grantees → evidence", async () => {
    const roundId = randomUUID();
    await insertRound(db, {
      id: roundId,
      funder: "F",
      name: "R",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-12-31T23:59:59Z",
      currency: "USD",
      totalAwarded: "1",
      publicSlug: `slug-${roundId}`,
    });
    const granteeId = randomUUID();
    await insertGrantee(db, {
      id: granteeId,
      roundId,
      projectName: "P",
      awardedAmount: "1",
    });
    await insertEvidence(db, {
      id: randomUUID(),
      granteeId,
      source: "manual",
      sourceEventId: "1",
      kind: "note",
      occurredAt: "2026-02-01T00:00:00Z",
      payloadJson: { note: "hi" },
      contentHash: "h1",
    });

    // Use raw drizzle delete on the rounds table; cascade is the
    // thing under test, so we hit the table directly rather than
    // going through a query helper.
    const { sqliteSchema } = await import("./index.js");
    if (db.$dialect !== "sqlite") {
      throw new Error("test setup error: expected sqlite dialect");
    }
    const { eq } = await import("drizzle-orm");
    await db.delete(sqliteSchema.rounds).where(eq(sqliteSchema.rounds.id, roundId));

    const remaining = await listEvidenceForGrantee(db, granteeId);
    expect(remaining).toEqual([]);
  });
});
