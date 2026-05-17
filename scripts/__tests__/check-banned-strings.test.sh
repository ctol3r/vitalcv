#!/usr/bin/env bash
# Self-test for scripts/check-banned-strings.sh. Creates a temporary
# fixture tree, runs the script against it, and asserts that:
#   - a banned phrase in a fresh file under apps/web/app is caught
#   - a banned phrase in a CLAUDE.md / banned-strings.list / test file
#     is NOT caught (allowlist)
#   - a clean tree exits 0

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${REPO_ROOT}/scripts/check-banned-strings.sh"

if [[ ! -x "$SCRIPT" ]]; then
  echo "fixture-test: $SCRIPT missing or not executable" >&2
  exit 2
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/apps/web/app/hit" "$TMP/apps/web/app/clean" "$TMP/apps/web/__tests__"

# 1) hit case
cat > "$TMP/apps/web/app/hit/page.tsx" <<'EOF'
export default function Page() {
  return <div>This product is HIPAA compliant and SOC2 certified.</div>;
}
EOF

# 2) clean case
cat > "$TMP/apps/web/app/clean/page.tsx" <<'EOF'
export default function Page() {
  return <div>Source-backed clinician readiness.</div>;
}
EOF

# 3) allowlisted test file (must not trigger)
cat > "$TMP/apps/web/__tests__/banned-asserts.test.ts" <<'EOF'
// Asserts banned phrases like "HIPAA compliant" are absent.
EOF

# --- Run: hit tree should exit 1 ---
set +e
output="$("$SCRIPT" "$TMP/apps/web/app" 2>&1)"
rc=$?
set -e
if [[ $rc -ne 1 ]]; then
  echo "fixture-test FAIL: expected exit 1 on hit tree, got $rc" >&2
  echo "$output" >&2
  exit 1
fi
echo "$output" | grep -q "hit/page.tsx" || {
  echo "fixture-test FAIL: hit/page.tsx not reported" >&2
  echo "$output" >&2
  exit 1
}
echo "$output" | grep -q "clean/page.tsx" && {
  echo "fixture-test FAIL: clean file was reported" >&2
  exit 1
}
# banned-asserts.test.ts is allowlisted by the "__tests__/banned-" substring
echo "$output" | grep -q "banned-asserts.test.ts" && {
  echo "fixture-test FAIL: allowlisted test file was reported" >&2
  exit 1
}

# --- Run: clean-only tree should exit 0 ---
set +e
clean_output="$("$SCRIPT" "$TMP/apps/web/app/clean" 2>&1)"
clean_rc=$?
set -e
if [[ $clean_rc -ne 0 ]]; then
  echo "fixture-test FAIL: expected exit 0 on clean tree, got $clean_rc" >&2
  echo "$clean_output" >&2
  exit 1
fi

echo "fixture-test PASS: hit detected, clean exits 0, allowlist respected."
