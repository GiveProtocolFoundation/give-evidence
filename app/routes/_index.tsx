import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

// Spike scope:
// - one loader (SSR-rendered server data)
// - one form action (progressive-enhancement, no-JS friendly)
// - validates Remix's form-first UX story for the v0 evidence app
//
// Stand-in for an attestation submission: a funder pastes a milestone note,
// server validates length, persists nothing yet, returns confirmation. This
// is the shape of the real "Manual Milestone Attestation" adapter flow.

export const meta: MetaFunction = () => [
  { title: "Give Evidence — Remix spike" },
  { name: "description", content: "GIV-8 framework spike: SSR + nested routes + form-first UX." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  // Stand-in for "load a round and its evidence summary". Server-rendered.
  return json({
    round: { slug: "spike-round", name: "Spike Round" },
    grantees: [
      { id: "g-1", name: "Open Source Project A", lastEvidenceAt: new Date().toISOString() },
      { id: "g-2", name: "Public Goods Toolkit B", lastEvidenceAt: null },
    ],
    serverNow: new Date().toISOString(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const granteeId = String(form.get("granteeId") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!granteeId) fieldErrors.granteeId = "Pick a grantee.";
  if (note.length < 10) fieldErrors.note = "Note must be at least 10 characters.";

  if (Object.keys(fieldErrors).length > 0) {
    return json({ ok: false as const, fieldErrors }, { status: 400 });
  }

  // Real impl persists via Drizzle; spike just echoes.
  return json({
    ok: true as const,
    received: { granteeId, note, at: new Date().toISOString() },
  });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>Give Evidence — Remix spike</h1>
      <p>
        Round: <strong>{data.round.name}</strong> ({data.round.slug})
      </p>
      <p style={{ color: "#666", fontSize: 14 }}>SSR rendered at: {data.serverNow}</p>

      <h2>Submit milestone attestation</h2>
      <Form method="post" style={{ display: "grid", gap: "0.75rem", maxWidth: 480 }}>
        <label>
          <div>Grantee</div>
          <select name="granteeId" defaultValue="">
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
            <small style={{ color: "crimson" }}>{actionData.fieldErrors.granteeId}</small>
          ) : null}
        </label>

        <label>
          <div>Note</div>
          <textarea name="note" rows={4} placeholder="What shipped, with a link to evidence." />
          {actionData && !actionData.ok && actionData.fieldErrors.note ? (
            <small style={{ color: "crimson" }}>{actionData.fieldErrors.note}</small>
          ) : null}
        </label>

        <div>
          <button type="submit">Submit attestation</button>
        </div>
      </Form>

      {actionData && actionData.ok ? (
        <section style={{ marginTop: "1.5rem", padding: "0.75rem 1rem", background: "#eef9ee", border: "1px solid #b6e0b6", borderRadius: 6 }}>
          <strong>Received.</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(actionData.received, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}
