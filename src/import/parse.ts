/**
 * Parsers for the two supported intake formats:
 *
 *   - JSON: a single object matching `RoundPayload` directly. This is
 *     the format `scripts/import-round.ts` defaults to and the format
 *     adapter authors will reach for first.
 *   - CSV: a denormalised, one-row-per-grantee format with the round
 *     metadata repeated on each row. This is the format funders'
 *     existing spreadsheets typically export to, so we accept it
 *     verbatim rather than asking them to reshape.
 *
 * Both parsers normalise into `RoundPayload` so the importer doesn't
 * care which on-disk format the operator started from.
 *
 * v0 design notes:
 *   - We do not pull a CSV library. RFC 4180 quoting is implemented
 *     inline because the only consumer is the operator console and the
 *     synthetic fixture, and the alternative is shipping `papaparse`
 *     or `csv-parse` into a project that doesn't otherwise need them.
 *   - Multi-value cells (e.g. multiple github URLs) use `;` as the
 *     intra-cell separator. This is the same convention as the
 *     synthetic fixture in `fixtures/round-synthetic-v0.csv`.
 *   - Milestones are not expressible in flat CSV; CSV imports yield
 *     grantees with `milestones: []`. Funders who care about
 *     pre-declared milestones should use the JSON format.
 */
import { ImportParseError, type GranteeInput, type RoundPayload } from "./types.js";

const REQUIRED_ROUND_FIELDS = [
  "funder",
  "name",
  "startsAt",
  "endsAt",
  "currency",
  "totalAwarded",
  "publicSlug",
] as const;

const REQUIRED_GRANTEE_FIELDS = ["projectName", "awardedAmount"] as const;

/** Parse a JSON-encoded round file. */
export function parseRoundJson(input: string): RoundPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(stripBom(input));
  } catch (err) {
    throw new ImportParseError(
      `JSON is not well-formed: ${(err as Error).message}`,
      "Run the file through `jq .` to find the line/column of the syntax error.",
    );
  }
  return normaliseRound(raw);
}

/**
 * Parse a denormalised CSV. Header row is required and must include all
 * `REQUIRED_ROUND_FIELDS` plus the grantee fields (`projectName`,
 * `awardedAmount` at minimum; optionally `githubUrls`, `deployUrls`,
 * `osoProjectId`, `contactEmail`).
 *
 * Multi-value cells use `;` as the in-cell separator. Empty cells are
 * normalised to `undefined`.
 */
