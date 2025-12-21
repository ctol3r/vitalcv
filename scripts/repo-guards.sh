#!/usr/bin/env bash
set -e

echo "Running VitalCV repo guards..."

# Fail if npm lockfiles exist
if rg --files -g 'package-lock.json' | rg . >/dev/null; then
  echo "❌ package-lock.json found. pnpm-only policy violated."
  exit 1
fi

# Fail if deprecated frontend is referenced in ACTIVE code
if rg -n 'apps/api/frontend' \
    --glob '!archive/**' \
    --glob '!docs/**' \
    --glob '!scripts/repo-guards.sh' \
    --glob '!**/*.md' \
    >/dev/null; then
  echo "❌ Deprecated frontend referenced in active code."
  exit 1
fi

echo "✅ Repo guards passed."
