/**
 * Dialect-agnostic typed query helpers.
 *
 * Each helper accepts the discriminated `Db` union from `./client.ts` and
 * dispatches to the correct schema module internally. Callers therefore
 * never have to import the dialect-specific schema directly.
 *
 * The helpers in this file represent the *only* sanctioned mutation
 * paths against the v0 model. Note in particular that `insertEvidence`
 * is the only writer for the `evidence` table — there are no
 * `updateEvidence` or `deleteEvidence` helpers, by design (see
 * `./schema/sqlite.ts` for the append-only invariant).
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import * as pgSchema from "./schema/postgres.js";
import * as sqliteSchema from "./schema/sqlite.js";
import type { JsonValue, MilestoneStatus } from "./types.js";

export type RoundInsert = {
  id: string;
  funder: string;
  name: string;
  startsAt: string;
  endsAt: string;
  currency: string;
  totalAwarded: string;
  publicSlug: string;
};

export type GranteeInsert = {
  id: string;
  roundId: string;
  projectName: string;
  githubUrls?: string[];
  deployUrls?: string[];
  osoProjectId?: string | null;
  awardedAmount: string;
  contactEmail?: string | null;
};

export type MilestoneInsert = {
  id: string;
  granteeId: string;
  title: string;
  dueAt?: string | null;
  status: MilestoneStatus;
  evidenceSummary?: string | null;
  attestedBy?: string | null;
  attestedAt?: string | null;
};

export type EvidenceInsert = {
  id: string;
  granteeId: string;
  source: string;
  sourceEventId: string;
  kind: string;
  occurredAt: string;
  url?: string | null;
  payloadJson: JsonValue;
  contentHash: string;
};

export type ReportInsert = {
  id: string;
  roundId: string;
  slug: string;
  publishedAt: string;
  snapshotJson: JsonValue;
};

export type JobInsert = {
  id: string;
  kind: string;
  payloadJson: JsonValue;
  runAfter: string;
};

/**
 * Insert a round. Returns the row id for chaining; the caller is
 * responsible for generating ids (UUID v4 recommended).
 */
export async function insertRound(db: Db, row: RoundInsert): Promise<string> {
  if (db.$dialect === "sqlite") {
    await db.insert(sqliteSchema.rounds).values(row);
  } else {
    await db.insert(pgSchema.rounds).values(row);
  }
  return row.id;
}

export async function insertGrantee(db: Db, row: GranteeInsert): Promise<string> {
  const values = {
    id: row.id,
    roundId: row.roundId,
    projectName: row.projectName,
    githubUrls: row.githubUrls ?? [],
    deployUrls: row.deployUrls ?? [],
    osoProjectId: row.osoProjectId ?? null,
    awardedAmount: row.awardedAmount,
    contactEmail: row.contactEmail ?? null,
  };
  if (db.$dialect === "sqlite") {
    await db.insert(sqliteSchema.grantees).values(values);
  } else {
    await db.insert(pgSchema.grantees).values(values);
  }
  return row.id;
}

export async function insertMilestone(db: Db, row: MilestoneInsert): Promise<string> {
  const values = {
    id: row.id,
    granteeId: row.granteeId,
    title: row.title,
    dueAt: row.dueAt ?? null,
    status: row.status,
    evidenceSummary: row.evidenceSummary ?? null,
    attestedBy: row.attestedBy ?? null,
    attestedAt: row.attestedAt ?? null,
  };
  if (db.$dialect === "sqlite") {
    await db.insert(sqliteSchema.milestones).values(values);
  } else {
    await db.insert(pgSchema.milestones).values(values);
  }
  return row.id;
}

/**
 * Append an evidence row. The unique index on
 * `(grantee_id, source, source_event_id, content_hash)` makes this
 * safely re-runnable: a duplicate event from the same source will
 * raise a constraint violation, which adapters can treat as "already
 * collected, skip".
 *
 * Mutating evidence is intentionally not supported. To correct a bad
 * row, append a compensating row with a new `kind` and reference the
 * original via `payloadJson`.
 */
export async function insertEvidence(db: Db, row: EvidenceInsert): Promise<string> {
  const values = {
    id: row.id,
    granteeId: row.granteeId,
    source: row.source,
    sourceEventId: row.sourceEventId,
    kind: row.kind,
    occurredAt: row.occurredAt,
    url: row.url ?? null,
    payloadJson: row.payloadJson,
    contentHash: row.contentHash,
  };
  if (db.$dialect === "sqlite") {
    await db.insert(sqliteSchema.evidence).values(values);
  } else {
    await db.insert(pgSchema.evidence).values(values);
  }
  return row.id;
}

