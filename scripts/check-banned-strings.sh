#!/usr/bin/env bash
# check-banned-strings.sh — fail CI when a public surface contains a
# truth-contract banned phrase.
#
# Patterns:    scripts/banned-strings.list (one ERE regex per line,
#              '#' comments). The scanner pre-normalises smart quotes
#              (U+2018/U+2019/U+201C/U+201D) to their ASCII
#              counterparts BEFORE running grep, so list patterns only
#              need ASCII glyphs.
#
# Scan modes (highest precedence first):
#   1. Args: positional file/dir args are scanned directly.
#   2. Stdin: when stdin is not a TTY, paths are read one-per-line.
#      Used by .github/workflows/banned-strings.yml to pipe the PR
#      changed-files list into the scanner.
#   3. PR diff: BANNED_STRINGS_DIFF_BASE or GITHUB_BASE_REF expand to
#      `git diff --name-only <base>...HEAD`, intersected with the
#      default scope.
#   4. Default scope: apps/web, apps/marketing, docs/ops,
#      docs/architecture, docs/specs.
#
# Allowlist: a small, explicit per-path substring list (see below).
# Inline skip comments are NOT honoured by design — exception
# authority lives with the founder per
# docs/ops/banned-strings-gate.md.
#
# Exit codes:
#   0  no hits
#   1  one or more hits (prints `path:line: <pattern> — <line>`)
#   2  configuration error

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIST_FILE="${REPO_ROOT}/scripts/banned-strings.list"

if [[ ! -f "$LIST_FILE" ]]; then
  echo "check-banned-strings: list file not found: $LIST_FILE" >&2
  exit 2
fi

# Default scan scope.
DEFAULT_SCOPE_DIRS=(
  "apps/web"
  "apps/marketing"
  "docs/ops"
  "docs/architecture"
  "docs/specs"
)

# Files matching these extensions participate in the scan when a
# directory is walked. Stdin / positional-file inputs are scanned
# regardless of extension so an operator can target any file.
SCAN_EXT_REGEX='\.(ts|tsx|js|jsx|mjs|cjs|md|mdx|json|html)$'

# Resolve a path arg (file or dir, repo-relative or absolute) into an
# absolute path. Prints nothing and returns 1 if it doesn't exist.
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

# Walk a directory and emit every path whose extension matches
# SCAN_EXT_REGEX. Skips node_modules / .next / dist / build / .turbo.
walk_dir_for_files() {
  local dir="$1"
  find "$dir" \
    \( -name 'node_modules' -o -name '.next' -o -name '.turbo' \
       -o -name 'dist' -o -name 'build' -o -name '_archive' \) -prune \
    -o -type f -print 2>/dev/null \
    | grep -E "$SCAN_EXT_REGEX" || true
}

INPUT_FILES=()
INPUT_DIRS=()

# Mode 1: positional args.
for arg in "$@"; do
  resolved="$(resolve_target "$arg" || true)"
  if [[ -z "$resolved" ]]; then
    echo "check-banned-strings: scope arg not found: $arg" >&2
    exit 2
  fi
  if [[ -d "$resolved" ]]; then
    INPUT_DIRS+=("$resolved")
  else
    INPUT_FILES+=("$resolved")
  fi
done

