/**
 * Postgres schema for the v0 data model. Mirrors `./sqlite.ts` field-for-field.
 *
 * Differences from the SQLite schema, all storage-level only:
 *
 *   - `jsonb` for JSON payloads instead of `text({ mode: "json" })`
 *   - native `text[]` arrays for `github_urls` / `deploy_urls`
 *   - `timestamptz` for the `created_at` / `collected_at` defaults; other
 *     timestamps remain TEXT for byte-identical export/import with SQLite
 *
 * The application-level shape is identical, so the dialect-agnostic
 * query helpers in `../queries.ts` work against either schema.
 */
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { JsonValue, MilestoneStatus } from "../types.js";

export const rounds = pgTable("rounds", {
  id: text("id").primaryKey(),
  funder: text("funder").notNull(),
  name: text("name").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  currency: text("currency").notNull(),
  totalAwarded: text("total_awarded").notNull(),
  publicSlug: text("public_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const grantees = pgTable(
  "grantees",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    projectName: text("project_name").notNull(),
    githubUrls: text("github_urls").array().notNull().default(sql`'{}'`),
    deployUrls: text("deploy_urls").array().notNull().default(sql`'{}'`),
    osoProjectId: text("oso_project_id"),
    awardedAmount: text("awarded_amount").notNull(),
    contactEmail: text("contact_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roundIdx: index("grantees_round_id_idx").on(table.roundId),
  }),
);

export const milestones = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    granteeIdx: index("milestones_grantee_id_idx").on(table.granteeId),
  }),
);

export const evidence = pgTable(
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
    payloadJson: jsonb("payload_json").$type<JsonValue>().notNull(),
    contentHash: text("content_hash").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
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

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    publishedAt: text("published_at").notNull(),
    snapshotJson: jsonb("snapshot_json").$type<JsonValue>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roundSlugIdx: uniqueIndex("reports_round_slug_idx").on(table.roundId, table.slug),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    payloadJson: jsonb("payload_json").$type<JsonValue>().notNull(),
    runAfter: text("run_after").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lockedAt: text("locked_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    readyIdx: index("jobs_ready_idx").on(table.runAfter, table.lockedAt),
  }),
);
