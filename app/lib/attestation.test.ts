import { describe, expect, it } from "vitest";

import { validateAttestation } from "./attestation.js";

describe("validateAttestation", () => {
  it("accepts a valid attestation", () => {
    const result = validateAttestation({
      granteeId: "g-1",
      note: "Shipped milestone 2; see https://example.org/release/0.2.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.granteeId).toBe("g-1");
    }
  });

  it("rejects an empty grantee", () => {
    const result = validateAttestation({
      granteeId: "   ",
      note: "Shipped a thing worth talking about.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.granteeId).toMatch(/grantee/i);
    }
  });

  it("rejects a too-short note", () => {
    const result = validateAttestation({ granteeId: "g-1", note: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.note).toMatch(/at least/i);
    }
  });
});
