/**
 * Process-singleton database client for the Remix server.
 *
 * Remix re-evaluates route modules on every request in dev; we cache
 * the client on `globalThis` so we don't open and close a SQLite
 * connection (and re-WAL it) per request. Production uses the same
 * pattern.
 *
 * Tests **must not** import this module — they construct their own
 * `:memory:` client per test instead (see `src/db/db.test.ts` and
 * `src/import/round-importer.test.ts`).
 */
import { type Db, createDb, dbOptionsFromEnv, migrateDb } from "../../src/db/index.js";

type AppGlobal = typeof globalThis & {
  __giveEvidenceDb?: Db;
  __giveEvidenceDbMigrated?: boolean;
};

export async function getDb(): Promise<Db> {
  const g = globalThis as AppGlobal;
  if (g.__giveEvidenceDb) {
    if (!g.__giveEvidenceDbMigrated) {
      await migrateDb(g.__giveEvidenceDb);
      g.__giveEvidenceDbMigrated = true;
    }
    return g.__giveEvidenceDb;
  }
  const db = createDb(dbOptionsFromEnv());
  await migrateDb(db);
  g.__giveEvidenceDb = db;
  g.__giveEvidenceDbMigrated = true;
  return db;
}
