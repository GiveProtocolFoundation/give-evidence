#!/usr/bin/env bash
# hello.sh — the canonical "hello world" for engineering-baseline.
#
# Purpose:
#   1. Prove that a fresh checkout runs end-to-end on any POSIX shell host.
#   2. Exercise the CI pipeline with a deterministic, side-effect-free command.
#   3. Give new contributors a one-command sanity check after cloning.
set -euo pipefail

cat <<'EOF'
================================================================
  Give Protocol Foundation — engineering-baseline
  hello world: your environment is wired up.
================================================================
EOF

echo "git:    $(git --version 2>/dev/null || echo 'not installed')"
echo "shell:  ${BASH_VERSION:-${ZSH_VERSION:-unknown}}"
echo "os:     $(uname -srm)"
echo "date:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "OK"
