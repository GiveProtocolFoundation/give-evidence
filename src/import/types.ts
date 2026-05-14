/**
 * Canonical round-import payload.
 *
 * Both the CSV and JSON parsers normalise into this shape before the
 * importer touches the database. The fields mirror `RoundInsert` and
 * `GranteeInsert` in `src/db/queries.ts`, but accept `undefined` for
 * optional inputs and represent monetary amounts as plain strings (we
 * never round-trip through JS `number` because grant amounts can exceed
 * `Number.MAX_SAFE_INTEGER` in low-decimal currencies).
 */
export type GranteeInput = {
  projectName: string;
  awardedAmount: string;
  githubUrls?: string[];
  deployUrls?: string[];
  osoProjectId?: string | null;
  contactEmail?: string | null;
  /**
   * Optional list of milestones declared at intake time. The "Manual
   * Milestone Attestation" adapter will *update* status / evidence /
   * attestation later; intake creates the initial `declared` row.
   */
  milestones?: MilestoneInput[];
};

export type MilestoneInput = {
  title: string;
  dueAt?: string | null;
};

export type RoundPayload = {
  funder: string;
  name: string;
  startsAt: string;
  endsAt: string;
  currency: string;
  totalAwarded: string;
  publicSlug: string;
  grantees: GranteeInput[];
};

/**
 * Result returned by `importRound`. Counts let the caller / UI show a
 * useful confirmation ("Inserted 5 grantees; 0 already present"). The
 * `existed` flag tells you whether this was a fresh import or a no-op
 * replay against an existing round.
 */
export type ImportResult = {
  roundId: string;
  publicSlug: string;
  existed: boolean;
  inserted: {
    grantees: number;
    milestones: number;
  };
  skipped: {
    grantees: number;
    milestones: number;
  };
};

/**
 * Discriminated parse-error shape. We throw `ImportParseError` from the
 * parsers so callers can distinguish input-shape problems (operator
 * needs to fix the file) from infrastructure failures (DB down).
 */
export class ImportParseError extends Error {
  readonly kind = "import_parse_error" as const;
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "ImportParseError";
  }
}
