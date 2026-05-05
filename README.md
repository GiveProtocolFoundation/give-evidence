# give-evidence

> **Status:** `v0` — bootstrapping. No production deployment yet.

Funder-side accountability infrastructure for public-goods giving. A
[Give Protocol Foundation](https://github.com/GiveProtocolFoundation) project.

This repo is the v0 wedge selected in the foundation's planning round
(see the [v0 proposal](#v0-scope) below). Its purpose is to make it
easier for funders — individuals, donor-advised funds, foundations — to
see what their money actually did, in a way that is open, auditable, and
volunteer-friendly to extend.

## v0 scope

The v0 scope is intentionally narrow:

- A small, composable data model for **giving events** (donor → recipient
  → reported outcome) and **evidence attachments** (links, documents,
  on-chain references).
- Ingestion adapters that can pull from a few well-defined public sources
  (open grants data, public donation receipts, on-chain transfer events).
- A read-only viewer that lets a funder see, per recipient, what evidence
  exists and what is missing.
- Apache-2.0, public from day one, contributable by outsiders.

What is **out of scope** for v0:

- Anything resembling a custodial wallet or moving donor funds.
- Closed-source extensions or private dashboards.
- Heavyweight identity/KYC. Recipients are referenced by their public
  identifiers (URLs, on-chain addresses, registered org IDs).

The full `v0` proposal — rationale, success criteria, and sequencing —
is published as a public RFC:

- [**RFC 0001 — v0: Funder-side Accountability Infrastructure**](./docs/rfcs/0001-v0-funder-evidence.md)
- Discussion: [GitHub Discussions → RFCs](https://github.com/GiveProtocolFoundation/give-evidence/discussions/categories/rfcs)

Feedback, partner intros, and adapter PRs are explicitly invited.

## Repository status

This commit bootstraps the repo from the foundation's
[`engineering-baseline`](https://github.com/GiveProtocolFoundation/engineering-baseline)
template. That repo defines the governance precedent every Foundation
project starts from: license, contribution flow, security policy, branch
protection, CI defaults. `give-evidence` adopts those defaults verbatim,
plus a Node + TypeScript + Vitest + Biome stack-specific CI job.

| Concern | Where it lives |
| --- | --- |
| License | [`LICENSE`](./LICENSE) — Apache-2.0 |
| Contribution flow | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Code of Conduct | [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) |
| Security reporting | [`SECURITY.md`](./SECURITY.md) |
| Branch protection rules | [`docs/branch-protection.md`](./docs/branch-protection.md) |
| CI pipeline | [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) |
| Dependency updates | [`.github/dependabot.yml`](./.github/dependabot.yml) |
| Editor defaults | [`.editorconfig`](./.editorconfig) |

## Stack

- **Runtime:** Node.js 20 LTS
- **Package manager:** pnpm 9
- **Language:** TypeScript (strict)
- **Lint + format:** [Biome](https://biomejs.dev/) (single tool, fast, opinionated)
- **Tests:** [Vitest](https://vitest.dev/)

The choice mirrors the defaults flagged in
[`engineering-baseline#choosing-a-stack`](https://github.com/GiveProtocolFoundation/engineering-baseline#choosing-a-stack),
with Biome substituting for the ESLint + Prettier pair to keep the
toolchain small for early contributors.

## Quickstart

```bash
git clone https://github.com/GiveProtocolFoundation/give-evidence.git
cd give-evidence

# Same baseline checks CI runs
./scripts/check.sh

# Hello-world sanity check
./scripts/hello.sh

# Stack-specific
pnpm install
pnpm lint           # Biome lint
pnpm format:check   # Biome format check
pnpm test           # Vitest
```

If `pnpm` is not installed: `corepack enable && corepack prepare pnpm@9 --activate`.

## Submitting a change

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full flow. Short version:

1. Fork the repo.
2. Branch off `main`.
3. Make your change. Run `./scripts/check.sh` and `pnpm test` locally.
4. Open a PR against `main`. Fill in the PR template.
5. Wait for CI + a maintainer review.

Bugs and proposals: open a GitHub Issue. Security reports go through
[`SECURITY.md`](./SECURITY.md), not the public tracker.

## Governance precedent

This project follows the Foundation's
[`engineering-baseline`](https://github.com/GiveProtocolFoundation/engineering-baseline)
for license, governance, and review conventions. That repo is the
authoritative reference; if anything in this README contradicts it, the
baseline wins and the contradiction is a bug — please open an issue.

## License

[Apache License 2.0](./LICENSE). Same rationale as the
[engineering baseline](https://github.com/GiveProtocolFoundation/engineering-baseline#license):
permissive, OSI-approved, explicit patent grant, foundation-standard.

## Maintainers

- [@drigobl](https://github.com/drigobl) — initial maintainer.

Maintainership is earned, not granted; see
[`CONTRIBUTING.md`](./CONTRIBUTING.md#becoming-a-maintainer).
