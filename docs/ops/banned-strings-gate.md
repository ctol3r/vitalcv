# Banned-strings CI gate

A small, bash-only scanner that fails CI when a public VitalCV surface
contains a truth-contract banned phrase.

The contract itself lives in [`CLAUDE.md`](../../CLAUDE.md) and
[`apps/web/CLAUDE.md`](../../apps/web/CLAUDE.md). This document
describes how the gate enforces it.

## What the gate enforces

The phrase list is in
[`scripts/banned-strings.list`](../../scripts/banned-strings.list).
Every line is a case-insensitive extended regex passed to `grep -iE`.

Categories at the time of writing:

| Category                          | Examples |
|-----------------------------------|----------|
| Compliance / certification claims | `HIPAA compliant`, `SOC2 certified`, `SOC 2 certified`, `NCQA certified`, `certified compliant` |
| Verification overclaim            | `automatically verified`, `guaranteed verification`, `final verification without review`, `source confirmed before response` |
| Credentialing overclaim           | `complete credentialing` (word-bounded), `instant credentialing` |
| Risk / acceptance overclaim       | `legally accepted`, `risk transferred` |
| Bare-Verified label markers       | `>Verified<` rendered text, `label:` / `status:` set to `Verified` in any quote style (including smart quotes) |

The smart-quote handling means a copy pass that swaps `'` → `’` or
`"` → `”` cannot hide a violation; both glyph families are matched.

## What the gate does NOT flag

Compound labels and benign keyword reuse are intentionally allowed:

- `Source-verified`, `Source-backed`, `Source-confirmed`
- `NPPES-confirmed`, `issuer-confirmed`
- `verification request`, `request a verification`
- The lower-case noun `verification` standing alone

The patterns are anchored to the literal phrase or to the
`(label|status)\s*[:=]\s*"Verified"` shape — they do not match a
sub-phrase or a hyphenated compound.

## Scan scope

When invoked with no arguments and no diff base, the scanner walks:

- `apps/web/{app,lib,components}`
- `apps/marketing/{app,components}`
- `docs/ops`
- `docs/architecture`

You can extend or narrow the scan by passing path arguments
(repo-relative or absolute, files or directories):

```bash
bash scripts/check-banned-strings.sh apps/issuer-api/src
bash scripts/check-banned-strings.sh apps/web/app/launch/page.tsx
```

## PR-diff mode

In a GitHub Actions `pull_request` job, the gate restricts the scan
to the union of files changed since `origin/$GITHUB_BASE_REF`,
intersected with the default scope. The intent is two-fold:

1. PRs that don't touch public surfaces don't pay scan cost.
2. A merge that *does* touch a public surface is held to the full
   contract on the touched files.

You can simulate this locally:

```bash
BANNED_STRINGS_DIFF_BASE=origin/main bash scripts/check-banned-strings.sh
```

If the diff base is unresolvable, the scanner falls back to a
full default-scope scan and prints a warning to stderr.

## Allowlist

A small substring allowlist exempts files that legitimately
contain the banned phrases:

- The policy documents (`CLAUDE.md`, this gate doc, the public-claims
  matrix, the completion board, the code-red audit log).
- The phrase list, the scanner, and the workflow.
- Test fixtures that explicitly assert the absence of these phrases.
- The runtime-guard regex source
  (`apps/web/lib/trust/trust-container-view.ts`) and three lib files
  that contain explicit "does NOT X" negation copy.
- Archived code under `apps/web/app/_archive/` (never rendered to
  end users).

The allowlist is intentionally short and per-path; no broad globs.
Adding to it requires the file path to appear in
`ALLOWLIST_SUBSTRINGS` inside the script.

## Local usage

```bash
# Full default-scope scan.
bash scripts/check-banned-strings.sh

# Restrict to a single file or directory.
bash scripts/check-banned-strings.sh apps/web/app/launch/page.tsx

# Simulate the PR-diff mode used in CI.
BANNED_STRINGS_DIFF_BASE=origin/main bash scripts/check-banned-strings.sh

# Vitest behavioural test (covers fixture cases + a full-repo CLEAN
# assertion).
pnpm --filter @vitalcv/web exec vitest run __tests__/banned-strings-gate.test.ts
```

Exit codes:

| Code | Meaning |
|------|---------|
| 0    | No hits in scope. |
| 1    | One or more hits. The scanner prints each hit as `path:line: <pattern> — <line content>` to stdout, plus a summary on stderr. |
| 2    | Configuration error (list file missing, scope path doesn't exist, etc.). |

## Adding a new banned phrase

1. Append the case-insensitive ERE to `scripts/banned-strings.list`.
2. Run `bash scripts/check-banned-strings.sh` and address any new hits
   on `origin/main` (either by rewording the copy or, only when the
   text is genuinely policy/test/negation copy, by adding a specific
   allowlist entry in the script).
3. If your phrase has predictable false-positive cases, add an
   `expect(status).toBe(0)` case to
   `apps/web/__tests__/banned-strings-gate.test.ts` so future
   regressions are caught.

## Known limitations

- **No HTML rendering**: a phrase split by JSX expressions
  (`<span>Verified</span>` is caught, but
  `<span>{label}</span>` with `label = 'Verified'` is not) needs the
  rendered-HTML scan that lives in the existing
  `banned-verified-label.test.ts`. The two checks are complementary.
- **No semantic analysis**: the scanner is a regex grep. It cannot
  distinguish e.g. a sentence that disclaims a phrase from one that
  asserts it. The allowlist is the explicit escape hatch.
- **Smart-quote matching covers the four common glyphs**
  (`U+2018`/`U+2019`/`U+201C`/`U+201D`) only. Exotic Unicode quote
  variants are not covered; if a new case appears, add the glyph to
  the bare-Verified pattern in `scripts/banned-strings.list`.
