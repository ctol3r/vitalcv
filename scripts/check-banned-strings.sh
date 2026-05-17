#!/usr/bin/env bash
# check-banned-strings.sh — fail CI when a public surface contains a
# truth-contract banned phrase.
#
# Patterns:    scripts/banned-strings.list (one regex per line, '#' comments).
# Scan scope:  apps/web/app, apps/web/lib, apps/web/components,
#              apps/marketing/app, apps/marketing/components.
#              Additional paths may be passed as arguments to extend the
#              scan, e.g. `check-banned-strings.sh apps/issuer-api/src`.
# Allowlist:   tests that assert absence, the policy doc itself, the
#              banned-strings list, this script, and the workflow file.
#              The grep is `-iE` case-insensitive extended regex.
#
# Exit codes:
#   0  no hits
#   1  one or more hits (prints `path:line: matched-phrase: line`)
#   2  configuration error (missing list, no files in scope)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIST_FILE="${REPO_ROOT}/scripts/banned-strings.list"

if [[ ! -f "$LIST_FILE" ]]; then
  echo "check-banned-strings: list file not found: $LIST_FILE" >&2
  exit 2
fi

# Default scan scope = the public surfaces. Operators can append more
# directories by passing them as arguments (each must exist).
DEFAULT_SCOPE=(
  "apps/web/app"
  "apps/web/lib"
  "apps/web/components"
  "apps/marketing/app"
  "apps/marketing/components"
)

SCOPE=()
for d in "${DEFAULT_SCOPE[@]}"; do
  if [[ -d "${REPO_ROOT}/${d}" ]]; then
    SCOPE+=("${REPO_ROOT}/${d}")
  fi
done
for arg in "$@"; do
  if [[ -d "${REPO_ROOT}/${arg}" ]]; then
    SCOPE+=("${REPO_ROOT}/${arg}")
  elif [[ -d "$arg" ]]; then
    SCOPE+=("$arg")
  else
    echo "check-banned-strings: scope arg not a directory: $arg" >&2
    exit 2
  fi
done

if [[ ${#SCOPE[@]} -eq 0 ]]; then
  echo "check-banned-strings: no scan directories present" >&2
  exit 2
fi

# Allowlist — files that legitimately contain banned phrases. Per
# apps/web/CLAUDE.md, allowed-use cases are:
#   - the policy doc itself
#   - this list / this script / the workflow
#   - tests asserting the strings are absent
#   - negative/safety copy that explicitly disclaims (e.g. "does NOT
#     complete credentialing")
#   - runtime guards whose regex patterns must contain the phrase to
#     detect it at runtime
#   - archived code under apps/web/app/_archive (not shipped to users)
# Matched as a substring against the repo-relative path.
ALLOWLIST_SUBSTRINGS=(
  "CLAUDE.md"
  "scripts/banned-strings.list"
  "scripts/check-banned-strings.sh"
  ".github/workflows/banned-strings.yml"
  "__tests__/banned-"
  "/banned-verified-label.test"
  "/check-banned-strings.test"
  "/openevidence-demo-spine.test"
  "/leads-route.test"
  "/_archive/"
  "/lib/trust/trust-container-view.ts"
  "/lib/commercial/onboardingFoundation.ts"
  "/lib/commercial/selfServeSignupFoundation.ts"
  "/lib/roi/roiData.ts"
)

is_allowlisted() {
  local rel="$1"
  for sub in "${ALLOWLIST_SUBSTRINGS[@]}"; do
    if [[ "$rel" == *"$sub"* ]]; then
      return 0
    fi
  done
  return 1
}

# Read patterns from the list, stripping blank lines + comments.
PATTERNS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  PATTERNS+=("$line")
done < "$LIST_FILE"

if [[ ${#PATTERNS[@]} -eq 0 ]]; then
  echo "check-banned-strings: list file contains no patterns" >&2
  exit 2
fi

HITS=0
for pattern in "${PATTERNS[@]}"; do
  # -I skip binary, -n line numbers, -E ext regex, -i case-insensitive,
  # -R recurse, --include filters to source-y file types so node_modules
  # / build artifacts are skipped if accidentally in scope.
  while IFS= read -r raw; do
    [[ -z "$raw" ]] && continue
    file="${raw%%:*}"
    rest="${raw#*:}"
    rel="${file#${REPO_ROOT}/}"
    if is_allowlisted "$rel"; then
      continue
    fi
    printf '%s: %s: %s\n' "$rel" "$pattern" "$rest"
    HITS=$((HITS + 1))
  done < <(grep -RInIE \
    --include='*.ts' --include='*.tsx' \
    --include='*.js' --include='*.jsx' \
    --include='*.mjs' --include='*.cjs' \
    --include='*.md' --include='*.mdx' \
    --include='*.json' --include='*.html' \
    -- "$pattern" "${SCOPE[@]}" 2>/dev/null || true)
done

if [[ $HITS -gt 0 ]]; then
  echo "" >&2
  echo "check-banned-strings: $HITS hit(s). See apps/web/CLAUDE.md for the truth contract." >&2
  exit 1
fi

echo "check-banned-strings: CLEAN — scanned ${#PATTERNS[@]} pattern(s) over ${#SCOPE[@]} directory tree(s)."
exit 0
