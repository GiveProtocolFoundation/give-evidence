/**
 * Shared model types for the v0 data model.
 *
 * These types describe the application-level shape of each row, independent
 * of the database dialect. Both the SQLite and Postgres schema modules
 * (`./schema/sqlite.ts`, `./schema/postgres.ts`) are designed to round-trip
 * cleanly into and out of these shapes.
 *
 * Dialect-specific differences (TEXT JSON vs JSONB, JSON-encoded array vs
 * native `text[]`) are encapsulated in column definitions, so application
 * code can stay dialect-agnostic.
 */

/** Status values for a milestone. Stored as a TEXT/varchar column. */
export type MilestoneStatus = "planned" | "in_progress" | "delivered" | "missed" | "cancelled";

/** Source identifier for an evidence event (e.g. "github", "oso", "manual"). */
export type EvidenceSource = string;

/**
 * Discriminator for what kind of evidence this row represents.
 *
 * Kept as a free-form string at the storage layer so adapters can introduce
 * new kinds without a schema migration; application-level enums live in the
 * adapter modules that consume the rows.
 */
export type EvidenceKind = string;

/** Status values for a background job. */
export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

/**
 * Marker type for ISO-8601 timestamps. Stored as TEXT in both dialects so
 * exports/imports between SQLite and Postgres are byte-identical.
 */
export type IsoDateString = string;

/** Marker type for JSON payloads stored as TEXT (SQLite) / JSONB (Postgres). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
