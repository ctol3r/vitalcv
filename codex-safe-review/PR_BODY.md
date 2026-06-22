# Career Evidence stack — domain-evidence package + evidence/graph/trust/timeline + Career Packet

## What this is

The executable Career Evidence Network layer: a new app-agnostic package (`@vitalcv/domain-evidence`) that projects an already-source-checked passport into **evidence → graph → trust → timeline**, plus the recruiter-facing **Verified Clinician Career Packet**. All additive and read-only — no existing surface changes behaviour.

## Scope (this PR)

| Area | Files |
|---|---|
| Package | `packages/domain-evidence/` (types, collection, graph projector, trust engine, timeline projector) |
| Web adapter | `apps/web/lib/evidence/passport-to-evidence.ts` |
| Read APIs | `/api/evidence/[id]`, `/api/graph/[id]`, `/api/graph/[id]/trust`, `/api/timeline/[id]` |
| Career Packet | `apps/web/app/packet/[entityId]/`, `apps/web/lib/packet/career-packet.ts`, PDF extension |
| Dev tool | `apps/web/app/dev/graph/[entityId]/` (noindex) |
| Tests | `apps/web/__tests__/evidence-*.test.ts`, `career-packet-*.test.ts` + package tests |
| Docs | `docs/wave2*`, `codex-safe-review/` |

## Honesty invariants (test-enforced)

- `decisionGrade ⇔ status === 'checked'` — fail-closed in `buildEvidenceCollection`.
- Monotonic, non-inflating trust: `statusTrustScore` (gated states = 0); dimension scores never exceed contributing evidence; reputation/timeline impacts bounded.
- Gated/stale never presented as decision-grade; honest `null`/`unknown` for absent evidence.
- No bare `Verified`; passes `pnpm check:claims`.
- Pure transforms (no I/O); no new persistence; no PHI.

## Validation

- Package: **28 tests** green · Web stack + regression: **52 tests** green.
- `tsc --noEmit` (package + web): 0 errors · `pnpm check:claims`: pass · ESLint: clean.
- **`pnpm turbo run build --filter @vitalcv/web`: 11/11 tasks, exit 0** (full Next build with TS+ESLint enforced).

## Architecture

Strict acyclic layering `types → collection → graph → trust → timeline`; single external dep `@vitalcv/trust-state`; one adapter seam (`passport-to-evidence`). Full review package in `codex-safe-review/`.

## ⚠️ Merge gate

Per project doctrine, this requires a real **`codex exec` SAFE verdict** (implementation / diff / copy audits) before `gh pr merge`. CI must run `pnpm turbo run build --filter @vitalcv/web` (the package ships from `dist/`, gitignored like `@vitalcv/trust-state`).

## Not included (deliberately)

Pre-existing branch WIP unrelated to this stack (doctrine docs, homepage, navbar, etc.) is **not** part of this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