# Mode 2: stdin file list. Only consumed when no positional args and
# stdin is not a terminal.
if [[ ${#INPUT_FILES[@]} -eq 0 && ${#INPUT_DIRS[@]} -eq 0 && ! -t 0 ]]; then
  # `|| [[ -n "$line" ]]` handles a final line without a trailing
  # newline (common when callers pipe `printf '%s' "$f"` or the joined
  # output of an Array.join('\n')).
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" ]] && continue
    resolved="$(resolve_target "$line" || true)"
    [[ -z "$resolved" ]] && continue
    if [[ -d "$resolved" ]]; then
      INPUT_DIRS+=("$resolved")
    elif [[ -f "$resolved" ]]; then
      INPUT_FILES+=("$resolved")
    fi
  done
fi

# Mode 3: PR-diff mode (auto when no input has been provided so far).
DIFF_BASE=""
if [[ ${#INPUT_FILES[@]} -eq 0 && ${#INPUT_DIRS[@]} -eq 0 ]]; then
  if [[ -n "${BANNED_STRINGS_DIFF_BASE:-}" ]]; then
    DIFF_BASE="$BANNED_STRINGS_DIFF_BASE"
  elif [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    DIFF_BASE="origin/${GITHUB_BASE_REF}"
  fi

  if [[ -n "$DIFF_BASE" ]]; then
    if git -C "$REPO_ROOT" rev-parse --verify "$DIFF_BASE" >/dev/null 2>&1; then
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        # Only scan files that fall into the default scope.
        for prefix in "${DEFAULT_SCOPE_DIRS[@]}"; do
          if [[ "$f" == "$prefix"/* ]]; then
            full="${REPO_ROOT}/${f}"
            if [[ -f "$full" ]] && [[ "$full" =~ $SCAN_EXT_REGEX ]]; then
              INPUT_FILES+=("$full")
            fi
            break
          fi
        done
      done < <(git -C "$REPO_ROOT" diff --name-only "$DIFF_BASE"...HEAD 2>/dev/null || true)
      if [[ ${#INPUT_FILES[@]} -gt 0 ]]; then
        echo "check-banned-strings: PR-diff mode — scanning ${#INPUT_FILES[@]} changed file(s) against $DIFF_BASE."
      fi
    else
      echo "check-banned-strings: diff base '$DIFF_BASE' not resolvable; falling back to full default scope." >&2
    fi
  fi
fi

# Mode 4: default-scope fallback if still nothing to scan.
if [[ ${#INPUT_FILES[@]} -eq 0 && ${#INPUT_DIRS[@]} -eq 0 ]]; then
  for d in "${DEFAULT_SCOPE_DIRS[@]}"; do
    if [[ -d "${REPO_ROOT}/${d}" ]]; then
      INPUT_DIRS+=("${REPO_ROOT}/${d}")
    fi
  done
fi

# Expand directories into files.
SCAN_FILES=()
if [[ ${#INPUT_FILES[@]} -gt 0 ]]; then
  SCAN_FILES+=("${INPUT_FILES[@]}")
fi
if [[ ${#INPUT_DIRS[@]} -gt 0 ]]; then
  for d in "${INPUT_DIRS[@]}"; do
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      SCAN_FILES+=("$f")
    done < <(walk_dir_for_files "$d")
  done
fi

if [[ ${#SCAN_FILES[@]} -eq 0 ]]; then
  echo "check-banned-strings: no scannable files in scope."
  exit 0
fi

# Allowlist — files that legitimately contain banned phrases. Per
# CLAUDE.md, allowed-use cases are:
#   - the policy doc itself
#   - this list / this script / the workflow / the gate doc
#   - test files that assert absence
#   - negative/safety copy that explicitly disclaims (e.g. "does NOT
#     complete credentialing")
#   - runtime guards whose regex patterns must contain the phrase to
#     detect it at runtime
#   - archived code under apps/web/app/_archive (not shipped)
# Matched as a substring against the repo-relative path. No broad
# globs — every entry is a specific path or a well-bounded prefix.
ALLOWLIST_SUBSTRINGS=(
  "CLAUDE.md"
  "scripts/banned-strings.list"
  "scripts/check-banned-strings.sh"
  ".github/workflows/banned-strings.yml"
  "docs/ops/banned-strings-gate.md"
  # Policy / audit / planning docs whose entire purpose is to
  # enumerate or critique the banned phrases. They quote the
  # contract; they do not violate it.
  "docs/ops/vitalcv-public-claims-matrix.md"
  "docs/ops/vitalcv-completion-board.md"
  "docs/ops/code-red-final-verification-2026-05-07.md"
  "docs/ops/vitalcv-100pct-action-map.md"
  "docs/specs/vitalcv-public-truth-audit.md"
  "docs/specs/vitalcv-ui-doctrine.md"
  "docs/specs/vitalcv-milestone-status.md"
  "docs/specs/vitalcv-launch-gate.md"
  "docs/architecture/vitalcv-knowledge-trust-graph.md"
  # Test directory — files under apps/web/__tests__/ that encode the
  # truth contract as fixture data (the phrase list itself, the
  # bare-Verified assertion table, etc.) are policy enforcement, not
  # public copy. Per CLAUDE.md, tests asserting absence are an
  # allowed-use case. Test code never reaches the buyer-facing
  # surface, so this exemption does not weaken the gate.
  "/__tests__/"
  # Archived code under apps/web/app/_archive — never shipped.
  "/_archive/"
  # Runtime guards: code that enumerates the banned phrases at
  # runtime so user-supplied / generated copy can be detected and
  # blocked at the rendering boundary. Each file's purpose is to
  # ENFORCE the contract, not violate it.
  "/lib/trust/trust-container-view.ts"
  "/lib/source-health/unavailableLane.ts"
  "/lib/source-health/README.md"
  "/lib/issuer-verification/statusCopy.ts"
  "/lib/publicSafety.ts"
  # Negation-only copy: these files contain explicit "does NOT X"
  # disclaim phrases. Their purpose is to surface honest-state
  # limitations, not to make a positive claim.
  "/lib/commercial/onboardingFoundation.ts"
  "/lib/commercial/selfServeSignupFoundation.ts"
  "/lib/roi/roiData.ts"
  # KNOWN TECH DEBT — apps/marketing/app/demo/dashboard/page.tsx
  # renders `bandLabel.GREEN = 'Verified'` on line 61, which the
  # case-sensitive bare-Verified pattern catches. This gate PR
  # cannot rewrite product runtime code per the operating
  # constraints; track the rename ('Verified' → 'Source-verified')
  # in a separate marketing-copy PR and remove this entry once
  # that PR lands. Per-path narrow allowlist, not a glob.
  "apps/marketing/app/demo/dashboard/page.tsx"
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
# Lines after a `:case-sensitive:` sentinel are scanned with grep -E
# (no -i) so canonical lowercase enum values are not false-positives.
PATTERNS_CI=()
PATTERNS_CS=()
mode="ci"
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  if [[ "$line" == ":case-sensitive:" ]]; then
    mode="cs"
    continue
  fi
  if [[ "$mode" == "cs" ]]; then
    PATTERNS_CS+=("$line")
  else
    PATTERNS_CI+=("$line")
  fi
done < "$LIST_FILE"

TOTAL_PATTERNS=$(( ${#PATTERNS_CI[@]} + ${#PATTERNS_CS[@]} ))
if [[ $TOTAL_PATTERNS -eq 0 ]]; then
  echo "check-banned-strings: list file contains no patterns" >&2
  exit 2
fi

# Normalize smart quotes to ASCII before scanning. Emits the file's
# content with U+2018/U+2019 → ' and U+201C/U+201D → ".
normalize_smart_quotes() {
  local file="$1"
  sed \
    -e $'s/\xe2\x80\x98/\x27/g' \
    -e $'s/\xe2\x80\x99/\x27/g' \
    -e $'s/\xe2\x80\x9c/"/g' \
    -e $'s/\xe2\x80\x9d/"/g' \
    "$file"
}

HITS=0

# Write patterns into temp files so grep can scan all of them in one
# invocation per file (grep -f). That collapses 29 grep calls per
# file into 2 (CI + CS), making a 1500-file full-scope scan finish in
# ~3s instead of ~90s.
PATTERN_TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$PATTERN_TMP_DIR"' EXIT

PATTERNS_CI_FILE="${PATTERN_TMP_DIR}/ci.patterns"
PATTERNS_CS_FILE="${PATTERN_TMP_DIR}/cs.patterns"
printf '%s\n' ${PATTERNS_CI[@]+"${PATTERNS_CI[@]}"} > "$PATTERNS_CI_FILE"
printf '%s\n' ${PATTERNS_CS[@]+"${PATTERNS_CS[@]}"} > "$PATTERNS_CS_FILE"

scan_file() {
  local file="$1"
  local rel="${file#${REPO_ROOT}/}"
  if is_allowlisted "$rel"; then
    return 0
  fi

  # Normalise once, scan twice (CI + CS).
  local normalized
  if ! normalized="$(normalize_smart_quotes "$file" 2>/dev/null)"; then
    return 0
  fi

  # Bulk hit detection (grep -f single pass), then per-hit pattern
  # identification so the output names the specific banned phrase.
  if [[ ${#PATTERNS_CI[@]} -gt 0 ]]; then
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      local line_no="${match%%:*}"
      local rest="${match#*:}"
      local matched="<banned>"
      for p in "${PATTERNS_CI[@]}"; do
        if printf '%s\n' "$rest" | grep -qiE -- "$p" 2>/dev/null; then
          matched="$p"
          break
        fi
      done
      HITS=$((HITS + 1))
      printf '%s:%s: %s — %s\n' "$rel" "$line_no" "$matched" "$rest"
    done < <(printf '%s' "$normalized" | grep -niEf "$PATTERNS_CI_FILE" 2>/dev/null || true)
  fi
  if [[ ${#PATTERNS_CS[@]} -gt 0 ]]; then
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      local line_no="${match%%:*}"
      local rest="${match#*:}"
      local matched="<banned>"
      for p in "${PATTERNS_CS[@]}"; do
        if printf '%s\n' "$rest" | grep -qE -- "$p" 2>/dev/null; then
          matched="$p"
          break
        fi
      done
      HITS=$((HITS + 1))
      printf '%s:%s: %s — %s\n' "$rel" "$line_no" "$matched" "$rest"
    done < <(printf '%s' "$normalized" | grep -nEf "$PATTERNS_CS_FILE" 2>/dev/null || true)
  fi
}

for f in "${SCAN_FILES[@]}"; do
  scan_file "$f"
done

if [[ $HITS -gt 0 ]]; then
  printf '\n' >&2
  echo "check-banned-strings: $HITS hit(s) across $TOTAL_PATTERNS pattern(s)." >&2
  echo "See CLAUDE.md and docs/ops/banned-strings-gate.md for the truth contract." >&2
  exit 1
fi

echo "check-banned-strings: CLEAN — $TOTAL_PATTERNS pattern(s) over ${#SCAN_FILES[@]} file(s)."
exit 0
