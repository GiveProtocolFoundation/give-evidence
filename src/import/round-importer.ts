/**
 * Round import — the single shared code path used by both the operator
 * console upload route (`app/routes/operator.import.tsx`) and the CLI
 * (`scripts/import-round.ts`).
 *
 * Idempotency contract:
 *   - Rounds are uniquely identified by `publicSlug`. Re-importing a
 *     file that names an existing slug does *not* create a duplicate
 *     round; the existing round is reused and the importer falls
 *     through to grantee-level idempotency.
 *   - Grantees are uniquely identified by `(roundId, projectName)`. If
 *     a grantee with the same project name already exists under the
 *     round, it is skipped (no UPDATE, by design — funders correcting
 *     intake data should re-issue the row with a new project name or
 *     issue an evidence row in week 2).
 *   - Milestones are uniquely identified by `(granteeId, title)`. Same
 *     skip-don't-update policy.
 *
 * This means importing the same fixture twice is a no-op on the second
 * run — the acceptance criterion called out by GIV-11.
 *
 * Note: the schema (`src/db/schema/sqlite.ts`,
 * `src/db/schema/postgres.ts`) does *not* enforce these uniqueness
 * properties at the storage layer in v0. The acceptance criterion on
 * GIV-11 names "idempotent on `rounds.public_slug` +
 * `grantees(round_id, project_name)`" as the contract; we enforce that
 * here at the application layer so we don't churn a migration during
 * week 1. A follow-up issue will add the unique indexes once the
 * adapter set has shaken out and we're confident in the natural keys.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  insertGrantee,
  insertMilestone,
  insertRound,
} from "../db/queries.js";
import * as pgSchema from "../db/schema/postgres.js";
import * as sqliteSchema from "../db/schema/sqlite.js";
import type { ImportResult, RoundPayload } from "./types.js";

export type ImportRoundOptions = {
  db: Db;
  payload: RoundPayload;
  /**
   * Override the id generator. Tests pin this to a deterministic
   * sequence; production callers leave it unset and get UUIDv4.
   */
  newId?: () => string;
};

export async function importRound(opts: ImportRoundOptions): Promise<ImportResult> {
  const { db, payload } = opts;
  const newId = opts.newId ?? randomUUID;

  const existingRound = await findRoundIdBySlug(db, payload.publicSlug);
  let roundId: string;
  let existed: boolean;
  if (existingRound) {
    roundId = existingRound;
    existed = true;
  } else {
    roundId = newId();
    await insertRound(db, {
      id: roundId,
      funder: payload.funder,
      name: payload.name,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      currency: payload.currency,
      totalAwarded: payload.totalAwarded,
      publicSlug: payload.publicSlug,
    });
    existed = false;
  }

  const result: ImportResult = {
    roundId,
    publicSlug: payload.publicSlug,
    existed,
    inserted: { grantees: 0, milestones: 0 },
    skipped: { grantees: 0, milestones: 0 },
  };

  for (const granteeInput of payload.grantees) {
    const existingGranteeId = await findGranteeIdByProjectName(db, roundId, granteeInput.projectName);
    let granteeId: string;
    if (existingGranteeId) {
      granteeId = existingGranteeId;
      result.skipped.grantees++;
    } else {
      granteeId = newId();
      await insertGrantee(db, {
        id: granteeId,
        roundId,
        projectName: granteeInput.projectName,
        githubUrls: granteeInput.githubUrls,
        deployUrls: granteeInput.deployUrls,
        osoProjectId: granteeInput.osoProjectId ?? null,
        awardedAmount: granteeInput.awardedAmount,
        contactEmail: granteeInput.contactEmail ?? null,
      });
      result.inserted.grantees++;
    }

    for (const milestoneInput of granteeInput.milestones ?? []) {
      const existingMilestone = await findMilestoneIdByTitle(db, granteeId, milestoneInput.title);
      if (existingMilestone) {
        result.skipped.milestones++;
        continue;
      }
      await insertMilestone(db, {
        id: newId(),
        granteeId,
        title: milestoneInput.title,
        dueAt: milestoneInput.dueAt ?? null,
        // Initial state at intake. The Manual Milestone Attestation
        // adapter (week 2) transitions this through `in_progress` and
        // on to `delivered` / `missed` as evidence accumulates.
        status: "planned",
      });
      result.inserted.milestones++;
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                        dialect-agnostic read helpers                       */
/* -------------------------------------------------------------------------- */

async function findRoundIdBySlug(db: Db, slug: string): Promise<string | null> {
  if (db.$dialect === "sqlite") {
    const rows = await db
      .select({ id: sqliteSchema.rounds.id })
      .from(sqliteSchema.rounds)
      .where(eq(sqliteSchema.rounds.publicSlug, slug))
      .limit(1);
    return rows[0]?.id ?? null;
  }
  const rows = await db
    .select({ id: pgSchema.rounds.id })
    .from(pgSchema.rounds)
    .where(eq(pgSchema.rounds.publicSlug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findGranteeIdByProjectName(
  db: Db,
  roundId: string,
  projectName: string,
): Promise<string | null> {
  if (db.$dialect === "sqlite") {
    const rows = await db
      .select({ id: sqliteSchema.grantees.id })
      .from(sqliteSchema.grantees)
      .where(
        and(
          eq(sqliteSchema.grantees.roundId, roundId),
          eq(sqliteSchema.grantees.projectName, projectName),
        ),
      )
      .limit(1);
    return rows[0]?.id ?? null;
  }
  const rows = await db
    .select({ id: pgSchema.grantees.id })
    .from(pgSchema.grantees)
    .where(
      and(
        eq(pgSchema.grantees.roundId, roundId),
        eq(pgSchema.grantees.projectName, projectName),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findMilestoneIdByTitle(
  db: Db,
  granteeId: string,
  title: string,
): Promise<string | null> {
  if (db.$dialect === "sqlite") {
    const rows = await db
      .select({ id: sqliteSchema.milestones.id })
      .from(sqliteSchema.milestones)
      .where(
        and(
          eq(sqliteSchema.milestones.granteeId, granteeId),
          eq(sqliteSchema.milestones.title, title),
        ),
      )
      .limit(1);
    return rows[0]?.id ?? null;
  }
  const rows = await db
    .select({ id: pgSchema.milestones.id })
    .from(pgSchema.milestones)
    .where(
      and(
        eq(pgSchema.milestones.granteeId, granteeId),
        eq(pgSchema.milestones.title, title),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}
