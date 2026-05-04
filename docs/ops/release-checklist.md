# VitalCV Release Checklist

Every PR targeting `main` must satisfy every item below before merge. The
release-checklist-gate CI job (`/.github/workflows/release-checklist-gate.yml`)
fails the PR if these checkboxes are not marked complete in the PR body.

This is the canonical merge gate for `BOARD-SCHEMA-3` evidence. Any row
on `docs/ops/vitalcv-completion-board.md` that moves on the back of a PR
must point at a PR that passed every checkbox below.

## Required PR-body checklist

Copy this block into every PR body and check each box that applies. The CI
gate searches for the exact strings and fails on missing checkmarks.

```
## Release checklist
- [ ] vitest green (run: `pnpm --filter @vitalcv/web exec vitest run`)
- [ ] typecheck clean (run: `pnpm typecheck`)
- [ ] lint clean (run: `pnpm --filter @vitalcv/web lint`)
- [ ] build clean (run: `pnpm turbo run build --filter @vitalcv/web`)
- [ ] no banned strings (verified by banned-strings-gate workflow)
- [ ] no untested route added (every new `apps/web/app/**/page.tsx` ships with at least one vitest assertion)
- [ ] truth-contract preserved (no `decisionGrade: true`, no widening of `proofTier` literals, no `Verified` bare label)
- [ ] codex exec SAFE verdict in transcript (run: `codex exec` with implementation/diff/copy audits)
- [ ] mobile + a11y considered (mobile clip / aria-* / 44×44 touch where applicable)
- [ ] copy reviewed for compliance (no claims of HIPAA/SOC2 certification, no automatic verification language)
```

## Item-by-item rationale

### vitest / typecheck / lint / build green
Standard quality gates. Per `BOARD-SCHEMA-3`, no row can move past 75%
without these four green.

### no banned strings
The banned-strings-gate workflow (`/.github/workflows/banned-strings-gate.yml`)
greps every changed file for the canonical banned-strings list from
`CLAUDE.md`. The list includes `automatically verified`,
`guaranteed verification`, `complete credentialing`, `instant
credentialing`, `legally accepted`, `risk transferred`, `final
verification without review`, `source confirmed before response`,
`certified compliant`, `HIPAA compliant`, `SOC2 certified`. No status
label may render as the bare word `Verified`.

### no untested route added
Every new `apps/web/app/**/page.tsx` must ship with at least one vitest
assertion that the route renders without throwing and returns the
expected truth-contract copy. Demo surfaces must include the
`recordedBy: 'demo'` disclaimer rendered in the HTML.

### truth-contract preserved
Per `apps/web/lib/issuer-verification/types.ts`:
- `ReceiptCandidate.decisionGrade` is the literal `false`.
- `ReceiptCandidate.proofTier` is the literal `'receipt_candidate'` when set.
- `PSVReceiptCandidate.decisionGrade` is the literal `false`.
- `PSVReceiptCandidate.proofTier` is the literal `'psv_receipt_candidate'`.
- `globalCredentialTruth` on a receipt is the literal `false`.

A PR that widens any of these to `boolean` or to a non-canonical string
fails the gate.

### codex exec SAFE verdict in transcript
The merge-protection hook on `gh pr merge` requires a real Codex SAFE
verdict. Subagent stand-ins (e.g., `feature-dev:code-reviewer`) do NOT
satisfy the hook. Use `codex exec` with three audits
(implementation / diff / copy) and ensure the verdict is visible in
the PR transcript before invoking `gh pr merge`.

### mobile + a11y considered
For UI changes: confirm mobile clip (no horizontal scroll on iPhone SE
viewport), `aria-*` labels on interactive elements, 44×44 touch
targets on tap surfaces, `prefers-reduced-motion` respected on
animations. For non-UI changes (lib, schema, tests, docs): mark
"considered, no UI surface" inline.

### copy reviewed for compliance
For copy-touching PRs: confirm no claims that imply VitalCV provides
HIPAA certification, SOC2 certification, automatic verification, or
final credentialing without review. The truth-contract documents at
`docs/architecture/vitalcv-knowledge-trust-graph.md` and
`docs/ops/vitalcv-public-claims-matrix.md` are authoritative.

## Sections that may be omitted (with rationale)

- **Pure docs PR**: `vitest`, `typecheck`, `lint`, `build` may be skipped
  with the inline note `docs-only — no code changes`. The banned-strings
  and copy-review gates still apply.
- **Migration-only PR**: `lint` may be skipped; the others must run
  against the schema scaffolding.
- **CI / workflow PR**: a smoke run via `act` (or equivalent) is
  acceptable evidence in lieu of a real CI run for the file under
  edit; main-branch CI must still cover it post-merge.

## Where this gate lives

- This checklist: `docs/ops/release-checklist.md`
- CI gate: `.github/workflows/release-checklist-gate.yml` (greps PR body for the exact checkbox strings)
- Banned-strings gate: `.github/workflows/banned-strings-gate.yml` (separate; runs on every PR)

## How this is enforced today vs aspirationally

Today: the gate parses the PR body for the exact checkbox lines. A
checkbox left unmarked (`[ ]`) on a row that applies fails the gate.

Aspirational (next iteration): each item maps to an automated job
(vitest / typecheck / lint / build / banned-strings) so the gate
reports based on the actual job result rather than a checkbox. The
checklist remains the human-readable contract.
