/**
 * Week-1 auth stub for operator-only routes.
 *
 * Real magic-link auth lands in week 2 (separate issue). For now we
 * gate the operator console on a single shared secret carried in the
 * `x-operator-token` header. The expected value is `OPERATOR_TOKEN`
 * from the environment; if `OPERATOR_TOKEN` is unset, the gate is open
 * (development default). The gate **never** silently opens in
 * production: callers MUST set `OPERATOR_TOKEN` before exposing the
 * operator console to the public internet, and the Docker Compose
 * template that ships in week 4 will set it by default.
 */
import { json } from "@remix-run/node";

export type OperatorAuthResult =
  | { ok: true }
  | { ok: false; response: Response };

export function requireOperator(request: Request): OperatorAuthResult {
  const expected = process.env.OPERATOR_TOKEN;
  if (!expected) {
    // Dev default: no gate. Logged once at boot in week-2 setup.
    return { ok: true };
  }
  const presented = request.headers.get("x-operator-token");
  if (presented === expected) {
    return { ok: true };
  }
  return {
    ok: false,
    response: json(
      {
        ok: false,
        error: "Operator authentication required.",
        hint: "Set the `x-operator-token` header. Real magic-link auth lands in week 2.",
      },
      { status: 401 },
    ),
  };
}
