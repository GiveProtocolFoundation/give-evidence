/**
 * Operator-only route: upload a round CSV or JSON file.
 *
 * Routing: file path `operator.import.tsx` → URL `/operator/import`.
 *
 * Week-1 auth: shared-secret header. Real magic-link auth is a
 * week-2 issue; see `app/lib/auth.server.ts`.
 *
 * The route exposes both a JSON API (POST with `Content-Type:
 * application/json` or `text/csv`, body is the raw file content) and a
 * progressive-enhancement HTML form (POST with `multipart/form-data`,
 * file field `roundFile`). Both paths go through the same importer in
 * `src/import/round-importer.ts` so the operator console and adapter
 * authors hit identical persistence behavior.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { requireOperator } from "~/lib/auth.server.js";
import { getDb } from "~/lib/db.server.js";
import {
  ImportParseError,
  type ImportResult,
  importRound,
  parseRoundByContentType,
} from "../../src/import/index.js";

export const meta: MetaFunction = () => [
  { title: "Operator console — import round" },
  { name: "description", content: "Upload a CSV or JSON round file to seed grantees and milestones." },
];

type FieldError = { field: string; message: string };

type ActionResult =
  | { ok: true; result: ImportResult }
  | { ok: false; status: number; error: string; hint?: string; fieldErrors?: FieldError[] };

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = requireOperator(request);
  if (!auth.ok) {
    throw auth.response;
  }
  return json({
    authStubActive: !process.env.OPERATOR_TOKEN,
    week: 1,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const auth = requireOperator(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: string;
  let contentType: string | undefined;
  const requestContentType = request.headers.get("content-type") ?? "";

  if (requestContentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("roundFile");
    if (!(file instanceof File)) {
      return jsonAction(
        {
          ok: false,
          status: 400,
          error: "No file uploaded.",
          fieldErrors: [{ field: "roundFile", message: "Select a .csv or .json file to upload." }],
        },
      );
    }
    body = await file.text();
    contentType = file.type || guessContentTypeFromName(file.name);
  } else {
    body = await request.text();
    contentType = requestContentType;
  }

  if (body.trim() === "") {
    return jsonAction({
      ok: false,
      status: 400,
      error: "Uploaded file is empty.",
    });
  }

  try {
    const payload = parseRoundByContentType(body, contentType);
    const db = await getDb();
    const result = await importRound({ db, payload });
    return jsonAction({ ok: true, result });
  } catch (err) {
    if (err instanceof ImportParseError) {
      return jsonAction({
        ok: false,
        status: 400,
        error: err.message,
        hint: err.hint,
      });
    }
    throw err;
  }
}

function jsonAction(result: ActionResult) {
  const status = result.ok ? 200 : result.status;
  return json(result, { status });
}

function guessContentTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  return "";
}

export default function OperatorImport() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>Operator console — import round</h1>
      <p style={{ color: "#444", fontSize: 14 }}>
        Upload a CSV or JSON file describing one funding round. Re-uploading the same file is a
        no-op (idempotent on <code>publicSlug</code> +{" "}
        <code>(roundId, projectName)</code>).
      </p>
      {data.authStubActive ? (
        <p style={{ color: "#a04400", fontSize: 13 }}>
          Auth stub active (week 1): set <code>OPERATOR_TOKEN</code> to require a header. Real
          magic-link auth lands in week 2.
        </p>
      ) : null}

      <Form method="post" encType="multipart/form-data" style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          <div>Round file (.csv or .json)</div>
          <input type="file" name="roundFile" accept=".csv,.json,application/json,text/csv" required />
        </label>
        <div>
          <button type="submit">Import round</button>
        </div>
      </Form>

      {actionData ? <ResultPanel result={actionData} /> : null}
    </main>
  );
}

function ResultPanel({ result }: { result: ActionResult }) {
  if (result.ok) {
    const r = result.result;
    return (
      <section
        style={{
          marginTop: "1.5rem",
          padding: "0.75rem 1rem",
          background: "#eef9ee",
          border: "1px solid #b6e0b6",
          borderRadius: 6,
        }}
      >
        <strong>Import succeeded.</strong>
        <ul>
          <li>
            Round: <code>{r.publicSlug}</code> ({r.existed ? "already existed, reused" : "newly created"})
          </li>
          <li>
            Grantees: {r.inserted.grantees} inserted, {r.skipped.grantees} skipped (already present)
          </li>
          <li>
            Milestones: {r.inserted.milestones} inserted, {r.skipped.milestones} skipped
          </li>
        </ul>
      </section>
    );
  }
  return (
    <section
      style={{
        marginTop: "1.5rem",
        padding: "0.75rem 1rem",
        background: "#fdecec",
        border: "1px solid #e6a6a6",
        borderRadius: 6,
      }}
    >
      <strong>Import failed.</strong>
      <p style={{ marginTop: "0.25rem" }}>{result.error}</p>
      {result.hint ? <p style={{ fontSize: 13, color: "#555" }}>Hint: {result.hint}</p> : null}
      {result.fieldErrors?.length
        ? (
          <ul>
            {result.fieldErrors.map((fe) => (
              <li key={fe.field}>
                <strong>{fe.field}:</strong> {fe.message}
              </li>
            ))}
          </ul>
        )
        : null}
    </section>
  );
}
