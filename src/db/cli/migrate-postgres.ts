/**
 * CLI: apply pending Postgres migrations. Mirrors `migrate-sqlite.ts`.
 *
 * Requires `DATABASE_URL` to be set; will not invent a default.
 */
import { createDb } from "../client.js";
import { migrateDb } from "../migrate.js";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for Postgres migration");
  }
  const db = createDb({ dialect: "postgres", url });
  await migrateDb(db);
  process.stdout.write(`Postgres migrations applied to ${url}\n`);
  // `postgres-js` opens a long-lived pool; force-exit so the CLI returns.
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Postgres migration failed: ${String(err)}\n`);
  process.exit(1);
});
