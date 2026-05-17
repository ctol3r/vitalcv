# Banned-strings CI gate

A narrow, bash-only scanner that fails CI when a public VitalCV
surface contains a truth-contract banned phrase. The contract itself
lives in [`CLAUDE.md`](../../CLAUDE.md) and
[`apps/web/CLAUDE.md`](../../apps/web/CLAUDE.md); this document
describes how the gate enforces it.

## What the gate checks

Every line in [`scripts/banned-strings.list`](../../scripts/banned-strings.list)
is a case-insensitive extended regex passed to `grep -E`. Patterns
appearing after the `:case-sensitive:` sentinel are evaluated with
`grep -E` (no `-i`) so canonical lowercase enum values such as
`'verified'` are not false positives.

### Compliance and certification overclaim

- `HIPAA compliant`
- `SOC2 certified`, `SOC 2 certified`
- `NCQA certified`
- `certified compliant`
- `guaranteed compliant`

### Verification overclaim

- `automatically verified`
- `instantly verified`
- `fully verified` (word-bounded)
- `real-time verification`
- `real-time check`
- `guaranteed verification`
- `final verification without review`
- `source confirmed before response`

### Credentialing overclaim

- `complete credentialing` (word-bounded)
- `instant credentialing`
- `eliminates credentialing`
- `replaces credentialing`

### Risk and acceptance overclaim

- `legally accepted`
- `risk transferred`
- `accepted everywhere`
- `single source accepted by all hospitals`

### Outcome overclaim (vague benefits)

- `always up to date` (word-bounded)
- `solves burnout`
- `solves diversity attrition`

### Bare-`Verified` markers (case-sensitive)

- `'Verified'`, `"Verified"`, `` `Verified` `` — any standalone quoted
  literal
- `>Verified<` — bare JSX text node
- `label: 'Verified'`, `status: "Verified"` — attribute assignments
- `Verified provider`, `Verified source` — public-copy compounds that
  survive the bare-quote ban

Smart quotes (`‘ ’ “ ”`) are normalised to ASCII before any pattern is
applied, so a copy pass that swaps `'` → `’` cannot hide a violation
behind curly quotes.

## What the gate does NOT flag

The bans target buyer-facing public copy, not internal enum values or
spec language. The following pass:

- the lowercase canonical state `'verified'` (used in the trust-state
  machine as an enum value);
- the all-caps canonical state `'VERIFIED'` (used as the
  decision-grade marker);
- compound labels: `Source-verified`, `Source-confirmed`,
  `Source-checked`, `NPPES-verified`, `issuer-confirmed`,
  `HIPAA-aware`;
- benign noun usage: `verification`, `verification request`,
  `request a verification`, `verified by NPPES`.

## Why it exists

The truth contract is the single thing VitalCV cannot compromise.
Marketing pressure, copy refreshes, and well-intentioned UI rewrites
all introduce drift; a regex gate catches the drift before it lands
on `main` and reaches buyers. The gate is intentionally narrow — it
does not lint grammar, copy quality, or style. It only catches the
phrases that change VitalCV from a source-backed verifier into a
compliance-overclaim vendor.

## How to run locally

```bash
# Full default-scope scan against the working tree (apps/web,
# apps/marketing, docs/ops, docs/architecture, docs/specs).
bash scripts/check-banned-strings.sh

# Scan a single file.
bash scripts/check-banned-strings.sh apps/web/app/launch/page.tsx

# Scan a list piped on stdin (this is how CI runs it).
git diff --name-only origin/main...HEAD | bash scripts/check-banned-strings.sh

# Simulate CI's PR-diff mode end-to-end.
BANNED_STRINGS_DIFF_BASE=origin/main bash scripts/check-banned-strings.sh

# Run the vitest behavioural spec.
pnpm --filter @vitalcv/web exec vitest run __tests__/banned-strings-script.test.ts
```

Exit codes:

