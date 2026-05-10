# Give Evidence — Remix spike (GIV-8)

One-day framework spike per [GIV-8](/GIV/issues/GIV-8). Default decision: **Remix**.

## What this proves

- SSR via `loader` (server-rendered HTML on first request).
- Form-first UX via `<Form method="post">` + `action` (works without JS).
- Nested routes via `app/routes/` file-based routing (single route here, the pattern is the same).
- Self-host story via single Dockerfile, no external services.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 (vite dev)
npm run build && npm run start   # http://localhost:3000 (production)
```

## Run in Docker

```bash
docker build -t give-evidence-spike .
docker run --rm -p 3000:3000 give-evidence-spike
```

## ADR

See [`docs/decisions/0001-web-framework.md`](docs/decisions/0001-web-framework.md).

## Spike branch notes

- This branch is the **GIV-8 framework spike**. It is intentionally kept on `npm` to keep the spike self-contained; the main repo standardizes on `pnpm` (see [GIV-7](/GIV/issues/GIV-7)). When the Remix app proper lands (per [GIV-9](/GIV/issues/GIV-9)) it will be re-resolved against `pnpm-lock.yaml`.
- This branch is **not intended to merge into `main` as-is** — its job is to prove the framework works. The real skeleton lands via [GIV-9](/GIV/issues/GIV-9).
