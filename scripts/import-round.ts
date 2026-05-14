#!/usr/bin/env tsx
/**
 * CLI mirror of the operator console upload route
 * (`app/routes/operator.import.tsx`). Goes through the *same* importer
 * module so a self-hoster who imports via the terminal gets identical
 * persistence behavior to a funder who uploads via the web UI.
 *
 * Usage:
 *   pnpm import:round path/to/round.{json,csv}
 *
 * Environment:
 *   DATABASE_DIALECT   "sqlite" (default) | "postgres"
 *   DATABASE_URL       sqlite path (default: ./give-evidence.db) or
 *                      a postgres connection string
 *
 * Exit codes:
 *   0  import succeeded (including the no-op re-import case)
 *   1  parse error or missing file (operator should fix input)
 *   2  unexpected error (bug or infrastructure failure)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDb, dbOptionsFromEnv, migrateDb } from "../src/db/index.js";
import {
  ImportParseError,
  importRound,
  parseRoundByContentType,
} from "../src/import/index.js";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return args.length === 1 ? 0 : 1;
  }

  const filePath = path.resolve(args[0] ?? "");
  let body: string;
  try {
    body = readFileSync(filePath, "utf8");
  } catch (err) {
    process.stderr.write(`Could not read file: ${filePath}\n`);
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }

  const contentType = filePath.toLowerCase().endsWith(".json")
    ? "application/json"
    : filePath.toLowerCase().endsWith(".csv")
      ? "text/csv"
      : undefined;

  let payload;
  try {
    payload = parseRoundByContentType(body, contentType);
  } catch (err) {
    if (err instanceof ImportParseError) {
      process.stderr.write(`Parse error: ${err.message}\n`);
      if (err.hint) process.stderr.write(`Hint: ${err.hint}\n`);
      return 1;
    }
    throw err;
  }

  const db = createDb(dbOptionsFromEnv());
  await migrateDb(db);
  const result = await importRound({ db, payload });

  process.stdout.write(
    [
      `Round: ${result.publicSlug} (${result.existed ? "already existed" : "newly created"})`,
      `Grantees: ${result.inserted.grantees} inserted, ${result.skipped.grantees} skipped`,
      `Milestones: ${result.inserted.milestones} inserted, ${result.skipped.milestones} skipped`,
      "",
    ].join("\n"),
  );
  return 0;
}

function printUsage(): void {
  process.stdout.write(
    [
      "Usage: pnpm import:round <file.json|file.csv>",
      "",
      "Environment:",
      "  DATABASE_DIALECT  sqlite (default) | postgres",
      "  DATABASE_URL      sqlite path (default ./give-evidence.db) or postgres URL",
      "",
    ].join("\n"),
  );
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    process.stderr.write(`Unexpected error:\n${(err as Error).stack ?? String(err)}\n`);
    process.exit(2);
  });
