# Fixtures

Synthetic test data used by the v0 build. Nothing here is real grant data — funders' real submissions never live in the repo.

## `round-synthetic-v0.json` / `round-synthetic-v0.csv`

A synthetic round shape that exercises every field the importer cares about:

- One round (`synthetic-foundation-2026-q2`) with five grantees.
- Grantees vary in coverage: some have multiple GitHub URLs, some have an OSO project id, one has no deploy URL, one has milestones declared.
- Both files describe the **same logical round**, so importing one and then the other against the same database is a no-op on the second run (this is the idempotency acceptance criterion on GIV-11).

To exercise the importer:

```bash
# JSON path
pnpm import:round fixtures/round-synthetic-v0.json

# CSV path (re-running the JSON would be a no-op, so do CSV against a fresh DB)
DATABASE_URL=./.scratch/import-csv.db pnpm import:round fixtures/round-synthetic-v0.csv

# Re-running either against the same DB should report 5 grantees skipped.
pnpm import:round fixtures/round-synthetic-v0.json
```
