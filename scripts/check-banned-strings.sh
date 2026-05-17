#!/usr/bin/env bash
# check-banned-strings.sh — fail CI when a public surface contains a
# truth-contract banned phrase.
#
# Patterns:    scripts/banned-strings.list (one ERE regex per line,
#              '#' comments).
# Scan modes:
#   1. Args:  any positional arg that is a directory or file is added
#             to the scan set (after a repo-relative resolution).
#   2. PR diff: if BANNED_STRINGS_DIFF_BASE is set (e.g. "origin/main"),
#             or running under GitHub Actions on a pull_request with
#             GITHUB_BASE_REF, the script restricts the scan to the
#             union of files changed since the merge-base, intersected
#             with the default scope below.
#   3. Default scope: apps/web/{app,lib,components},
#             apps/marketing/{app,components}, docs/ops,
#             docs/architecture.
# Allowlist:   files that legitimately contain banned phrases — the
#              policy doc, the list, this script, the workflow, test
#              files that assert absence, archived code under
#              apps/web/app/_archive, and a small set of lib/* files
#              that contain explicit "does NOT X" negation copy.
#              Matched as a substring against the repo-relative path.
#              No broad globs — every entry is a specific path or a
#              well-bounded prefix.
#
# Exit codes:
#   0  no hits
#   1  one or more hits (prints `path:line: matched-phrase` + the line)
#   2  configuration error (missing list, no files in scope)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIST_FILE="${REPO_ROOT}/scripts/banned-strings.list"

if [[ ! -f "$LIST_FILE" ]]; then
  echo "check-banned-strings: list file not found: $LIST_FILE" >&2
  exit 2
fi

# Default scan scope — public surfaces + the truth-contract docs.
DEFAULT_SCOPE=(
  "apps/web/app"
  "apps/web/lib"
  "apps/web/components"
  "apps/marketing/app"
  "apps/marketing/components"
  "docs/ops"
  "docs/architecture"
)

# Resolve a path arg (file or dir, repo-relative or absolute) into an
# absolute path. Echoes nothing and returns 1 if it doesn't exist.
resolve_target() {
  local arg="$1"
  if [[ -e "${REPO_ROOT}/${arg}" ]]; then
    printf '%s' "${REPO_ROOT}/${arg}"
    return 0
  fi
  if [[ -e "$arg" ]]; then
    printf '%s' "$arg"
    return 0
  fi
  return 1
}

SCOPE=()
EXPLICIT_ARGS=0
for arg in "$@"; do
  EXPLICIT_ARGS=1
  resolved="$(resolve_target "$arg" || true)"
  if [[ -z "$resolved" ]]; then
    echo "check-banned-strings: scope arg not found: $arg" >&2
    exit 2
  fi
  SCOPE+=("$resolved")
done

