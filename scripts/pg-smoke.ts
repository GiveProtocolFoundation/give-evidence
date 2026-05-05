/**
 * Local Postgres smoke check for the v0 data model. Not part of the
 * test suite — run manually against a disposable database:
 *
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/giv_evidence_test \
 *     pnpm tsx scripts/pg-smoke.ts
 */
import { randomUUID } from "node:crypto";
import {
  createDb,
  insertEvidence,
  insertGrantee,
  insertRound,
  listEvidenceForGrantee,
} from "../src/db/index.js";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required for the Postgres smoke check");
}
const db = createDb({ dialect: "postgres", url });

const roundId = randomUUID();
await insertRound(db, {
  id: roundId,
  funder: "F",
  name: "R",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2026-12-31T23:59:59Z",
  currency: "USD",
  totalAwarded: "1",
  publicSlug: `pg-smoke-${roundId}`,
});
const granteeId = randomUUID();
await insertGrantee(db, {
  id: granteeId,
  roundId,
  projectName: "P",
  githubUrls: ["https://github.com/x/y"],
  deployUrls: ["https://x.io"],
  awardedAmount: "1",
});
await insertEvidence(db, {
  id: randomUUID(),
  granteeId,
  source: "github",
  sourceEventId: "evt1",
  kind: "issue",
  occurredAt: "2026-02-01T00:00:00Z",
  payloadJson: { hello: "world" },
  contentHash: "h1",
});

let dupErr: string | null = null;
try {
  await insertEvidence(db, {
    id: randomUUID(),
    granteeId,
    source: "github",
    sourceEventId: "evt1",
    kind: "issue",
    occurredAt: "2026-02-01T00:00:00Z",
    payloadJson: { hello: "world" },
    contentHash: "h1",
  });
} catch (e) {
  dupErr = String(e);
}

const rows = await listEvidenceForGrantee(db, granteeId);
process.stdout.write(
  `${JSON.stringify({
    inserted: rows.length,
    payload: rows[0]?.payloadJson,
    dup_rejected: dupErr !== null,
  })}\n`,
);
process.exit(0);
