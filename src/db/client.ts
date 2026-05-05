/**
 * Database client factory.
 *
 * `give-evidence` ships SQLite as the default for local development and
 * small self-hosted deployments, and Postgres as the production target.
 * Both dialects share the same logical data model (see `./schema/`),
 * but Drizzle's type system distinguishes them, so this module exposes
 * a discriminated `Db` union that callers narrow on before issuing
 * queries that need dialect-specific features.
 *
 * For dialect-agnostic queries, use the helpers in `./queries.ts` —
 * they accept either branch of the union and dispatch internally.
 */
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as pgSchema from "./schema/postgres.js";
import * as sqliteSchema from "./schema/sqlite.js";

/** A SQLite-backed Drizzle database with the v0 schema attached. */
export type SqliteDb = BetterSQLite3Database<typeof sqliteSchema> & {
  $dialect: "sqlite";
};

/** A Postgres-backed Drizzle database with the v0 schema attached. */
export type PostgresDb = PostgresJsDatabase<typeof pgSchema> & {
  $dialect: "postgres";
};

/** Discriminated union for any supported dialect. */
export type Db = SqliteDb | PostgresDb;

export type SqliteOptions = {
  dialect: "sqlite";
  /** Path to the SQLite file. Use `":memory:"` for tests. */
  url: string;
};

export type PostgresOptions = {
  dialect: "postgres";
  /** Standard Postgres connection string, e.g. `postgres://user:pw@host/db`. */
  url: string;
};

export type DbOptions = SqliteOptions | PostgresOptions;

/**
 * Construct a database client. Foreign keys are enabled on SQLite (off
 * by default in `better-sqlite3`) so the cascade definitions in the
 * schema actually fire.
 */
export function createDb(options: DbOptions): Db {
  if (options.dialect === "sqlite") {
    const sqlite = new Database(options.url);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzleSqlite(sqlite, { schema: sqliteSchema });
    return Object.assign(db, { $dialect: "sqlite" as const });
  }

  const sql = postgres(options.url, { max: 4 });
  const db = drizzlePg(sql, { schema: pgSchema });
  return Object.assign(db, { $dialect: "postgres" as const });
}

/**
 * Convenience: build options from environment.
 *
 *   DATABASE_DIALECT  "sqlite" (default) | "postgres"
 *   DATABASE_URL      sqlite path or postgres connection string
 *
 * Defaults to a local file `./give-evidence.db` for SQLite if no URL is
 * provided. Postgres requires an explicit URL.
 */
export function dbOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): DbOptions {
  const dialect = (env.DATABASE_DIALECT ?? "sqlite") as DbOptions["dialect"];
  const url = env.DATABASE_URL;
  if (dialect === "sqlite") {
    return { dialect, url: url ?? "./give-evidence.db" };
  }
  if (dialect === "postgres") {
    if (!url) {
      throw new Error("DATABASE_URL is required when DATABASE_DIALECT=postgres");
    }
    return { dialect, url };
  }
  throw new Error(`Unsupported DATABASE_DIALECT: ${String(dialect)}`);
}
