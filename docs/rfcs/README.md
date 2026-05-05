# RFCs

Public design proposals for `give-evidence`. RFCs are how the project
discusses substantive technical and product direction in the open before
shipping it.

| RFC | Title | Status |
| --- | --- | --- |
| [0001](./0001-v0-funder-evidence.md) | v0 — Funder-side Accountability Infrastructure | Proposed |

## How RFCs work here

- Each RFC is a Markdown file in this directory, numbered sequentially,
  with a stable filename it keeps for life.
- Each RFC has a canonical discussion thread under [GitHub Discussions](https://github.com/GiveProtocolFoundation/give-evidence/discussions); the RFC file itself links to its thread.
- Concrete proposed changes to an in-flight RFC are PRs against the
  file.
- Status values: `Proposed`, `Accepted`, `Implemented`, `Rejected`,
  `Superseded`. Once `Implemented` we link the RFC from the relevant
  ADR(s) under [`docs/decisions/`](../decisions/).
- We will not retroactively rewrite published RFCs to look smarter than
  they were. Updates land as new revisions of the same file with a
  visible changelog at the top, or as a new RFC that supersedes the
  old one.

If you want to write an RFC, open an issue first to check that it is
in-scope for the project; then send a PR adding a new file to this
directory. Borrow the structure of [RFC 0001](./0001-v0-funder-evidence.md)
as a starting template.
