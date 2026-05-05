/**
 * CLI: apply pending SQLite migrations.
 *
 * Reads `DATABASE_URL` (default `./give-evidence.db`), creates the file
 * if missing, runs every migration in `drizzle/sqlite/` not yet applied,
 * and exits 0. Idempotent.
 */
import { createDb } from "../client.js";
import { migrateDb } from "../migrate.js";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "./give-evidence.db";
  const db = createDb({ dialect: "sqlite", url });
  await migrateDb(db);
  // `better-sqlite3` keeps the file handle on the underlying Database
  // driver; closing is optional for CLI but tidy.
  process.stdout.write(`SQLite migrations applied to ${url}\n`);
}

main().catch((err) => {
  process.stderr.write(`SQLite migration failed: ${String(err)}\n`);
  process.exitCode = 1;
});
