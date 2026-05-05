/**
 * Public surface of the data layer. Application code should import from
 * here, not from individual schema/dialect modules, so we can change the
 * internal layout without churn at the call sites.
 */
export {
  createDb,
  dbOptionsFromEnv,
  type Db,
  type DbOptions,
  type PostgresDb,
  type PostgresOptions,
  type SqliteDb,
  type SqliteOptions,
} from "./client.js";
export { migrateDb, type MigrateOptions } from "./migrate.js";
export {
  enqueueJob,
  findEvidenceByIdempotencyKey,
  findRoundBySlug,
  insertEvidence,
  insertGrantee,
  insertMilestone,
  insertReport,
  insertRound,
  listEvidenceForGrantee,
  type EvidenceInsert,
  type GranteeInsert,
  type JobInsert,
  type MilestoneInsert,
  type ReportInsert,
  type RoundInsert,
} from "./queries.js";
export type {
  EvidenceKind,
  EvidenceSource,
  IsoDateString,
  JobStatus,
  JsonValue,
  MilestoneStatus,
} from "./types.js";
export * as sqliteSchema from "./schema/sqlite.js";
export * as pgSchema from "./schema/postgres.js";