# PR-diff mode — only kicks in if no explicit args were passed.
DIFF_BASE=""
if [[ $EXPLICIT_ARGS -eq 0 ]]; then
  if [[ -n "${BANNED_STRINGS_DIFF_BASE:-}" ]]; then
    DIFF_BASE="$BANNED_STRINGS_DIFF_BASE"
  elif [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    DIFF_BASE="origin/${GITHUB_BASE_REF}"
  fi
fi

if [[ -n "$DIFF_BASE" ]]; then
  # Intersect changed files with the default scope. If git or the base
  # ref is unavailable, fall back to a full default-scope scan rather
  # than silently passing.
  changed_files=()
  if git -C "$REPO_ROOT" rev-parse --verify "$DIFF_BASE" >/dev/null 2>&1; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      for prefix in "${DEFAULT_SCOPE[@]}"; do
        if [[ "$f" == "$prefix"/* ]]; then
          full="${REPO_ROOT}/${f}"
          [[ -e "$full" ]] && changed_files+=("$full")
          break
        fi
      done
    done < <(git -C "$REPO_ROOT" diff --name-only "$DIFF_BASE"...HEAD 2>/dev/null || true)
  else
    echo "check-banned-strings: diff base '$DIFF_BASE' not resolvable; falling back to full scope." >&2
  fi
  if [[ ${#changed_files[@]} -gt 0 ]]; then
    SCOPE=("${changed_files[@]}")
    echo "check-banned-strings: PR-diff mode — scanning ${#SCOPE[@]} changed file(s) against $DIFF_BASE."
  fi
fi

# Fall back to the default scope when no explicit args and either no
# diff base was set, the diff base was unresolvable, or the diff was
# empty.
if [[ ${#SCOPE[@]} -eq 0 ]]; then
  for d in "${DEFAULT_SCOPE[@]}"; do
    if [[ -d "${REPO_ROOT}/${d}" ]]; then
      SCOPE+=("${REPO_ROOT}/${d}")
    fi
  done
fi

if [[ ${#SCOPE[@]} -eq 0 ]]; then
  echo "check-banned-strings: no scan directories present" >&2
  exit 2
fi

# Allowlist — files that legitimately contain banned phrases. Per
# apps/web/CLAUDE.md, allowed-use cases are:
#   - the policy doc itself
#   - this list / this script / the workflow / the gate doc
#   - test files that assert absence
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
  "docs/ops/banned-strings-gate.md"
  # Policy / audit docs whose entire purpose is to enumerate the
  # banned phrases. These quote the contract; they do not violate it.
  "docs/ops/vitalcv-public-claims-matrix.md"
  "docs/ops/vitalcv-completion-board.md"
  "docs/ops/code-red-final-verification-2026-05-07.md"
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

# Pre-process the SCOPE list into something grep -R can consume. grep
# accepts both directories (recurse) and files (scan), so the same
# array works for default-scope and PR-diff modes.
INCLUDES=(
  --include='*.ts' --include='*.tsx'
  --include='*.js' --include='*.jsx'
  --include='*.mjs' --include='*.cjs'
  --include='*.md'  --include='*.mdx'
  --include='*.json' --include='*.html'
)

# If SCOPE contains only specific files (PR-diff mode), --include rules
# are still applied by grep but no recursion is needed; we filter to
# files whose extension matches the scan set manually so we still
# respect the same file-type allowlist.
FILTERED_SCOPE=()
for t in "${SCOPE[@]}"; do
  if [[ -d "$t" ]]; then
    FILTERED_SCOPE+=("$t")
  elif [[ -f "$t" ]]; then
    case "$t" in
      *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.md|*.mdx|*.json|*.html)
        FILTERED_SCOPE+=("$t")
        ;;
      *)
        ;;
    esac
  fi
done

if [[ ${#FILTERED_SCOPE[@]} -eq 0 ]]; then
  echo "check-banned-strings: no scannable files (every changed file is outside the file-type allowlist)."
  exit 0
fi

HITS=0
HITS_LOG=""
for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r raw; do
    [[ -z "$raw" ]] && continue
    file="${raw%%:*}"
    after_file="${raw#*:}"
    line_no="${after_file%%:*}"
    rest="${after_file#*:}"
    rel="${file#${REPO_ROOT}/}"
    if is_allowlisted "$rel"; then
      continue
    fi
    HITS=$((HITS + 1))
    line_out="$(printf '%s:%s: %s — %s' "$rel" "$line_no" "$pattern" "$rest")"
    printf '%s\n' "$line_out"
    HITS_LOG="${HITS_LOG}${line_out}"$'\n'
  done < <(grep -RInIE "${INCLUDES[@]}" -- "$pattern" "${FILTERED_SCOPE[@]}" 2>/dev/null || true)
done

if [[ $HITS -gt 0 ]]; then
  printf '\n' >&2
  echo "check-banned-strings: $HITS hit(s) across ${#PATTERNS[@]} pattern(s)." >&2
  echo "See CLAUDE.md and docs/ops/banned-strings-gate.md for the truth contract." >&2
  exit 1
fi

echo "check-banned-strings: CLEAN — ${#PATTERNS[@]} pattern(s) over ${#FILTERED_SCOPE[@]} path(s)."
exit 0
