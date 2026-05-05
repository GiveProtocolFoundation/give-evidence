import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

import { validateAttestation } from "~/lib/attestation";
import { logger } from "~/lib/logger.server";

// v0 placeholder route. Stand-in for the real attestation submission flow.
// Exercises the same loader + action + form-first pattern the production
// adapters will use, against an in-memory dataset.

export const meta: MetaFunction = () => [
  { title: "Give Evidence — v0" },
  {
    name: "description",
    content: "Funder-side accountability infrastructure — v0 skeleton.",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  logger.debug({ url: request.url }, "loader: index");
  return {
    round: { slug: "v0-round", name: "v0 Demo Round" },
    grantees: [
      { id: "g-1", name: "Open Source Project A", lastEvidenceAt: new Date().toISOString() },
      { id: "g-2", name: "Public Goods Toolkit B", lastEvidenceAt: null },
    ],
    serverNow: new Date().toISOString(),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const result = validateAttestation({
    granteeId: String(form.get("granteeId") ?? ""),
    note: String(form.get("note") ?? ""),
  });

  if (!result.ok) {
    logger.info({ fieldErrors: result.fieldErrors }, "attestation: validation failed");
    return Response.json({ ok: false as const, fieldErrors: result.fieldErrors }, { status: 400 });
  }

  // Real impl persists via Drizzle (GIV-10). v0 skeleton just echoes.
  const received = { ...result.value, at: new Date().toISOString() };
  logger.info(
    { granteeId: result.value.granteeId, noteLength: result.value.note.length },
    "attestation: received",
  );
  return { ok: true as const, received };
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Give Evidence — v0</h1>
        <p className="mt-1 text-sm text-slate-600">
          Round: <strong>{data.round.name}</strong>{" "}
          <span className="text-slate-400">({data.round.slug})</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">SSR rendered at: {data.serverNow}</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">Submit milestone attestation</h2>

        <Form method="post" className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-700">Grantee</span>
            <select
              name="granteeId"
              defaultValue=""
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="" disabled>
                Select a grantee
              </option>
              {data.grantees.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {actionData && !actionData.ok && actionData.fieldErrors.granteeId ? (
              <small className="text-xs text-red-600">{actionData.fieldErrors.granteeId}</small>
            ) : null}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-700">Note</span>
            <textarea
              name="note"
              rows={4}
              placeholder="What shipped, with a link to evidence."
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {actionData && !actionData.ok && actionData.fieldErrors.note ? (
              <small className="text-xs text-red-600">{actionData.fieldErrors.note}</small>
            ) : null}
          </label>

          <div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Submit attestation
            </button>
          </div>
        </Form>

        {actionData?.ok ? (
          <aside className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <strong className="block mb-1 text-emerald-800">Received.</strong>
            <pre className="whitespace-pre-wrap text-xs text-emerald-900">
              {JSON.stringify(actionData.received, null, 2)}
            </pre>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