| Code | Meaning |
|------|---------|
| `0`  | No hits in scope. |
| `1`  | One or more hits. Each hit is printed as `path:line: <pattern> — <line>` to stdout, with a summary on stderr. |
| `2`  | Configuration error (the list file is missing or empty, or a positional scope arg doesn't exist). |

## How to add a banned phrase

1. Append the case-insensitive ERE regex to
   [`scripts/banned-strings.list`](../../scripts/banned-strings.list).
   If the phrase should be matched case-sensitively (e.g. a bare-
   `Verified` marker), put it below the `:case-sensitive:` sentinel.
2. Run `bash scripts/check-banned-strings.sh` and address any new
   hits on `origin/main`. Real public-copy regressions get the
   minimum fix (typically a label rename per the truth contract);
   negative-only copy or runtime guards get an explicit per-path
   allowlist entry in
   [`scripts/check-banned-strings.sh`](../../scripts/check-banned-strings.sh).
3. Extend the `CANONICAL_PHRASES` or `RISKY_PHRASES` array in
   [`apps/web/__tests__/banned-strings-script.test.ts`](../../apps/web/__tests__/banned-strings-script.test.ts)
   so the fixture round-trip catches future regressions.

## How to handle failures

When CI fails this gate:

1. Read the `path:line: <pattern> — <line>` output. The matched
   phrase is the literal regex from `scripts/banned-strings.list`.
2. Fix the copy. The standard rewrites:
   - `'Verified'` (label) → `'Source-verified'` or `'Source-backed'`
   - `'HIPAA compliant'` / `'SOC2 certified'` →
     `'HIPAA-aware'` / `'SOC2 scope claimed by vendor — under audit'`
     or just remove the claim
   - `'complete credentialing'` → `'foundation-tier readiness preview'`
   - `'guaranteed verification'` → `'source-checked when probe succeeds'`
3. Re-run `bash scripts/check-banned-strings.sh` locally to confirm
   the hit is gone.
4. Push the fix.

If the hit is in a file that legitimately encodes the contract (a
policy doc, a test asserting absence, a runtime guard whose regex
must contain the phrase), add the **specific path** to
`ALLOWLIST_SUBSTRINGS` in `scripts/check-banned-strings.sh`. Do not
add a broad glob — the allowlist is per-path by design.

## Founder-only exception authority

There is no inline skip mechanism. The scanner does not honour
`// banned-strings-disable`, `// eslint-disable-line`, or any other
inline pragma. If a phrase must ship that the gate currently blocks,
the founder is the sole authority who may either:

- Approve a permanent removal of the phrase from the list (commit a
  diff to `scripts/banned-strings.list`), or
- Approve a per-path allowlist entry naming the exact file path,
  with a comment explaining why (commit a diff to
  `ALLOWLIST_SUBSTRINGS` in `scripts/check-banned-strings.sh`).

Allowlist entries SHOULD point to one of the four allowed-use cases
named in `CLAUDE.md`: policy docs, tests asserting absence, runtime
guards, or archived code. Any other rationale needs founder sign-off
in the PR description.

## Known limitations

- **No JSX-expression rendering.** A phrase split by JSX expressions
  (`<span>{statusLabel}</span>` with `statusLabel = 'Verified'`) is
  not caught by this gate. Rendered-HTML coverage is provided by
  `apps/web/__tests__/banned-verified-label.test.ts`; the two checks
  are complementary.
- **No semantic disclaim parsing.** The scanner is a regex grep. It
  cannot tell `"is HIPAA compliant"` apart from
  `"is NOT HIPAA compliant"`. The allowlist is the explicit escape
  hatch for negation-only copy.
- **Smart-quote normalisation covers the four common glyphs**
  (`U+2018`, `U+2019`, `U+201C`, `U+201D`) only. Exotic Unicode quote
  variants need an explicit `sed` translation step before scanning.
- **Workflow scope** is hard-coded to `apps/web`, `apps/marketing`,
  `docs/ops`, `docs/architecture`, `docs/specs`. New public surfaces
  must be added to `.github/workflows/banned-strings.yml` and to
  `DEFAULT_SCOPE_DIRS` in the script.
