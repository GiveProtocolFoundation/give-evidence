/**
 * Pure validation helpers for the attestation form.
 *
 * Kept separate from the route so we can unit-test it without spinning up
 * a Remix request, and reuse it from adapters that don't go through the
 * web form (CSV import, API endpoints, etc).
 */

const NOTE_MIN_LENGTH = 10;

export type AttestationInput = {
  granteeId: string;
  note: string;
};

export type AttestationValidationResult =
  | { ok: true; value: AttestationInput }
  | { ok: false; fieldErrors: Partial<Record<keyof AttestationInput, string>> };

export function validateAttestation(input: AttestationInput): AttestationValidationResult {
  const granteeId = input.granteeId.trim();
  const note = input.note.trim();

  const fieldErrors: Partial<Record<keyof AttestationInput, string>> = {};
  if (!granteeId) fieldErrors.granteeId = "Pick a grantee.";
  if (note.length < NOTE_MIN_LENGTH) {
    fieldErrors.note = `Note must be at least ${NOTE_MIN_LENGTH} characters.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, value: { granteeId, note } };
}
