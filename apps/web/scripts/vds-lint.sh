#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# VDS Lint — Lightweight design-system drift detector
#
# Scans product UI directories for hardcoded colors that should
# use --vt-* CSS variables instead. Run before commits or in CI.
#
# Usage: bash apps/web/scripts/vds-lint.sh [--strict]
# ─────────────────────────────────────────────────────────────

set -euo pipefail

DIRS=(
  "apps/web/components/intelligence-ops"
  "apps/web/components/intelligence"
  "apps/web/components/vds"
)

# Patterns that indicate hardcoded colors in product surfaces
FORBIDDEN_PATTERNS=(
  "text-white\b"
  "text-slate-"
  "text-zinc-"
  "text-gray-"
  "bg-slate-"
  "bg-zinc-"
  "bg-gray-"
  "border-white/"
  "bg-white/"
  "bg-black/"
  "hover:bg-white/"
  "hover:text-white\b"
)

# Files to exclude (backward-compat re-export, decorative elements)
EXCLUDE_PATTERN="primitives\.tsx$"

FOUND=0
STRICT=${1:-""}

echo "🎨 VDS Lint — Checking for hardcoded colors in product surfaces..."
echo ""

for DIR in "${DIRS[@]}"; do
  [ ! -d "$DIR" ] && continue
  
  for PATTERN in "${FORBIDDEN_PATTERNS[@]}"; do
    MATCHES=$(grep -rn "$PATTERN" "$DIR" --include="*.tsx" --include="*.ts" | \
              grep -v "$EXCLUDE_PATTERN" | \
              grep -v "// vds-lint-ignore" | \
              grep -v "// intentional" || true)
    
    if [ -n "$MATCHES" ]; then
      echo "⚠️  Pattern: $PATTERN"
      echo "$MATCHES" | head -5
      COUNT=$(echo "$MATCHES" | wc -l | tr -d ' ')
      if [ "$COUNT" -gt 5 ]; then
        echo "   ... and $((COUNT - 5)) more"
      fi
      echo ""
      FOUND=$((FOUND + $(echo "$MATCHES" | wc -l | tr -d ' ')))
    fi
  done
done

echo "─────────────────────────────────"
if [ "$FOUND" -eq 0 ]; then
  echo "✅ No hardcoded colors found. VDS compliant."
  exit 0
else
  echo "⚠️  Found $FOUND hardcoded color references."
  echo "   Use --vt-* CSS variables instead."
  echo "   Add '// vds-lint-ignore' to suppress intentional exceptions."
  if [ "$STRICT" = "--strict" ]; then
    exit 1
  fi
  exit 0
fi
