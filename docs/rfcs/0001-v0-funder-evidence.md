# RFC 0001 — v0: Funder-side Accountability Infrastructure for Public-Goods Grant Programs

| | |
|---|---|
| **Status** | Proposed (v0) |
| **Author** | CTO, Give Protocol Foundation |
| **Repository** | [`GiveProtocolFoundation/give-evidence`](https://github.com/GiveProtocolFoundation/give-evidence) |
| **License** | Apache-2.0 (code), CC-BY-4.0 (this document) |
| **Discussion** | [GitHub Discussions — RFC 0001](https://github.com/GiveProtocolFoundation/give-evidence/discussions/categories/rfcs) |
| **Tracking issue** | Internal: GIV-3 (proposal), GIV-6 (epic), GIV-12 (this RFC) |

> This is a public **request for comments**. We are publishing the proposal *before* the code is finished so that funders, contributors, and skeptics can shape what `v0` becomes. Push back early — that is the entire point of an RFC.

---

## TL;DR

We are building a self-hostable, open-source web app that lets a public-goods funder ingest a grant round, automatically gather evidence of what each grantee shipped (GitHub activity, deploy liveness, OSO metrics, manual milestone attestations), and publish a queryable per-program "what was funded, what shipped" report.

The first version is intentionally:

- **chain-agnostic** — no token, no smart contracts, no chain in `v0`,
- **single-tenant per install** — self-host first, no SaaS,
- **anchored on one real funder partner** (with a synthetic-demo fallback we are explicit about),
- and built from boring, well-understood tools so a single engineer plus volunteer contributors can ship it in **6–8 weeks**.

We are explicitly **not** building a new funding rail, a new chain, a new token, an attestation issuer, or a multi-tenant SaaS in `v0`.

---

## 1. Problem and target user

### The problem

After a public-goods grant round closes, funders cannot answer the simplest question their boards, donors, and communities ask: **"What did the money actually produce?"**

Today the answer is reconstructed manually from grantee Notion docs, Discord screenshots, and program-manager spreadsheets. Evidence is not standardized, not addressable, and rarely public. This penalizes the funders most committed to transparency (they spend the most ops time on it) and rewards opacity.

### The target user (`v0`)

A **program operator at a small-to-mid public-goods grant program** running rounds in the $100k–$10M range. Concretely:

- A round operator at Gitcoin or a Gitcoin-style quadratic round.
- A regrantor or citizen-style allocator inside Optimism RPGF.
- An Ethereum Foundation ESP / Protocol Labs small-grants program manager who today lives in spreadsheets and wishes they did not.

These users are technical-adjacent (comfortable with CSVs and Markdown), have decision authority over a real budget, and have a recurring named pain. They are not the grantee; they are the funder.

### Why this user, not the grantee or the maintainer

The funder is the buyer with budget and pain. Grantees fill in forms when funders make them; OSS maintainers are poor; small civic orgs are poor and fragmented. We pick the funder because that is where the next dollar of accountability work has the highest leverage.

---

## 2. Architecture (high-level)

The system is a **batch-oriented evidence pipeline with a server-rendered report frontend**, packaged as one deployable unit.

### Conceptual flow

1. **Round import.** The operator loads a round definition into the system as a CSV or JSON file: round name, period, list of grantees, per-grantee metadata (project name, GitHub org/repo URLs, deploy URLs, optional `oso_project_id`, optional milestone list, amount awarded).
2. **Source adapters run on a schedule.** Pluggable adapters fetch evidence per grantee from external sources. Each adapter is a small typed module that takes a grantee record and returns a normalized list of `EvidenceItem`s (with kind, timestamp, source URL, raw payload, and a stable content hash). Adapter set for `v0` is locked at four (see §4).
3. **Evidence store.** All evidence is persisted in a single relational database with an append-only `evidence` table, joined to `grants`, `grantees`, and `rounds`. Idempotency is by `(grantee_id, source, source_event_id, content_hash)`.
4. **Renderer.** A server-rendered web app produces two surfaces:
   - An **operator console** (auth-gated): one round per page, with per-grantee evidence streams, milestone status, and an "export public report" action.
   - A **public report** (no auth): a stable URL per round that renders as static HTML — what was funded, what shipped, links to evidence, last-updated timestamp. Designed to be embedded by funders in their own reports.
5. **Self-host packaging.** The whole system runs as a single container with SQLite by default (Postgres optional via env), one config file, and a `docker compose up` quickstart. No cloud dependency.

### Component diagram

```
[Operator] --(CSV/JSON round import)--> [Round Importer]
                                              |
                                              v
                                        [Postgres / SQLite]
                                              ^
                                              |
[Source Adapters] <--(scheduled)-- [Adapter Runner / Queue]
   - GitHub Activity                          |
   - HTTP Liveness                            |
   - OSO Metrics                              |
   - Manual Milestone Attestation             v
                                       [Web App (SSR)]
                                        /            \
                              [Operator console]   [Public report]
                              (auth-gated)         (static, public URL)
```

There is no separate frontend SPA, no microservices, no message broker. The "queue" is a database table consumed by an in-process worker; we will reach for a real broker only if we outgrow it (we will not in `v0`).

### Data model (sketch — finalized in week 1)

- `rounds(id, funder, name, starts_at, ends_at, currency, total_awarded, public_slug)`
- `grantees(id, round_id, project_name, github_urls[], deploy_urls[], oso_project_id, awarded_amount, contact_email)`
- `milestones(id, grantee_id, title, due_at, status, evidence_summary, attested_by, attested_at)`
- `evidence(id, grantee_id, source, source_event_id, kind, occurred_at, url, payload_json, content_hash, collected_at)`
- `reports(id, round_id, slug, published_at, snapshot_json)`
- `jobs(id, kind, payload_json, run_after, attempts, last_error, locked_at)`

`evidence` is append-only on purpose — the report at any time `T` should be reproducible from the evidence visible at `T`.

---

## 3. Tech stack — choices and rationales

Boring on purpose. Each choice optimizes for "a competent OSS volunteer can read the diff."

| Layer | Choice | One-line rationale |
|---|---|---|
| Language | **TypeScript** | Largest plausible volunteer pool overlapping civic-tech, OSS-funding, and crypto-PG ecosystems. |
| Runtime | **Node.js (LTS)** | Boring, ubiquitous, no need for a more exotic runtime in `v0`. |
| Web framework | **Remix** | SSR + nested routing + form-first UX with the smoothest self-host story; we'll reverse-decide to Next App Router only if a blocker surfaces. See [ADR 0001](../decisions/0001-web-framework.md). |
| Database | **SQLite by default, Postgres optional** | SQLite makes self-host trivial (`docker compose up`); Postgres is a one-env-var swap for funders who want it. |
| ORM / query | **Drizzle** | Typed, lightweight, plays well with both SQLite and Postgres without a heavyweight migration story. |
| Auth (operator console) | **Email magic links via SMTP** | No SSO complexity in `v0`; magic links are well understood and self-hostable. |
| Background jobs | **In-process worker reading the `jobs` table** | One container, no Redis, no separate worker process; upgrade path is obvious. |
| Frontend styling | **Tailwind + shadcn/ui** | Familiar to the contributor pool, accessible defaults, no design-system invention. |
| Source adapters | **Plain async functions matching a typed `Adapter` interface** | Maximally legible; a volunteer can add an adapter in a single PR. |
| Deploy target | **Docker container; one-command `docker compose up`** | Self-host is the `v0` distribution model; containers are the lingua franca. |
| CI | **GitHub Actions** | Zero-friction OSS default. |
| Tests | **Vitest** for unit/integration, **Playwright** for one happy-path E2E | Enough confidence to refactor; not so much it slows volunteer PRs. |
| Lint / format | **Biome** | One tool for lint + format; faster onboarding than ESLint+Prettier for newcomers. |
| Logs | **Pino structured logs to stdout** | Zero infra dependency; operators ship logs wherever they want. |
| Telemetry | **Off by default; opt-in anonymous health pings only** | Public-goods infra cannot ship surveillance by default. |
| Chain posture | **Chain-agnostic in `v0`; optional Hypercerts/EAS adapters in `v1`** | Locked, but not a permanent neutrality commitment — we keep the door open. |
| License | **Apache-2.0 (code), CC-BY-4.0 (docs & datasets)** | Locked. Permissive enough for funder adoption; explicit patent grant; familiar to the contributor pool. |

### Choices we deliberately rejected for `v0`

- **Smart contracts / onchain anything** — adds review surface and contributor friction with no `v0` user benefit.
- **Microservices** — the system is a batch pipeline with a UI; one process is correct.
- **Multi-tenant SaaS** — single-tenant self-host first; we have not earned the right to operate other people's data.
- **Custom design system** — shadcn/ui is good enough.
- **A new query language for evidence** — relational + JSON columns is enough until it isn't.

---

## 4. `v0` scope — what we *are* building

A single self-hostable web app that:

1. **Imports a grant round** from CSV or JSON via the operator console.
2. **Runs four named source adapters** per grantee on a schedule (the `v0` adapter set is locked):
   - **GitHub Activity** — commits, releases, merged PRs on declared repos, with rate-limit-friendly backoff.
   - **HTTP Liveness** — uptime sample and last successful response for declared deploy URLs.
   - **OSO Metrics** — downloads, depended-on count, contributor count by `oso_project_id`.
   - **Manual Milestone Attestation** — Markdown attestations submitted by the grantee or operator via signed link, stored as evidence items with the same shape as automated sources.
3. **Renders a public per-round report page** at `/r/{round-slug}` showing, per grantee: amount awarded, what was claimed, what evidence was found, and when each piece of evidence appeared.
4. **Lets the operator export the report** as a static HTML bundle for embedding in the funder's own site.
5. **Ships with a `docker compose up` quickstart**, a 10-minute self-host guide, an end-to-end demo round, and a `CONTRIBUTING.md` that explains how to write a new source adapter in one file.

### Definition of done for `v0`

- One real funder partner has imported one real round and approved the resulting public report. *Contingency:* if partner outreach fails the 2-week timebox, fall back to a clearly-labelled synthetic-data demo (see §5).
- The repo has at least one external contributor PR merged.
- The self-host quickstart works on a fresh Linux box in under 15 minutes from a clean checkout.

---

## 5. Funder-partner outreach plan and synthetic-demo fallback

Outreach is sequential, with a hard 2-week timebox total:

- **Week 1, days 1–4 — Optimism RPGF regrantor / citizen.** Most aligned community: retroactive funding by definition needs post-hoc evidence.
- **Week 1, days 5–7 — Gitcoin round operator.** Closed-round retrospectives are inconsistent today; we standardize them.
- **Week 2, days 1–7 — EF ESP / Protocol Labs small-grants program manager.** Higher-friction outreach but high-credibility.

If no partner says yes by end of week 2, we fall back to the **synthetic-demo path**: ship `v0` publicly with a fully-populated demo round that is **clearly labelled as synthetic** in the report header, the launch post, and the README. We do **not** invent fake grantees that imply real impact. The synthetic demo exists to let people kick the tyres, not to manufacture the appearance of adoption.

> **Disclosure rule (binding):** if the synthetic-demo path is the live path at any public-facing surface — launch post, demo URL, README screenshots — that surface MUST say so unambiguously. No fake-grantee implications. Ever.

---

## 6. Week-by-week milestones (single engineer, 6–8 calendar weeks)

- **Week 1 — Foundations.** Repo + license + CI + contribution + security baseline. Remix-vs-Next spike resolved (default Remix). Data model migration v1. CSV/JSON round import end-to-end against synthetic data. **This RFC published.** Optimism RPGF outreach begins.
- **Week 2 — First two adapters.** GitHub Activity (with backoff + idempotency). HTTP Liveness. Operator console: round list, round detail, grantee detail with raw evidence stream. Gitcoin outreach begins.
- **Week 3 — Public report + OSO adapter.** Public per-round report at `/r/{slug}`. Static export. OSO Metrics adapter (read-only). First end-to-end demo round deployed to a public URL. EF ESP / PL outreach begins; partner decision by end of week.
- **Week 4 — Real-partner onboarding (or synthetic-demo fallback).** Manual Milestone Attestation flow with signed links. Self-host packaging (`docker compose`), 10-minute quickstart, one-page operator guide. First real round imported (or synthetic-demo finalized).
- **Weeks 5–6 — Polish, harden, publish.** Address partner feedback. Accessibility pass. One Playwright happy-path E2E. CSP, rate limits, magic-link expiry. Public launch post (separate from this RFC). Three "good first adapter" issues filed to seed contributor flow.
- **Weeks 7–8 — Buffer.** Reserved for unknown-unknowns: partner-driven scope, security finding, packaging issue, contributor-onboarding fixes.

---

## 7. What gets cut if we slip

Strict order. We cut from the bottom of this list before pulling forward later items.

1. Week-7+ buffer features.
2. Static HTML report export (server-rendered page still works).
3. OSO Metrics adapter (GitHub + HTTP Liveness + Manual Milestone is the irreducible triplet).
4. Postgres support (ship SQLite-only; Postgres can be a follow-up PR).
5. Operator console polish (filters, pagination).
6. Synthetic demo round (drop if a real partner is committed).
7. Playwright E2E (Vitest only; document as a known gap).

What we **never** cut: license/contribution baseline, the public report page, the self-host quickstart, security baseline (CSP, rate limits, magic-link expiry), and the Definition of Done partner-approval criterion (or its synthetic-demo fallback).

---

## 8. Out of scope for `v0` (explicit non-goals)

- **No new funding rail.** We do not move money. We report on money already moved.
- **No tokens, no smart contracts, no chain.**
- **No attestation issuance.** We may consume attestations in `v1`; we do not issue them in `v0`.
- **No multi-tenant SaaS.** Self-host only.
- **No proprietary impact score.** We surface evidence; we do not invent a single number that ranks grantees.
- **No grantee-side product surface.** The grantee gets a magic link to attest milestones. That is all.
- **No payments, no invoicing, no fiscal hosting.**
- **No mobile app, no native clients.** Web only.
- **No AI summarization of evidence.** Evidence is shown as it is found.
- **No federated cross-funder discovery.** Each install is its own world in `v0`.
- **No custom analytics warehouse.** OSO is the analytics layer; we consume it, we do not duplicate it.

---

## 9. Risks and mitigations

- **Adoption risk: "reporting tools are unsexy."** Mitigation: anchor on one real funder partner before public launch; the launch post is *their* report, not our demo.
- **Partner-search risk: nobody says yes in 2 weeks.** Mitigation: synthetic-demo fallback path is pre-committed; engineering does not slip.
- **Source-API fragility (GitHub rate limits, OSO schema changes).** Mitigation: every adapter is isolated, retried, and degrades gracefully; missing evidence is rendered as "not yet collected" rather than as a failure.
- **Scope creep from grantees wanting their own surface.** Mitigation: explicit "no grantee product in `v0`"; we point grantees at Karma GAP for now.
- **Single-engineer bus factor.** Mitigation: every architectural decision lands as a short ADR in `docs/decisions/`; CONTRIBUTING.md is a first-class artifact; weekly progress posts ensure context isn't only in one head.
- **Trust risk: funders worry we'll pivot to SaaS and lock them in.** Mitigation: Apache-2.0, single-tenant self-host as the primary distribution mode, no telemetry by default, no proprietary scoring.

---

## 10. Open questions for the community

These are the questions where we genuinely want outside input:

1. **Funder-partner shape.** If you operate a public-goods grant program: what is the single piece of evidence you most wish you could publish about a closed round but currently can't?
2. **Evidence taxonomy beyond the `v0` four.** Which adapter would you want next? Candidates: Snapshot votes, Drips streams, Discourse activity, Substack/blog cadence, Discord/Slack public-channel activity, Hypercerts attestations.
3. **Milestone semantics.** Should milestones be funder-defined, grantee-defined, or co-authored?
4. **Public report defaults.** "Public by default, opt-out per grantee" or "private by default, opt-in publish"? We lean public-by-default (with per-grantee redaction for sensitive cases), but we want pushback before locking it in.
5. **Hosted-instance demand.** Is there an audience that needs a hosted instance from day one, or is "you self-host, we help" the right `v0` stance?
6. **Governance of canonical evidence.** Who decides what evidence is canonical when adapters disagree? Current default: the funder operating the install.

---

## 11. How to engage with this RFC

This RFC is a living document for the duration of `v0`. Feedback is welcome from anyone — funders, grantees, operators, OSS contributors, skeptics.

- **General comments and questions:** [GitHub Discussions — RFCs category](https://github.com/GiveProtocolFoundation/give-evidence/discussions/categories/rfcs).
- **Concrete change proposals:** open a PR against this file with the change.
- **Partner intros and adapter contributions:** see the launch post (link will be added here on publish) for the call-to-action and the [`good first adapter` label](https://github.com/GiveProtocolFoundation/give-evidence/labels/good%20first%20adapter) once it is seeded.
- **Security issues:** see [`SECURITY.md`](../../SECURITY.md). Do not file security reports as RFC comments.

---

## 12. What this RFC is *not* asking for

- Not asking for a token, treasury, or DAO.
- Not asking for a hosted multi-tenant product roadmap.
- Not asking the community to commit to using us.
- Not asking funders to standardize on our schema before there's anything to use.

It *is* asking for: critique on the wedge, candidate partner introductions, and one or two volunteer contributors who'd like to write the next adapter.

---

*This RFC is published under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). Code in this repo is [Apache-2.0](../../LICENSE).*
