import path from "node:path";
/**
 * Apply pending migrations to a database.
 *
 * Drizzle generates migration files into separate per-dialect folders
 * (`drizzle/sqlite`, `drizzle/postgres`); this helper picks the right
 * folder based on the client's discriminator and invokes the matching
 * Drizzle migrator. Idempotent — safe to run on every boot.
 */
import { fileURLToPath } from "node:url";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Default folder layout: `<repo>/drizzle/<dialect>` relative to this file. */
const SQLITE_MIGRATIONS = path.resolve(HERE, "../../drizzle/sqlite");
const POSTGRES_MIGRATIONS = path.resolve(HERE, "../../drizzle/postgres");

export type MigrateOptions = {
  /** Override the migrations folder (e.g. for tests). */
  migrationsFolder?: string;
};

export async function migrateDb(db: Db, options: MigrateOptions = {}): Promise<void> {
  if (db.$dialect === "sqlite") {
    const folder = options.migrationsFolder ?? SQLITE_MIGRATIONS;
    // `better-sqlite3` migrator is synchronous; await is a no-op but keeps
    // the API uniform across dialects.
    migrateSqlite(db, { migrationsFolder: folder });
    return;
  }
  const folder = options.migrationsFolder ?? POSTGRES_MIGRATIONS;
  await migratePg(db, { migrationsFolder: folder });
}