export function parseRoundCsv(input: string): RoundPayload {
  const rows = splitCsvRows(stripBom(input));
  if (rows.length === 0) {
    throw new ImportParseError("CSV is empty.", "Expected a header row plus at least one grantee.");
  }
  const [header, ...dataRows] = rows;
  if (!header) {
    throw new ImportParseError("CSV header row is missing.");
  }
  if (dataRows.length === 0) {
    throw new ImportParseError(
      "CSV has no grantee rows.",
      "Expected at least one row of grantee data after the header.",
    );
  }

  const colIndex = new Map<string, number>();
  for (let i = 0; i < header.length; i++) {
    const key = header[i]?.trim();
    if (key) colIndex.set(key, i);
  }

  for (const field of REQUIRED_ROUND_FIELDS) {
    if (!colIndex.has(field)) {
      throw new ImportParseError(`CSV header is missing required column: "${field}".`);
    }
  }
  for (const field of REQUIRED_GRANTEE_FIELDS) {
    if (!colIndex.has(field)) {
      throw new ImportParseError(`CSV header is missing required column: "${field}".`);
    }
  }

  const readCell = (row: string[], col: string): string | undefined => {
    const idx = colIndex.get(col);
    if (idx === undefined) return undefined;
    const cell = row[idx];
    if (cell === undefined) return undefined;
    const trimmed = cell.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  // The round metadata must be identical on every row. We read the first
  // row as authoritative and fail loudly if any subsequent row disagrees.
  const firstRow = dataRows[0];
  if (!firstRow) {
    throw new ImportParseError("CSV has no grantee rows.");
  }
  const roundMeta = {
    funder: requireCell(firstRow, "funder", colIndex),
    name: requireCell(firstRow, "name", colIndex),
    startsAt: requireCell(firstRow, "startsAt", colIndex),
    endsAt: requireCell(firstRow, "endsAt", colIndex),
    currency: requireCell(firstRow, "currency", colIndex),
    totalAwarded: requireCell(firstRow, "totalAwarded", colIndex),
    publicSlug: requireCell(firstRow, "publicSlug", colIndex),
  };

  const grantees: GranteeInput[] = dataRows.map((row, i) => {
    for (const field of REQUIRED_ROUND_FIELDS) {
      const here = requireCell(row, field, colIndex);
      const expected = roundMeta[field];
      if (here !== expected) {
        throw new ImportParseError(
          `Row ${i + 2}: round metadata column "${field}" disagrees with row 2 ("${here}" vs "${expected}").`,
          "All rows in a CSV round import must repeat the same round metadata.",
        );
      }
    }
    return {
      projectName: requireCell(row, "projectName", colIndex),
      awardedAmount: requireCell(row, "awardedAmount", colIndex),
      githubUrls: splitMulti(readCell(row, "githubUrls")),
      deployUrls: splitMulti(readCell(row, "deployUrls")),
      osoProjectId: readCell(row, "osoProjectId") ?? null,
      contactEmail: readCell(row, "contactEmail") ?? null,
      milestones: [],
    };
  });

  return { ...roundMeta, grantees };
}

/**
 * Parse a `name=value` content-type header and dispatch to the right
 * parser. The operator console uses this so the same upload field can
 * accept either format.
 */
export function parseRoundByContentType(input: string, contentType: string | undefined): RoundPayload {
  const normalised = (contentType ?? "").toLowerCase();
  if (normalised.includes("json")) return parseRoundJson(input);
  if (normalised.includes("csv") || normalised.includes("text/plain")) {
    return parseRoundCsv(input);
  }
  // Fall through: sniff by first non-whitespace character.
  const trimmed = stripBom(input).trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseRoundJson(input);
  return parseRoundCsv(input);
}

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function splitMulti(cell: string | undefined): string[] | undefined {
  if (cell === undefined) return undefined;
  return cell
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function requireCell(row: string[], col: string, idx: Map<string, number>): string {
  const i = idx.get(col);
  if (i === undefined) {
    throw new ImportParseError(`CSV is missing required column: "${col}".`);
  }
  const raw = row[i];
  if (raw === undefined || raw.trim() === "") {
    throw new ImportParseError(`Required CSV cell is empty in column "${col}".`);
  }
  return raw.trim();
}

/**
 * RFC 4180-style CSV row splitter. Handles quoted fields with embedded
 * commas, doubled-quote escaping, and CRLF or LF line endings. We do
 * not support multi-line records inside quoted fields (the synthetic
 * fixture doesn't need them and it keeps the parser auditable).
 */
function splitCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    if (line === "") continue;
    rows.push(splitCsvLine(line));
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  cells.push(cur);
  return cells;
}

function normaliseRound(raw: unknown): RoundPayload {
  if (!isObject(raw)) {
    throw new ImportParseError("JSON root must be an object.");
  }
  for (const field of REQUIRED_ROUND_FIELDS) {
    if (typeof raw[field] !== "string" || (raw[field] as string).trim() === "") {
      throw new ImportParseError(`JSON is missing required string field: "${field}".`);
    }
  }
  if (!Array.isArray(raw.grantees) || raw.grantees.length === 0) {
    throw new ImportParseError(
      `JSON field "grantees" must be a non-empty array.`,
      "v0 expects at least one grantee per round.",
    );
  }

  const grantees: GranteeInput[] = raw.grantees.map((g, i) => {
    if (!isObject(g)) {
      throw new ImportParseError(`grantees[${i}] is not an object.`);
    }
    for (const field of REQUIRED_GRANTEE_FIELDS) {
      if (typeof g[field] !== "string" || (g[field] as string).trim() === "") {
        throw new ImportParseError(`grantees[${i}] is missing required field "${field}".`);
      }
    }
    return {
      projectName: (g.projectName as string).trim(),
      awardedAmount: (g.awardedAmount as string).trim(),
      githubUrls: optionalStringArray(g.githubUrls, `grantees[${i}].githubUrls`),
      deployUrls: optionalStringArray(g.deployUrls, `grantees[${i}].deployUrls`),
      osoProjectId: optionalNullableString(g.osoProjectId, `grantees[${i}].osoProjectId`),
      contactEmail: optionalNullableString(g.contactEmail, `grantees[${i}].contactEmail`),
      milestones: optionalMilestones(g.milestones, `grantees[${i}].milestones`),
    };
  });

  return {
    funder: (raw.funder as string).trim(),
    name: (raw.name as string).trim(),
    startsAt: (raw.startsAt as string).trim(),
    endsAt: (raw.endsAt as string).trim(),
    currency: (raw.currency as string).trim(),
    totalAwarded: (raw.totalAwarded as string).trim(),
    publicSlug: (raw.publicSlug as string).trim(),
    grantees,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function optionalStringArray(v: unknown, path: string): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) {
    throw new ImportParseError(`${path} must be an array of strings.`);
  }
  for (const item of v) {
    if (typeof item !== "string") {
      throw new ImportParseError(`${path} contains a non-string entry.`);
    }
  }
  return (v as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
}

function optionalNullableString(v: unknown, path: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") {
    throw new ImportParseError(`${path} must be a string or null.`);
  }
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalMilestones(v: unknown, path: string): GranteeInput["milestones"] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    throw new ImportParseError(`${path} must be an array.`);
  }
  return v.map((m, i) => {
    if (!isObject(m)) {
      throw new ImportParseError(`${path}[${i}] is not an object.`);
    }
    if (typeof m.title !== "string" || m.title.trim() === "") {
      throw new ImportParseError(`${path}[${i}].title is required.`);
    }
    const dueAt = optionalNullableString(m.dueAt, `${path}[${i}].dueAt`) ?? null;
    return { title: m.title.trim(), dueAt };
  });
}
