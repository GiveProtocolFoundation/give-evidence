# Branch Protection & Review Conventions

This document describes the rules enforced on the `main` branch of this repository, and the review conventions every Give Protocol Foundation project should follow.

## Protected branch: `main`

The following rules are configured on `main` via GitHub branch protection. They are enforced by GitHub, not by social convention.

### Required

- **Require a pull request before merging.** Direct pushes to `main` are blocked.
- **Require approvals: 1.** At least one maintainer (other than the author) must approve.
- **Dismiss stale approvals when new commits are pushed.** Re-review is required after substantive changes.
- **Require review from Code Owners** when [`CODEOWNERS`](../.github/CODEOWNERS) is present (the baseline does not ship one yet — add per project).
- **Require status checks to pass before merging:**
  - `Baseline checks` (from `.github/workflows/ci.yml`)
  - `Dependency Review` (from `.github/workflows/dependency-review.yml`)
- **Require branches to be up to date before merging.** Rebase or merge `main` before merge.
- **Require linear history.** Squash-and-merge is the default merge method.
- **Require conversation resolution before merging.** All PR comments must be resolved.
- **Block force pushes.**
- **Block deletion** of `main`.

### Org / repo security baseline (must be on)

These are enabled at the repo or org level and are not part of the per-PR flow:

- **Secret scanning** — enabled, with **push protection** so committed secrets are blocked at push time.
- **Dependabot alerts** — enabled.
- **Dependabot security updates** — enabled.
- **Dependabot version updates** — configured via [`.github/dependabot.yml`](../.github/dependabot.yml).
- **Private vulnerability reporting** — enabled, so reporters can file advisories without going public.
- **Code scanning** — enabled with the default GitHub setup once a language is chosen (Solidity, JavaScript/TypeScript, Python, etc. all supported).

## Review conventions

### Who reviews what

- Any maintainer can review any PR.
- For changes touching the baseline itself (license, CI workflows, governance docs, this document), at least one of the original maintainers should review where practical. This avoids accidental drift in the foundation's standards.
- Authors should not approve their own PR. The only exception is documented in [`CONTRIBUTING.md`](../CONTRIBUTING.md#review-conventions).

### What reviewers look for

In rough priority order:

1. **Correctness.** Does it do what it says, and not break existing tests?
2. **Security.** Any new attack surface? Any inputs not validated? Any secrets handled?
3. **Clarity.** Will this code make sense to someone reading it next quarter without context?
4. **Scope.** Is the PR doing one thing, or did unrelated cleanups sneak in?
5. **Tests.** Is behaviour covered? Is the test the right shape (unit vs. integration)?
6. **Docs.** Are user-visible changes reflected in the README or other docs?

### Review tone

- Reviews are about the change, not the person.
- Suggestions and questions are normal; the goal is shared understanding, not gatekeeping.
- "Approve with comments" is fine when the comments are non-blocking; flag blocking ones explicitly with "request changes".

### Time expectations

- First response on a PR: within a few working days.
- If a PR sits with no response for more than a week, the author should ping. That silence is a process bug.
- We do not promise merge time — that depends on review feedback and CI.

## Configuring branch protection

The settings above are reproducible. To apply them to a new project repo:

```bash
# Requires gh CLI authenticated as a repo admin.
# Replace <owner>/<repo> with your repository.
gh api -X PUT "repos/<owner>/<repo>/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Baseline checks", "Dependency Review"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
```

For secret scanning, push protection, and Dependabot, use:

```bash
gh api -X PATCH "repos/<owner>/<repo>" \
  -f "security_and_analysis[secret_scanning][status]=enabled" \
  -f "security_and_analysis[secret_scanning_push_protection][status]=enabled" \
  -f "security_and_analysis[dependabot_security_updates][status]=enabled"
```

These commands are idempotent — re-running them keeps state aligned.