export async function insertReport(db: Db, row: ReportInsert): Promise<string> {
  if (db.$dialect === "sqlite") {
    await db.insert(sqliteSchema.reports).values(row);
  } else {
    await db.insert(pgSchema.reports).values(row);
  }
  return row.id;
}

export async function enqueueJob(db: Db, row: JobInsert): Promise<string> {
  const values = {
    id: row.id,
    kind: row.kind,
    payloadJson: row.payloadJson,
    runAfter: row.runAfter,
  };
  if (db.$dialect === "sqlite") {
    await db.insert(sqliteSchema.jobs).values(values);
  } else {
    await db.insert(pgSchema.jobs).values(values);
  }
  return row.id;
}

/** Read all evidence rows for a grantee, oldest first. */
export async function listEvidenceForGrantee(
  db: Db,
  granteeId: string,
): Promise<
  Array<{
    id: string;
    granteeId: string;
    source: string;
    sourceEventId: string;
    kind: string;
    occurredAt: string;
    url: string | null;
    payloadJson: JsonValue;
    contentHash: string;
  }>
> {
  if (db.$dialect === "sqlite") {
    const rows = await db
      .select()
      .from(sqliteSchema.evidence)
      .where(eq(sqliteSchema.evidence.granteeId, granteeId))
      .orderBy(sqliteSchema.evidence.occurredAt);
    return rows.map((r) => ({
      id: r.id,
      granteeId: r.granteeId,
      source: r.source,
      sourceEventId: r.sourceEventId,
      kind: r.kind,
      occurredAt: r.occurredAt,
      url: r.url,
      payloadJson: r.payloadJson,
      contentHash: r.contentHash,
    }));
  }
  const rows = await db
    .select()
    .from(pgSchema.evidence)
    .where(eq(pgSchema.evidence.granteeId, granteeId))
    .orderBy(pgSchema.evidence.occurredAt);
  return rows.map((r) => ({
    id: r.id,
    granteeId: r.granteeId,
    source: r.source,
    sourceEventId: r.sourceEventId,
    kind: r.kind,
    occurredAt: r.occurredAt,
    url: r.url,
    payloadJson: r.payloadJson,
    contentHash: r.contentHash,
  }));
}

/** Read a single round by its public slug. */
export async function findRoundBySlug(
  db: Db,
  slug: string,
): Promise<{ id: string; name: string; funder: string } | null> {
  if (db.$dialect === "sqlite") {
    const rows = await db
      .select({
        id: sqliteSchema.rounds.id,
        name: sqliteSchema.rounds.name,
        funder: sqliteSchema.rounds.funder,
      })
      .from(sqliteSchema.rounds)
      .where(eq(sqliteSchema.rounds.publicSlug, slug))
      .limit(1);
    return rows[0] ?? null;
  }
  const rows = await db
    .select({
      id: pgSchema.rounds.id,
      name: pgSchema.rounds.name,
      funder: pgSchema.rounds.funder,
    })
    .from(pgSchema.rounds)
    .where(eq(pgSchema.rounds.publicSlug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Look up an existing evidence row by its idempotency key. Returns the
 * id of the existing row if a match is found, otherwise `null`.
 */
export async function findEvidenceByIdempotencyKey(
  db: Db,
  key: {
    granteeId: string;
    source: string;
    sourceEventId: string;
    contentHash: string;
  },
): Promise<string | null> {
  if (db.$dialect === "sqlite") {
    const rows = await db
      .select({ id: sqliteSchema.evidence.id })
      .from(sqliteSchema.evidence)
      .where(
        and(
          eq(sqliteSchema.evidence.granteeId, key.granteeId),
          eq(sqliteSchema.evidence.source, key.source),
          eq(sqliteSchema.evidence.sourceEventId, key.sourceEventId),
          eq(sqliteSchema.evidence.contentHash, key.contentHash),
        ),
      )
      .limit(1);
    return rows[0]?.id ?? null;
  }
  const rows = await db
    .select({ id: pgSchema.evidence.id })
    .from(pgSchema.evidence)
    .where(
      and(
        eq(pgSchema.evidence.granteeId, key.granteeId),
        eq(pgSchema.evidence.source, key.source),
        eq(pgSchema.evidence.sourceEventId, key.sourceEventId),
        eq(pgSchema.evidence.contentHash, key.contentHash),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}
