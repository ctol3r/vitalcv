# Launch Blockers · 2026-05-07

What stops VitalCV from being shippable to a paying pilot today, classified by what blocks it.

**Inputs:** `docs/ops/code-red-final-verification-2026-05-07.md`, `docs/ops/current-state-map-2026-05-07.md`, `docs/ops/open-pr-triage-2026-05-07.md`, `MASTER_PROMPT.md` §4–6, audit findings (recursive audit @ 2026-05-06).

**Definition of "launch":** a paying pilot org runs a real clinician through the canonical path (Recognition → Acceptance → Start) end-to-end against live source-adapter data, and the resulting passport renders truthfully on a public proof surface.

**Definition of "blocker":** if removed, the launch demo fails OR the truth contract is violated OR a buyer asks a question we cannot answer with the codebase as-is.

---

## P0 — must close before pilot kickoff

### P0.1 — Marketing-app dead-end (`apps/marketing` → `/clinician`)

**Source:** `MASTER_PROMPT.md` §5: "The marketing app's NPI entry routes to a dead `/clinician` page. The web app has a fully functional NPI → readiness pipeline. This seam is **a P0 launch blocker**."

**Status as of 2026-05-07:** unverified. The `/contact` + `/for/cvo` + `/for/payer` + `/for/staffing-exchange` surfaces (Code Red Wave H, PRs #259–#262) closed the buyer funnel **on `apps/web`**. They do **not** patch `apps/marketing`'s dead `/clinician` link.

**Fix path:** verify `apps/marketing` CTA destinations; reroute the dead `/clinician` link to either `apps/web/contact?persona=...` or `apps/web/`. One marketing PR, no architecture change.

### P0.2 — Engine-level CRS cap not yet on main

**Source:** Audit P0 finding #1: NPPES identity-only verification can produce a 95-point GREEN/L3 readiness score with state-board licensure gated/unintegrated.

**Status:** PR #266 (engine cap) and PR #267 (rim propagation: backend + web + demo fixtures) are **open, not merged**. While PR #266 has zero production callers (`@vitalcv/crs` isn't imported by `apps/web` today), PR #267's backend cap in `passportService.ts` IS on the live data path that feeds the homepage hero, `/passport`, and the employer worklist.

**Fix path:** Codex SAFE → merge #266 → Codex SAFE → merge #267. Both surgical, both under 300 LOC.

### P0.3 — OIG confidence semantics conflate no-match with verified-clear

**Source:** Audit P0 finding #2: `oig.ts` returned `confidence: 'exact'` for both 0-records and N-records cases. False-positives in LEIE name matching pass through as "exclusion clear."

**Status:** PR #272 (W1.2) **open, not merged**. UI already supports `'POSSIBLE_MATCH'` (passport-contract.ts:159) — the bridge from adapter confidence to `standing.exclusionStatus` is the next-wave wiring after #272 lands.

**Fix path:** Codex SAFE → merge #272. One file change to backend identity bridge follows separately.

### P0.4 — Demo passport fixture not on main

**Source:** Browser-QA "20 of 28 boundaries not testable on the live demo" finding. The marketing pages advertise NPI `1346053246` (Macie Miller, PA-C) as the walking scenario; without the seed, `/passport/1346053246` returns the "Passport not available" placeholder.

**Status:** PR #250 **open, not merged**. Without it, every investor / pilot-prospect demo of the trust graph is unreachable on the live site.

**Fix path:** Codex SAFE → merge #250. 5 tests pass; fixture honors `recordedBy: 'demo'` + `globalCredentialTruth: false` literal + synthetic-data banner.

### P0.5 — Six new design surfaces are fixture-backed (not production-real)

**Source:** Code Red verification doc; current state map.

**Status:** `/file`, `/roi`, `/inbox`, `/activation/[caseId]`, `/autopilot`, `/dossier/[receiptId]` all rendered HTTP 200 on production smoke (2026-05-07) but every one renders inline fixtures, not DB-backed records. A buyer asking "what does my clinician's dossier look like?" would see a synthetic shape, not their data.

**Fix path:** Phase 2 wiring per surface (per code-red doc):
- `/dossier`: real EdDSA signing + RFC3161 timestamp + signed-PDF export
- `/activation`: DB reads keyed by `caseId`
- `/autopilot`: real action endpoints
- `/inbox`: accept-into-profile flow
- `/roi`: live billing/value data
- `/file`: interactive upload

Six separate PRs; each surface independently testable. Estimate: 1 wave per surface.

---

## P1 — must close before broadening past pilot org

### P1.1 — RBAC verifier-org enforcement not on main

**Source:** PR #243 — `feat/verifier-rbac`. `mergeable=CONFLICTING, state=DIRTY`.

**Status:** verifier RBAC enforcement (`rbacEnforced = true as const`, `/api/verifier/*` middleware gate, timing-safe org compare, 18 tests) is on the open PR list with conflicts after Code Red merges. Until this lands, `/api/verifier/*` does not enforce per-org access.

**Fix path:** rebase #243 onto current main; reapply middleware + helper + tests.

### P1.2 — Issuer policy-decision persistence missing model

**Source:** Code Red verification doc, "Wave B Phase 3d" deferred. PR #247 — `feat/policy-decision-persistence` — has the model addition but conflicts with #221's schema.

**Status:** issuer review surfaces are flag-gated demo by design (CLAUDE.md truth contract). Without `PolicyReviewDecision` persisted, the audit trail for accepted PSV receipt candidates lives only in the user's session.

**Fix path:** rebase #247; remove redundant schema boilerplate; keep only the new model.

### P1.3 — Web app's readiness rim layer reads `passport.standing.licensureStatus` from backend, not from `/api/trust-state/:npi`

**Source:** Audit W1.1b follow-up: `/api/trust-state/:npi` is consumed by `ClinicianReadinessCheck` and the hero `ReadinessPreview`. The licensure cap is in `passportService.ts` (per PR #267) but the trust-state route may not include `standing.licensureStatus` in its payload.

**Status:** unverified. Needs trace.

**Fix path:** confirm trust-state route shape includes licensureStatus. If not, extend the route → automatic cap on hero + employer surfaces.

### P1.4 — Marketing demo profiles claim integrations that don't exist

**Source:** Audit P1: `apps/web/components/marketing/ReadinessDemo.tsx` claims DEA, ABMS, state-license verified for hardcoded profiles. None are integrated.

**Status:** open. The profiles claim `verified` (so the licensure cap doesn't fire — they're not violating W1.1). The deeper drift is the catalog: `apps/web/lib/catalog/credentialCatalog.ts:26, 29` lists DEA + NPDB.

**Fix path:** W1.3 catalog cleanup — remove DEA/NPDB or mark `source: 'unintegrated'`.

### P1.5 — Source-coverage normalization silent drops

**Source:** Audit P1: `apps/web/lib/trust/source-coverage.ts:42–49` returns `[]` for any check missing `sourceId`, `state`, or `reason`. No log, no UI signal — a missing optional field causes a check to disappear silently.

**Status:** open. W1.4 in the audit roadmap.

**Fix path:** log + degrade to `state: 'malformed'`. ~15 LOC.

### P1.6 — Bug: pre-existing `BLOCKING_REASON_ORDER` omits `ACTIVE_DIVERGENCE`

**Source:** Surfaced during W1.1 verification. `packages/crs/CrsEngine.ts:42-47` filters out `ACTIVE_DIVERGENCE` from `blocking_reasons` output. The CRS package has no `test` script so the pre-existing test was never run.

**Fix path:** one-line fix to `BLOCKING_REASON_ORDER`. Independent of #266 / #267.

### P1.7 — Bug: pre-existing `sha256Sync` uses Web Crypto API path that doesn't exist in Node

**Source:** Surfaced during W1.2 verification. `packages/source-adapters/src/utils/hash.ts` reads `globalThis.crypto.createHash` — only Node's `node:crypto` module exposes that API. Production usage may silently throw.

**Fix path:** one-line change to `import { createHash } from 'node:crypto'`. Independent of #272.

### P1.8 — `/signup` and `/sign-up/[[...sign-up]]` divergence

**Source:** Current state map. Two sign-up routes exist; only one should be canonical.

**Fix path:** trace both, pick one, redirect the other. PR #238 (`wave-5a/signup-gate`) is in this neighborhood — verify scope alignment.

---

## P2 — should close before non-pilot scale

### P2.1 — Backend Prisma schema vs `apps/web` schema drift

**Source:** PRs #241 / #247 / #248 each added schema fragments to `apps/web/prisma/schema.prisma` that the backend `apps/api/backend/prisma/schema.prisma` does not have.

**Fix path:** consolidate. Either (a) backend schema becomes the single source and web reads through it, or (b) web schema mirrors backend with documented sync. Documented in audit roadmap as W2.2.

### P2.2 — Test runner gaps

- `packages/crs` has no `test` script (typecheck-only).
- `packages/source-adapters` has no test infrastructure (vitest tests live in `apps/web/__tests__/`).

**Fix path:** add `test` scripts + minimal vitest devDep to each package. Surfaces existing latent bugs (P1.6 + P1.7 above).

### P2.3 — Backend has pre-existing TS errors in `passportService.ts`

**Source:** Surfaced during W1.1b verification. Lines 2168 (`VcvCredentialDomain`) and 2209 (implicit any) prevent the `passportService.test.ts` file from compiling. These are unrelated to W1.1b but block the larger jest test suite.

**Fix path:** one-line type imports; no behavior change.

### P2.4 — `_archive/wave119/*` contains banned-string copy

**Source:** Audit P2: `_archive/wave119/about/page.tsx:48` uses "real time" claims contradicted by other surfaces. `_archive/*` is Next.js private (not routed) so this is hygiene only.

**Fix path:** delete the `_archive/wave119/` tree. ~95 files.

### P2.5 — CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts

**Source:** `apps/web/security-headers.mjs:37`. Documented migration path to nonces.

**Fix path:** Wave-4 hardening per audit roadmap. Material SOC2-readiness narrative upgrade.

### P2.6 — Holder readiness `/holder/readiness` is demo-only with hardcoded score 25

**Source:** Current state map. Needs production wiring.

**Fix path:** trust-state-keyed render. ~1 wave.

---

## Truth-contract dependencies (must hold across every blocker fix)

These invariants must NOT regress while clearing the blockers:

1. **`ReceiptCandidate.decisionGrade` is the literal `false`** (CLAUDE.md). No widening.
2. **`PSVReceipt.globalCredentialTruth` is the literal `false`** (passport-contract). No widening.
3. **`rbacEnforced` is the literal `true`** (post-#243). No widening to `boolean`.
4. **`invitationSystemLive` is the literal `true`** (per PR #248). No widening.
5. **`recordedBy: 'demo'` on every demo audit-metadata field.** Bridges that promote demo to system-recorded must be explicit, not inferred.
6. **No banned strings in user-facing copy** (CLAUDE.md §banned). Code Red enforcement gate is in production code at `apps/web/lib/trust/trust-container-view.ts`.
7. **No bare `>Verified<` status labels rendered.** Tests on every new surface assert this.
8. **No NPDB / DEA / ABMS / SAM.gov / Doximity claimed as integrated.**

---

## Non-blockers (often confused for blockers)

These are real findings but do NOT block pilot launch:

- **Pre-existing TS errors in `apps/web/components/clinician/intake-types.ts`** — block `tsc --noEmit` but not the build (Next 15 builds with explicit `types: ['node', 'react', 'react-dom']` per CLAUDE.md). Buyer-facing impact: zero.
- **`packages/crs` with no production callers** — fix in PR #266 is structurally important but invisible until a route wires the engine. Demo and current readiness flow are unaffected.
- **`/admin/demo-reset` route exists with `productionResetEnabled: false`** — non-operational by design; safe.
- **`apps/web/app/_archive/*`** — Next.js private folders, not routable. Hygiene only.

---

## Path to pilot-shippable (sequenced)

1. **Day 0:** merge #266 + #267 + #272 + #250 + #249 (Class A from triage). Restores trust-truth invariants on the homepage demo path. **5 PRs, all surgical.**
2. **Day 1:** verify + close P0.1 (marketing dead-end) with a one-PR rewrite.
3. **Day 1–2:** rebase + merge #243 (RBAC) + #247 (policy-decision persistence). **2 PRs, conflicts to resolve.**
4. **Day 2:** trace + fix P1.3 (trust-state route shape) and P1.4 (catalog cleanup). **2 PRs.**
5. **Day 2–3:** wire one of the six fixture-backed design surfaces to live data (recommend `/dossier` first — it's the most investor-visible and the EdDSA signing is the showcase capability). **1 PR.**
6. **Day 3:** smoke + deploy + first pilot dry-run.

After step 5, the pilot launch demo is **production-real end-to-end** for the canonical path: NPPES + OIG + PECOS source coverage feeds CRS feeds passport feeds dossier signed proof. The remaining five Code Red surfaces can wire in subsequent waves without blocking the pilot launch.
