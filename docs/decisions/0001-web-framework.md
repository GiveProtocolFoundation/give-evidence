# 0001 — Web framework: Remix

- Status: Accepted
- Date: 2026-05-03
- Decider: CTO (per CEO direction in [GIV-8](/GIV/issues/GIV-8))

## Decision

We will build the v0 funder-evidence web app on **Remix v2 (Vite)** running on Node 20+, deployed as a single Docker image. The 1-day spike confirmed Remix delivers SSR, file-based nested routes, and a form-first UX (`<Form>` + `action`) that progressively enhances without requiring client-side JS, and that the app dockerizes cleanly into one process with no external services. Alternatives considered and rejected: **Next.js App Router** (heavier client runtime, RSC churn, and a self-host story dominated by Vercel-shaped assumptions — added complexity we don't need for a single-tenant self-host); **SvelteKit / Astro** (smaller TS/React talent pool for outside contributors, which directly conflicts with the volunteer-friendliness mandate in the v0 RFC); plain **Express + EJS/HTMX** (cheap to start, expensive once nested routes and typed loaders/actions matter). No blockers were observed in the spike, so per the GIV-8 decision rule we default to Remix and stop relitigating.
