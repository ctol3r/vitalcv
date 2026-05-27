# UI Implementation Roadmap

Order of operations for the visual-system upgrade. Each row is one PR. Each PR carries its own local audit and validation block. No backend / Clerk / Railway / DNS / env / secret changes anywhere in this roadmap.

## Status snapshot (2026-05-27)

| Wave | Branch | PR | State |
|---|---|---|---|
| G — TruthStateChip + Legend | `feat/truth-state-chip` | **#425** | ✅ Implemented + tests 19/19 + validation green. Awaiting local audit + merge. |
| Design docs (this batch) | `docs/design-system-foundation` | new PR (this batch) | drafted, ready for commit |
| H — Passport degraded-state | `feat/passport-degraded-state` | not opened | next coding wave |
| I — Homepage NPI-first + role doors | `feat/homepage-npi-first` | not opened | after H |
| J — Sign-in/sign-up disclosure | `feat/auth-disclosure-card` | not opened | after H |
| K — `/status` + `/trust/attribution` | `feat/status-trust-attribution` | not opened | after G+H |
| Sweep — legacy badge migration + `_archive/` deletion | TBD | not opened | last; can be deferred |

## Phase 1 (recommended this batch)

**Goal:** establish the chip foundation + design docs so subsequent waves have a shared anchor.

1. **Wave G** — `TruthStateChip` + `TruthStateLegend` + 19 tests + usage doc. Already implemented in PR #425.
2. **Design docs PR** — this batch: `vitalcv-visual-system.md`, `component-library-spec.md`, `screen-composition-spec.md`, `state-model-as-design.md`, `ui-implementation-roadmap.md` + the audit inventory.

**Exit criteria for Phase 1:** PR #425 merged; design-docs PR merged.

## Phase 2 (next batch — Passport-first integration)

**Goal:** the hottest unauthenticated surface adopts the chip family; SSE smoke can now be visually verified.

1. **Wave H** — Passport degraded-state upgrade. `/passport`, `/passport/[id]`. 5-row legend at top; source rows use `TruthStateChip`; degraded header with "system condition, not a finding" copy; institution-review panel with the boundary copy. Remove skeleton loaders in terminal degraded state. Focused tests assert no banned phrases in rendered HTML, plus chip usage on each source row.
2. **Operator SSE smoke** (parallel) — once authenticated, run the SSE smoke from `docs/ops/authenticated-sse-smoke-runbook.md` against the new Passport surface. This closes the "deployed → validated live" gap for Product Truth Contract.

**Exit criteria for Phase 2:** Wave H merged + deployed; SSE smoke PASS or PATCH-LIVE-BUT-SOURCE-NO-PAYLOAD classified honestly.

## Phase 3 (homepage + auth)

**Goal:** make the front door match the visual language.

1. **Wave I** — Homepage NPI-first hero, 4 role doors, proof strip, footer trust row.
2. **Wave J** — Sign-in / sign-up calm disclosure card; minor uses of `auth-required` chip in error chrome.

These two can ship in parallel because they touch different routes; they share zero files.

**Exit criteria for Phase 3:** Waves I + J merged + deployed.

## Phase 4 (status + trust attribution receipts)

**Goal:** the public-facing infrastructure documents read like receipts.

1. **Wave K** — `/status` Connector Matrix + `/trust/attribution` Trust Attribution register. Uses the full 8-row legend. Honest compliance disclaimer at top of each.

**Exit criteria for Phase 4:** Wave K merged + deployed.

## Phase 5 (sweep)

**Goal:** retire long-tail duplication.

1. **Migrate legacy badge callers** — every import of `components/ui/StatusBadge.tsx`, `components/ui/BadgeStatus.tsx`, `components/ui/trust-status-badge.tsx`, `components/ui/claim-badge.tsx` becomes a `TruthStateChip` or a domain-specific badge (decision, exclusion, etc.). One PR per directory; small and verifiable.
2. **Delete `apps/web/app/_archive/**`** — confirmed dead routes; removing them eliminates the banned-phrase grep noise.
3. **Optional**: consolidate the two `Badge` primitives by pointing `components/ui/badge.tsx` at the design-system `Badge`. Low priority; the two coexist without harm.

## Constraints binding the entire roadmap

(Lifted verbatim from each wave's spec; recorded here for the file-grep guard.)

- No backend changes anywhere in this roadmap.
- No auth logic changes; Clerk config untouched.
- No Railway / DNS / env / secrets changes.
- No Prisma migrations.
- No bare "Verified" label anywhere user-facing.
- No "cleared" / "approved" / "accepted everywhere" / "complete credentialing" / "instant credentialing" / "HIPAA compliant" / "SOC2 certified" / "NCQA certified" / "Get verified" anywhere.
- No false source promotion. OIG/LEIE / PECOS / STATE_BOARD / FSMB / NURSYS stay `connector-not-live` until their adapters are wired.
- NPPES no-payload stays `temporarily-unavailable`; never auto-promoted.
- No skeleton loaders on terminal degraded states.

The test suite in `apps/web/__tests__/truth-state-chip.test.tsx` (and the per-route tests added in H–K) enforces these constraints in CI. Adding a new label or meaning without updating the regex array fails the build.

## Audit gate for every PR in this roadmap

Per session policy: **Codex is operator-discretion; local Claude Code audit is the in-loop gate.** Each PR in this roadmap carries its own validation block and is subject to local audit before merge. The validation pattern from PR #425 (vitest run, tsc --noEmit, turbo build, lint, banned-phrase grep over the rendered HTML) is reusable verbatim.
