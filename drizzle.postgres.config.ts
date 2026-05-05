/**
 * drizzle-kit config for the Postgres dialect. Mirrors `drizzle.sqlite.config.ts`.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/postgres.ts",
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/give_evidence",
  },
  strict: true,
  verbose: true,
});
