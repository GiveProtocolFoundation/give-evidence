#!/usr/bin/env bash
# check.sh — baseline repo-hygiene checks. Mirrored by CI.
#
# This script is intentionally stack-agnostic. As projects pick a language,
# add the matching lint/format/test invocations to this script AND to
# .github/workflows/ci.yml so local and CI stay in lock-step.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
warn() { printf '  [fail] %s\n' "$1" >&2; fail=1; }
ok()   { printf '  [ ok ] %s\n' "$1"; }

echo "==> Required governance files"
for f in README.md LICENSE CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md; do
  if [[ -s "$f" ]]; then ok "$f"; else warn "$f missing or empty"; fi
done

echo "==> Required CI scaffolding"
for f in .github/workflows/ci.yml .github/dependabot.yml .github/pull_request_template.md; do
  if [[ -s "$f" ]]; then ok "$f"; else warn "$f missing or empty"; fi
done

echo "==> Editor config"
if [[ -s .editorconfig ]]; then ok ".editorconfig"; else warn ".editorconfig missing"; fi

echo "==> Scripts are executable"
for f in scripts/hello.sh scripts/check.sh; do
  if [[ -x "$f" ]]; then ok "$f"; else warn "$f not executable (chmod +x $f)"; fi
done

echo "==> No obvious committed secrets"
# Cheap, fast scan. Real secret scanning runs in CI via GitHub's built-in
# secret scanning + push protection (enabled at the org/repo level).
suspicious_pattern='(BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]+)'
if git ls-files -z 2>/dev/null | xargs -0 grep -lE "$suspicious_pattern" 2>/dev/null; then
  warn "files above appear to contain secrets — review before committing"
else
  ok "no obvious secret patterns in tracked files"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "All baseline checks passed."
  exit 0
else
  echo "Baseline checks failed. See [fail] lines above." >&2
  exit 1
fi
