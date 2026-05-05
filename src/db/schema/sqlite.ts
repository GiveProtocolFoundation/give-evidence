/**
 * SQLite schema for the v0 data model.
 *
 * SQLite is the default development and small-deployment target. The schema
 * mirrors the Postgres definition in `./postgres.ts` field-for-field; the
 * only differences are dialect-specific storage choices that are invisible
 * at the application layer:
 *
 *   - `text({ mode: "json" })` for JSON payloads (Postgres uses `jsonb`)
 *   - JSON-encoded arrays for `github_urls` / `deploy_urls` (Postgres uses
 *     native `text[]`)
 *   - ISO-8601 strings for timestamps (Postgres uses the same; SQLite has
 *     no real timestamp type and Postgres `timestamptz` round-trips ISO
 *     strings without loss)
 *
 * The append-only invariant on `evidence` is enforced at the application
 * layer (no UPDATE / DELETE paths in `src/db/queries.ts`); the storage
 * engine does not have a way to express "INSERT-only" as a constraint.
 */
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { JsonValue, MilestoneStatus } from "../types.js";

/**
 * Funding rounds. A `round` groups a set of grantees evaluated together
 * by a single funder.
 */
export const rounds = sqliteTable("rounds", {
  id: text("id").primaryKey(),
  funder: text("funder").notNull(),
  name: text("name").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  currency: text("currency").notNull(),
  totalAwarded: text("total_awarded").notNull(),
  publicSlug: text("public_slug").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Grantees within a round. `githubUrls` and `deployUrls` are stored as
 * JSON-encoded arrays for SQLite; the Postgres counterpart uses native
 * `text[]` arrays. Both round-trip to `string[]` at the type level.
 */
export const grantees = sqliteTable(
  "grantees",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    projectName: text("project_name").notNull(),
    githubUrls: text("github_urls", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    deployUrls: text("deploy_urls", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    osoProjectId: text("oso_project_id"),
    awardedAmount: text("awarded_amount").notNull(),
    contactEmail: text("contact_email"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    roundIdx: index("grantees_round_id_idx").on(table.roundId),
  }),
);

/**
 * Milestones declared by a grantee. `status` is a free-form TEXT column
 * with the application-level type narrowed via `$type`; we don't use a
 * CHECK constraint here so adapters can introduce new statuses without
 * a migration.
 */
export const milestones = sqliteTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    granteeId: text("grantee_id")
      .notNull()
      .references(() => grantees.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueAt: text("due_at"),
    status: text("status").$type<MilestoneStatus>().notNull(),
    evidenceSummary: text("evidence_summary"),
    attestedBy: text("attested_by"),
    attestedAt: text("attested_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    granteeIdx: index("milestones_grantee_id_idx").on(table.granteeId),
  }),
);

/**
 * Append-only evidence ledger. The application layer MUST NOT issue
 * UPDATE or DELETE against this table; a report at any point in time T
 * must be reproducible from the rows visible at T.
 *
 * Idempotency: the unique index on
 * `(grantee_id, source, source_event_id, content_hash)` means an adapter
 * can re-run safely — a duplicate event from the same source is rejected
 * at insert time.
 */
export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    granteeId: text("grantee_id")
      .notNull()
      .references(() => grantees.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    kind: text("kind").notNull(),
    occurredAt: text("occurred_at").notNull(),
    url: text("url"),
    payloadJson: text("payload_json", { mode: "json" }).$type<JsonValue>().notNull(),
    contentHash: text("content_hash").notNull(),
    collectedAt: text("collected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    granteeIdx: index("evidence_grantee_id_idx").on(table.granteeId),
    occurredAtIdx: index("evidence_occurred_at_idx").on(table.occurredAt),
    idempotencyIdx: uniqueIndex("evidence_idempotency_idx").on(
      table.granteeId,
      table.source,
      table.sourceEventId,
      table.contentHash,
    ),
  }),
);

/** Published reports keyed by round + slug. Snapshot is a frozen blob. */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    publishedAt: text("published_at").notNull(),
    snapshotJson: text("snapshot_json", { mode: "json" }).$type<JsonValue>().notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    roundSlugIdx: uniqueIndex("reports_round_slug_idx").on(table.roundId, table.slug),
  }),
);

/**
 * Background-job queue. `lockedAt` is set by a worker when it claims a
 * row; the simple polling loop in the worker checks `run_after <= now`
 * and `locked_at IS NULL`.
 */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).$type<JsonValue>().notNull(),
    runAfter: text("run_after").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lockedAt: text("locked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    readyIdx: index("jobs_ready_idx").on(table.runAfter, table.lockedAt),
  }),
);
