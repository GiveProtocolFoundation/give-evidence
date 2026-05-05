/**
 * drizzle-kit config for the SQLite dialect.
 *
 * Migrations land in `drizzle/sqlite/`. Generation is deterministic and
 * does not require a live database; `drizzle-kit generate` only reads
 * the schema module.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./give-evidence.db",
  },
  strict: true,
  verbose: true,
});
