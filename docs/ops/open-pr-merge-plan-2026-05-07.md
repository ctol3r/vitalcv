# Open PR Merge Plan — 2026-05-07
**Authored by:** OpenClaw (orchestrator role only)  
**Scope:** All open PRs against `origin/main` as of 2026-05-07  
**Baseline:** `origin/main` @ `bf654a94` (post-Wave B/D/E/F/H board delta, PR #274)  
**Mandate:** Analysis and prompts only. No merges. No builds.

---

## Operating Rules (from CLAUDE.md)

- **Claude Code Terminal** executes all merges.
- **Codex** (`codex exec`) is mandatory before every merge. A `feature-dev:code-reviewer` stand-in does NOT satisfy the hook.
- **Never** `git checkout main && git pull origin main` — local main is held by another worktree.
- **Always** rebase against `origin/main`, not local `main`.
- **No `prisma migrate`** without explicit founder approval.
- Banned strings must not appear in any merged file. Codex copy audit verifies this.

---

## Tier System

| Tier | Action | Meaning |
|---|---|---|
| **MERGE** | Proceed after Codex SAFE | Clean, valuable, passes all gates |
| **REBASE-MERGE** | Rebase then Codex, then merge | Conflicted but worth keeping |
| **CLOSE** | Close without merging | Superseded, stale, or contaminated |
| **HOLD** | Do not merge yet | Blocked by upstream dependency |
| **FOUNDER-GATE** | Requires explicit founder approval | Prisma migration or schema change |

---

## Tier 1 — MERGE-READY (clean, no conflicts, high value)

---

### PR #276 — ROI Console v2 `/employer/roi`
**Branch:** `feat/integration-wave-44-roi`  
**Title:** feat(employer): ROI Console v2 — per-pilot value dashboard at /employer/roi (Wave 44)  
**Files:** 20 files — `apps/web/app/employer/roi/`, `apps/web/components/roi-v2/`, 3 test files  
**Mergeable:** UNKNOWN (likely clean — created today, main has moved ~10 commits since)  

**What it changes:** New route `/employer/roi` with per-pilot ROI dashboard. Sibling to the aggregate `/roi` (Wave E #265, already on main). Components: `DecisionFlowFunnel`, `HeadlineMetric`, `HoursOnlyBanner`, `LaneBreakdownTable`, `MethodologyPanel`, `PerDecisionCompare`, `RoiConsoleHeader`, `RoiHeadlineStrip`, `RoiStatusPip`, `RoiTimelineChart`. Includes 3 test files.

**Code Red conflict:** None identified. Wave E (#265) merged cleanly. This is additive.

**Truth risk:** ROI surfaces are high-risk for overclaiming. Must verify no "guaranteed savings", no hardcoded time metrics presented as real, no "hire instantly" language. `HoursOnlyBanner` name suggests time claims — inspect.

**Requires Codex SAFE:** YES — new employer-facing UI with ROI/metrics copy.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-276-roi-console /tmp/vitalcv-pr276 origin/main
cd /tmp/vitalcv-pr276
git fetch origin feat/integration-wave-44-roi
git merge --no-ff origin/feat/integration-wave-44-roi
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/employer-roi-page.test.tsx __tests__/roi-v2-doctrine.test.ts __tests__/roi-v2-headline-strip.test.tsx
gh pr merge 276 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #276 (feat/integration-wave-44-roi) against origin/main.

Three required audits:

1. IMPLEMENTATION AUDIT
- Verify /employer/roi page mounts without runtime errors
- Verify all roi-v2 components receive only computed/bounded props (no hardcoded metrics presented as real)
- Verify tests pass and cover the doctrine module
- Verify no new routes are added to middleware without auth checks
- Verify no Prisma schema changes

2. DIFF AUDIT
- Verify no files outside apps/web/app/employer/roi/, apps/web/components/roi-v2/, apps/web/__tests__/ are modified
- Verify no changes to packages/crs, packages/trust-state, or packages/domain-common
- Verify no changes to middleware.ts or next.config.mjs

3. COPY/TRUTH AUDIT
- Scan all new files for banned strings: "automatically verified", "guaranteed verification", "hire instantly", "risk transferred", "certified compliant", "HIPAA compliant", "SOC2 certified"
- Scan for bare "Verified" status labels
- Scan for NPDB, DEA, ABMS, SAM.gov, Doximity references
- Verify all displayed metrics are either live-computed or structurally labeled as illustrative/demo
- Verify no "zero-trust ledger" or "ledger" language

Verdict: SAFE or FAIL with specific line references.
```

**Recommendation:** **MERGE** after Codex SAFE. High value. Additive only.

---

### PR #272 — OIG Three-Way Confidence Semantics (W1.2)
**Branch:** `feat/oig-confidence-semantics`  
**Title:** feat(oig): restore three-way confidence semantics — no_match / possible_match / exact (W1.2)  
**Files:** 3 — `packages/source-adapters/src/adapters/oig.ts`, `packages/source-adapters/src/types.ts`, `apps/web/__tests__/oig-adapter-confidence.test.ts`  
**Mergeable:** UNKNOWN

**What it changes:** Closes a P0 truth-contract bug: `oig.ts` was emitting `confidence: 'exact'` for both "0 records returned" (no match) and "N records returned" (hit). A clean no-match was semantically identical to a verified safe clearance. This PR introduces proper `no_match` / `possible_match` / `exact` discrimination.

**Code Red conflict:** None — this is a bug fix in `packages/source-adapters`, a package that had no recent merges. Direct fix of a P0 truth-contract issue per the W1.2 audit.

**Truth risk:** POSITIVE — this PR makes the system more truthful. Merge as soon as possible.

**Requires Codex SAFE:** YES — modifies the OIG source adapter which is in the live trust path.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-272-oig-semantics /tmp/vitalcv-pr272 origin/main
cd /tmp/vitalcv-pr272
git fetch origin feat/oig-confidence-semantics
git merge --no-ff origin/feat/oig-confidence-semantics
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/oig-adapter-confidence.test.ts
gh pr merge 272 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #272 (feat/oig-confidence-semantics) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm oig.ts now returns confidence: 'no_match' when result count === 0
- Confirm confidence: 'possible_match' when name match but no NPI confirmation
- Confirm confidence: 'exact' only when NPI and name both match source record
- Confirm the three-way type is defined in types.ts and exported
- Confirm test covers all three paths with assertions

2. DIFF AUDIT
- Verify ONLY packages/source-adapters/src/adapters/oig.ts, packages/source-adapters/src/types.ts, and the test file are changed
- Verify no other adapter is modified
- Verify no Prisma schema changes
- Verify no UI copy changes

3. COPY/TRUTH AUDIT
- Confirm no banned strings introduced
- Confirm no "NPDB", "DEA", "ABMS" references
- Confirm confidence labels are not exposed raw to the user interface (they feed TrustStateResolver which renders its own labels)

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE FIRST.** P0 truth-contract fix. Highest priority in this list.

---

### PR #266 — CRS Licensure Cap Engine (W1.1)
**Branch:** `feat/crs-licensure-cap`  
**Title:** feat(crs): cap CRS at L1 (45) when licensure cannot be sourced (W1.1)  
**Files:** 3 — `packages/crs/CrsEngine.ts`, `packages/crs/__tests__/CrsEngine.test.ts`, `packages/crs/index.ts`

**What it changes:** Adds a hard ceiling in CRS computation: when state licensure is `unverified` or `access_required`, the score is capped at L1 (max 45). Prevents a clinician with no verified license from achieving a decision-grade score.

**Code Red conflict:** None. Package-only change with no UI modification. PR #267 (rim propagation) depends on this.

**Requires Codex SAFE:** YES — CRS is a scored primitive. Any scoring change needs verification.

**Dependency:** Must merge before #267.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-266-crs-cap /tmp/vitalcv-pr266 origin/main
cd /tmp/vitalcv-pr266
git fetch origin feat/crs-licensure-cap
git merge --no-ff origin/feat/crs-licensure-cap
pnpm turbo run build --filter @vitalcv/crs
pnpm --filter @vitalcv/crs exec vitest run
gh pr merge 266 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #266 (feat/crs-licensure-cap) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm CrsEngine caps output score at 45 when licensure lane is unverified/access_required/gated
- Confirm the cap is applied before returning from the compute function (not as a post-hoc override)
- Confirm tests assert: score > 45 is impossible when licensure is unverified; cap lifts when licensure is 'verified'
- Confirm the literal cap value 45 (L1 ceiling) is defined as a named constant, not a magic number

2. DIFF AUDIT
- Verify ONLY packages/crs/ files are changed
- Verify no UI, no API routes, no Prisma schema changed

3. COPY/TRUTH AUDIT
- No copy introduced — no copy audit required beyond confirming no banned strings in comments

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE** (before #267). Critical truth-contract fix.

---

### PR #267 — CRS Licensure Cap Rim Propagation (W1.1b)
**Branch:** `feat/crs-licensure-cap-rim`  
**Title:** feat(readiness): propagate CRS licensure cap to backend + web rim layers (W1.1b)  
**Files:** 7 — `apps/api/backend/src/services/entity/passportService.ts`, `readinessLicensureCap.ts`, `apps/web/app/passport/[id]/PassportEntityClient.tsx`, `apps/web/lib/demo/demoProfiles.ts`, 2 test files  

**What it changes:** Mirrors the W1.1 engine cap at every readiness-producing surface — backend `passportService`, and the web `PassportEntityClient`. No production/demo surface can render >45 / GREEN / L2+ when licensure is unverified.

**Code Red conflict:** None. `PassportEntityClient.tsx` was touched in PR #250 (demo passport seed). Check for conflict.

**Requires Codex SAFE:** YES. Multi-layer propagation of a score cap. High impact surface.

**Dependency:** Requires #266 merged first.

**Claude Code Terminal commands:**
```bash
# After #266 is merged
git fetch origin main
git worktree add -b merge/pr-267-cap-rim /tmp/vitalcv-pr267 origin/main
cd /tmp/vitalcv-pr267
git fetch origin feat/crs-licensure-cap-rim
git merge --no-ff origin/feat/crs-licensure-cap-rim
# If conflict in PassportEntityClient.tsx — resolve manually, preserving the cap logic
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/readiness-licensure-cap.test.ts
gh pr merge 267 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #267 (feat/crs-licensure-cap-rim) against origin/main (after #266 merged).

1. IMPLEMENTATION AUDIT
- Confirm readinessLicensureCap.ts applies the same ≤45 ceiling as CrsEngine (#266)
- Confirm passportService.ts calls the cap before building the passport object
- Confirm PassportEntityClient.tsx cannot render a GREEN or L2+ badge when licensure is unverified
- Confirm demoProfiles.ts does not contain a demo profile with licensure=unverified AND score >45

2. DIFF AUDIT
- Verify no middleware.ts changes
- Verify no new routes introduced
- Verify no Prisma schema changes
- Verify demoProfiles.ts changes are consistent with the cap (scores reduced, not inflated)

3. COPY/TRUTH AUDIT
- Verify no "Active License Verified" copy when licensure is unverified
- Verify no banned strings
- Verify no NPDB/DEA/ABMS references in new files

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE** after #266. Critical chain of W1.1.

---

### PR #249 — A11y: Homepage `<main>` Landmark
**Branch:** `a11y/homepage-main-landmark`  
**Title:** fix(a11y): wrap homepage in `<main id="main-content">` landmark  
**Files:** 2 — `apps/web/app/HomePageClient.tsx`, `apps/web/__tests__/homepage-main-landmark.test.tsx`  

**What it changes:** Wraps homepage content in a `<main id="main-content">` element for screen reader / keyboard navigation compliance. One of the lowest-risk PRs in the queue.

**Code Red conflict:** `HomePageClient.tsx` was touched in PR-F (Geist font migration, `bae32c90`). Rebase required.

**Requires Codex SAFE:** YES (light audit — structural only).

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-249-a11y-main /tmp/vitalcv-pr249 origin/main
cd /tmp/vitalcv-pr249
git fetch origin a11y/homepage-main-landmark
git rebase origin/main --onto origin/main origin/a11y/homepage-main-landmark
# Resolve any conflict in HomePageClient.tsx — preserve both Geist font changes and <main> wrapper
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/homepage-main-landmark.test.tsx
gh pr merge 249 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #249 (a11y/homepage-main-landmark) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm HomePageClient.tsx now wraps primary content in <main id="main-content">
- Confirm test asserts the landmark is present in rendered output
- Confirm no duplicate <main> elements introduced

2. DIFF AUDIT  
- Verify only HomePageClient.tsx and the test file are changed
- Verify no logic changes — structural HTML only

3. COPY/TRUTH AUDIT
- No copy changes expected — confirm

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE** (after rebase). Trivial improvement, low risk.

---

### PR #244 — Hero Route Smoke Test CI
**Branch:** `wave-2f/smoke-hero-routes`  
**Title:** feat(ci): add hero-route smoke test script and workflow  
**Files:** 3 — `.github/workflows/smoke-hero-routes.yml`, `apps/web/__tests__/smoke-hero-routes-script.test.ts`, `scripts/smoke-hero-routes.sh`  

**What it changes:** Adds a CI workflow that smoke-tests all hero routes (homepage, /clinician, /employer, /passport, /status) for 200 responses. No product code changes.

**Code Red conflict:** None. CI-only.

**Requires Codex SAFE:** YES (light).

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-244-smoke-ci /tmp/vitalcv-pr244 origin/main
cd /tmp/vitalcv-pr244
git fetch origin wave-2f/smoke-hero-routes
git merge --no-ff origin/wave-2f/smoke-hero-routes
bash scripts/smoke-hero-routes.sh  # dry run against local dev server if available
gh pr merge 244 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #244 (wave-2f/smoke-hero-routes) against origin/main.

1. IMPLEMENTATION AUDIT
- Verify smoke-hero-routes.sh tests all current production hero routes
- Verify no routes tested that are known to be broken (e.g. /clinician before auth is wired)
- Verify CI workflow only runs on push to main or PR — not on every branch push

2. DIFF AUDIT
- Verify no product code changed — CI and scripts only

3. COPY/TRUTH AUDIT
- Verify no banned strings in CI workflow steps or script comments

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE**. Pure CI improvement.

---

### PR #237 — DB Migration Baseline + CI Gate (docs only)
**Branch:** `wave-4f/db-migration-baseline`  
**Title:** docs(ops): database migration baseline + CI gate (DB-MIGRATE-1)  
**Files:** 5 — `.github/workflows/ci-preflight.yml`, `.github/workflows/db-migrate-gate.yml`, `apps/api/backend/src/routes/__tests__/employerActions.test.ts`, `docs/ops/database-migration-baseline.md`, `scripts/db-migrate-dry-run.sh`  
**Mergeable:** MERGEABLE (confirmed by GitHub)

**What it changes:** Documents the DB migration baseline plan. Adds a CI gate that dry-runs `prisma migrate` on every PR to detect migration conflicts early. Does NOT execute a migration — dry-run only. Includes a test for employerActions routes.

**Code Red conflict:** None. CI-only + docs.

**Prisma schema:** No schema changes in this PR — only the dry-run gate.

**Requires Codex SAFE:** YES.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-237-db-baseline /tmp/vitalcv-pr237 origin/main
cd /tmp/vitalcv-pr237
git fetch origin wave-4f/db-migration-baseline
git merge --no-ff origin/wave-4f/db-migration-baseline
pnpm --filter @vitalcv/api exec vitest run src/routes/__tests__/employerActions.test.ts
gh pr merge 237 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #237 (wave-4f/db-migration-baseline) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm db-migrate-dry-run.sh uses --dry-run flag and does NOT execute a real migration
- Confirm CI gate fails-safe (migration check failure blocks merge, does not silently pass)
- Confirm employerActions test covers audit-event write before 2xx response

2. DIFF AUDIT
- Verify no Prisma schema.prisma changes
- Verify no migration SQL files
- Verify script is chmod +x and fails gracefully without DATABASE_URL set

3. COPY/TRUTH AUDIT
- Verify docs/ops/database-migration-baseline.md does not promise automatic rollback
- Verify no compliance certification claims

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE**. Docs + dry-run CI only. Safe even without founder approval (no actual migration).

---

### PR #225 — Banned-Strings CI Gate
**Branch:** `wave-3f/banned-strings-gate`  
**Title:** ci(truth): banned-strings CI gate (CLAUDE.md enforcement)  
**Files:** 1 — `.github/workflows/banned-strings-gate.yml`

**What it changes:** A CI workflow that greps for all CLAUDE.md-banned strings across the repo on every PR and fails the build if any are found. Single most important guard rail in the entire CI pipeline.

**Code Red conflict:** None.

**Requires Codex SAFE:** YES (light — verify the grep patterns match CLAUDE.md exactly).

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-225-banned-strings /tmp/vitalcv-pr225 origin/main
cd /tmp/vitalcv-pr225
git fetch origin wave-3f/banned-strings-gate
git merge --no-ff origin/wave-3f/banned-strings-gate
gh pr merge 225 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #225 (wave-3f/banned-strings-gate) against origin/main.

1. IMPLEMENTATION AUDIT
- Verify the workflow greps for ALL banned strings from CLAUDE.md:
  "automatically verified", "guaranteed verification", "complete credentialing",
  "instant credentialing", "legally accepted", "risk transferred",
  "final verification without review", "source confirmed before response",
  "certified compliant", "HIPAA compliant", "SOC2 certified"
- Verify bare "Verified" status label detection (exact match, not substring of "Verified Source")
- Verify the grep excludes: __tests__/ split-join constants, .md docs that quote the banned strings to define them, comments in CLAUDE.md itself

2. DIFF AUDIT
- Verify only .github/workflows/banned-strings-gate.yml is changed

3. COPY/TRUTH AUDIT
- Verify no banned strings appear in the workflow file itself

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE IMMEDIATELY.** This should have been merged before any other PR. Every subsequent PR should have been gated by it.

---

### PR #224 — Route Map + CI Gate
**Branch:** `wave-3b/route-map`  
**Title:** feat(ops): filesystem-derived route map + CI gate (RELEASE-ROUTE-MAP-1)  
**Files:** 4 — `.github/workflows/route-map-gate.yml`, `apps/web/__tests__/route-map.test.ts`, `docs/ops/route-map.md`, `scripts/generate-route-map.mjs`

**What it changes:** Auto-generates a route map from the `apps/web/app/` filesystem and fails CI if the map diverges from documented routes. Prevents dead routes from shipping silently.

**Code Red conflict:** None.

**Requires Codex SAFE:** YES (light).

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-224-route-map /tmp/vitalcv-pr224 origin/main
cd /tmp/vitalcv-pr224
git fetch origin wave-3b/route-map
git merge --no-ff origin/wave-3b/route-map
node scripts/generate-route-map.mjs  # verify output is clean
pnpm --filter @vitalcv/web exec vitest run __tests__/route-map.test.ts
gh pr merge 224 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #224 (wave-3b/route-map) against origin/main.

1. IMPLEMENTATION AUDIT
- Verify generate-route-map.mjs reads from apps/web/app/ filesystem only
- Verify CI gate fails when a route exists in filesystem but not in route-map.md
- Verify CI gate fails when a route is in route-map.md but not in filesystem

2. DIFF AUDIT
- Verify no product code changed

3. COPY/TRUTH AUDIT
- Verify route-map.md does not list /clinician as a dead-but-appearing-live route without a disclaimer

Verdict: SAFE or FAIL.
```

**Recommendation:** **MERGE**. Infrastructure safety net.

---

### PR #223 — Release Checklist + CI Gate
**Branch:** `wave-3a/release-checklist`  
**Title:** docs(ops): add release-checklist + CI gate (RELEASE-CHECKLIST-1)  
**Files:** 2 — `.github/workflows/release-checklist-gate.yml`, `docs/ops/release-checklist.md`

**What it changes:** Formal release checklist document + a CI gate that fails if the checklist is not checked off for production deploys.

**Requires Codex SAFE:** YES (light).

**Recommendation:** **MERGE**. Docs + CI gate only. No product code.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-223-checklist /tmp/vitalcv-pr223 origin/main
cd /tmp/vitalcv-pr223
git fetch origin wave-3a/release-checklist
git merge --no-ff origin/wave-3a/release-checklist
gh pr merge 223 --squash --body "Codex SAFE — see audit transcript"
```

---

### PR #231 — Identity Vendor Foundation (docs only)
**Branch:** `docs/identity-vendor-foundation`  
**Title:** docs(security): add identity vendor foundation  
**Files:** 5 — `apps/web/lib/identity/identityProofingFoundation.ts`, `mockIdentityProofing.ts`, docs, 1 test  

**What it changes:** Defines the identity vendor evaluation framework (Persona/Jumio/Onfido evaluation). All `isLive: false`. No production code changes.

**Code Red conflict:** None.

**Requires Codex SAFE:** YES.

**Recommendation:** **MERGE**. Foundation-only, additive.

---

## Tier 2 — REBASE-MERGE (conflicted, worth keeping)

---

### PR #247 — Policy Decision Persistence ⚠️ CONFLICTING + FOUNDER-GATE
**Branch:** `feat/policy-decision-persistence`  
**Title:** feat(issuer): add policy decision persistence with ISSUER_PERSISTENCE_ENABLED gate  
**Files:** 5 — `apps/web/lib/issuer-verification/policyDecisionRepo.ts`, `apps/web/prisma/schema.prisma`, `apps/web/app/issuer/policy-review/[requestId]/page.tsx`, `apps/web/lib/db.ts`, 1 test  
**Mergeable:** CONFLICTING

**What it changes:** Wires real Prisma-backed persistence for policy review decisions. Adds `PolicyReviewDecision` model to `apps/web/prisma/schema.prisma`. Feature-flagged behind `ISSUER_PERSISTENCE_ENABLED`. Addresses the 5% "real persistence writer" gap on the completion board.

**Code Red conflict:** `apps/web/prisma/schema.prisma` likely conflicts with schema additions from Waves B/D/E/F/H (post-merge on main). `apps/web/lib/db.ts` is also a common conflict surface.

**FOUNDER GATE:** This PR modifies `prisma/schema.prisma`. **Cannot merge without explicit founder approval.** Prisma migration must also be manually reviewed before `prisma migrate` is run in production.

**Requires Codex SAFE:** YES — trust-chain persistence write.

**Claude Code Terminal commands:**
```bash
# STOP: Get explicit founder approval for prisma schema change before proceeding
git fetch origin main
git worktree add -b merge/pr-247-policy-persist /tmp/vitalcv-pr247 origin/main
cd /tmp/vitalcv-pr247
git fetch origin feat/policy-decision-persistence
git checkout -b feat/policy-decision-persistence-rebased
git rebase origin/main
# Resolve conflicts in:
#   apps/web/prisma/schema.prisma — merge model additions, preserve existing models
#   apps/web/lib/db.ts — preserve both connection patterns
# After conflict resolution:
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/policy-decision-persisted.test.ts
# DO NOT run prisma migrate without founder approval
```

**Codex audit prompt:**
```
Audit PR #247 (feat/policy-decision-persistence) after rebase against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm policyDecisionRepo.ts writes ONLY when ISSUER_PERSISTENCE_ENABLED=true
- Confirm the write is gated: if flag is false, function returns a no-op (not an error)
- Confirm an AuditEvent is written BEFORE the 2xx response (not after)
- Confirm the PolicyReviewDecision model in schema.prisma does not store raw PHI
- Confirm all five policy-review gates still fire in order (action, wrong_office, unable_to_verify, conflict_review, ready state)
- Confirm decisionGrade remains literal false on receipt_candidate output

2. DIFF AUDIT
- Confirm schema.prisma conflict was resolved correctly — no existing models dropped
- Confirm no migration SQL file was auto-generated (migration must be explicit founder-approved)
- Verify policyDecisionRepo.ts is server-only (not imported in client components)

3. COPY/TRUTH AUDIT
- Confirm issuer policy-review page copy does not claim "automatically verified" or "legally accepted"
- Confirm "recordedBy: 'demo'" is removed when ISSUER_PERSISTENCE_ENABLED=true (or clearly gated)
- Scan for all banned strings

Verdict: SAFE or FAIL. If SAFE, flag that prisma migrate still requires separate founder approval.
```

**Recommendation:** **REBASE-MERGE** after founder approval for schema change. High value — closes the biggest persistence gap.

---

### PR #243 — Verifier RBAC Enforcement ⚠️ CONFLICTING
**Branch:** `feat/verifier-rbac`  
**Title:** feat(rbac): verifier org RBAC enforcement — rbacEnforced true, /api/verifier/* gated  
**Files:** 4 — `apps/web/middleware.ts`, `apps/web/lib/auth/roles.ts`, `apps/web/lib/auth/orgInvitations.ts`, 1 test  
**Mergeable:** CONFLICTING

**What it changes:** Gates all `/api/verifier/*` routes behind org-scoped RBAC. `rbacEnforced` is the literal `true`. Adds `checkVerifierPermission()` with three gates: no-org → 403, cross-org (timing-safe) → 404, readonly+mutating → 403. Moves the completion board row from 10% to 28%+ on team/org roles.

**Code Red conflict:** `middleware.ts` is a high-conflict file — PR-F and several other waves modified it. Rebase required with careful conflict resolution.

**Requires Codex SAFE:** YES — auth/RBAC is security-critical.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-243-rbac /tmp/vitalcv-pr243 origin/main
cd /tmp/vitalcv-pr243
git fetch origin feat/verifier-rbac
git checkout -b feat/verifier-rbac-rebased
git rebase origin/main
# middleware.ts conflict: preserve ALL existing route protections; add verifier RBAC rules
# Do not remove any existing auth checks
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
gh pr merge 243 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #243 (feat/verifier-rbac) after rebase against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm middleware.ts correctly intercepts ALL /api/verifier/* routes
- Confirm timing-safe cross-org comparison (no timing oracle vulnerability)
- Confirm checkVerifierPermission is called before any data access in verifier routes
- Confirm 'readonly' role cannot call POST/PATCH/DELETE endpoints
- Confirm no org context → 403 (not 401 — do not leak that the endpoint exists)

2. DIFF AUDIT
- Confirm rebase did not drop any existing auth guards from middleware.ts
- Confirm no new unprotected routes were introduced in the rebase
- Confirm orgInvitations.ts does not import client-side Clerk hooks (server-only)

3. COPY/TRUTH AUDIT
- No UI copy changes expected — confirm
- Verify no banned strings

Verdict: SAFE or FAIL.
```

**Recommendation:** **REBASE-MERGE**. RBAC is a prerequisite for pilot. High priority.

---

### PR #240 — Cross-Tenant PSV Reuse Block ⚠️ CONFLICTING
**Branch:** `wave-5c/cross-tenant-reuse`  
**Title:** feat(verifier): cross-tenant PSV reuse block — blocked_cross_tenant, consent-gate in main flow  
**Files:** 2 — `apps/web/lib/issuer-verification/psvReceiptReuse.ts`, 1 test  
**Mergeable:** CONFLICTING

**What it changes:** Enforces that PSV receipt reuse across tenant boundaries requires explicit consent. Adds `blocked_cross_tenant` status to the reuse decision type. Addresses 100%-definition criterion #10.

**Code Red conflict:** `psvReceiptReuse.ts` was likely touched in Waves B/D or similar. Check for conflict.

**Requires Codex SAFE:** YES — reuse boundary is a truth-contract primitive.

**Claude Code Terminal commands:**
```bash
git fetch origin main
git worktree add -b merge/pr-240-cross-tenant /tmp/vitalcv-pr240 origin/main
cd /tmp/vitalcv-pr240
git fetch origin wave-5c/cross-tenant-reuse
git checkout -b wave-5c/cross-tenant-reuse-rebased
git rebase origin/main
# Resolve psvReceiptReuse.ts conflict — preserve existing reuse logic, add cross-tenant gate
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-reuse-cross-tenant.test.ts
gh pr merge 240 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #240 (wave-5c/cross-tenant-reuse) after rebase against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm psvReceiptReuse.ts blocks reuse when tenantId of receipt !== requesting org tenantId
- Confirm 'blocked_cross_tenant' is a distinct status, not a boolean flag
- Confirm consent-gate path is documented (even if consent UI is not yet built)
- Confirm the block fires before any data is returned (not after partial response)

2. DIFF AUDIT
- Verify only psvReceiptReuse.ts and test changed
- Verify no Prisma schema changes

3. COPY/TRUTH AUDIT
- No UI copy changes expected — confirm
- Verify no banned strings

Verdict: SAFE or FAIL.
```

**Recommendation:** **REBASE-MERGE**. Required for 100%-definition criterion #10.

---

### PR #230 — /status Page Compliance Evidence ⚠️ CONFLICTING
**Branch:** `wave-10a/docs-status`  
**Title:** feat(status): wire compliance evidence to /status (DOCS-STATUS-1)  
**Files:** 2 — `apps/web/app/status/page.tsx`, 1 test  
**Mergeable:** CONFLICTING

**What it changes:** Wires the compliance evidence shape into `/status` page. The compliance-evidence API route (`apps/web/app/api/compliance/evidence/route.ts`) was already merged in ENTERPRISE-VANGUARD-6A. This PR wires the UI to consume it.

**Code Red conflict:** `status/page.tsx` was modified in PR `5d530f13` (already on main: "wire compliance evidence shape into /status page — DOCS-STATUS-1"). **This PR may already be superseded by the commit on main.**

**Requires Codex SAFE:** YES.

**Claude Code Terminal commands:**
```bash
cd /Users/christoler/vitalcv
git fetch origin main
git log --oneline origin/main -- apps/web/app/status/page.tsx | head -5
# If 5d530f13 is in the log, this PR is superseded
gh pr diff 230 --stat  # check if any non-status changes exist
```

**Recommendation:** **CLOSE — likely superseded.** `5d530f13` on main is titled identically ("wire compliance evidence shape into /status page — DOCS-STATUS-1"). Verify diff is empty before closing.

---

### PR #250 — Demo Passport Seed ⚠️ POTENTIAL CONFLICT
**Branch:** `feat/demo-passport-seed`  
**Title:** feat(demo): seed Macie Miller PA-C demo passport on /passport/[DEMO_NPI]  
**Files:** 6 — `apps/web/lib/demo/demoPassportFixture.ts`, `seedDemoPassport.ts`, `apps/web/lib/env.ts`, `apps/web/app/passport/[id]/page.tsx`, `PassportEntityClient.tsx`, 1 test

**What it changes:** Seeds a demo passport for Macie Miller PA-C (NPI 1457128589 — known-live NPI per MEMORY.md). Allows a reliable demo walkthrough without depending on live NPPES response timing.

**Code Red conflict:** `PassportEntityClient.tsx` also modified in PR #267. Sequence matters: merge #267 first, then rebase #250 on top.

**Truth risk:** Demo passport must be structurally marked as demo. Verify `demoPassportFixture.ts` carries a `_demo: true` or equivalent flag that surfaces in the UI.

**Requires Codex SAFE:** YES.

**Claude Code Terminal commands:**
```bash
# After #266 and #267 are merged
git fetch origin main
git worktree add -b merge/pr-250-demo-seed /tmp/vitalcv-pr250 origin/main
cd /tmp/vitalcv-pr250
git fetch origin feat/demo-passport-seed
git checkout -b feat/demo-passport-seed-rebased
git rebase origin/main
# Resolve PassportEntityClient.tsx if conflicted — preserve licensure cap from #267
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec vitest run __tests__/demo-passport-seed.test.ts
gh pr merge 250 --squash --body "Codex SAFE — see audit transcript"
```

**Codex audit prompt:**
```
Audit PR #250 (feat/demo-passport-seed) after rebase against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm demoPassportFixture.ts is structurally marked as demo (field _demo:true or equivalent)
- Confirm demo passport does NOT score above L1 if licensure is unverified in fixture (respects #267 cap)
- Confirm seedDemoPassport.ts only runs when DEMO_NPI env var is set (not always-on)
- Confirm PassportEntityClient.tsx renders a visible demo banner when showing demo data

2. DIFF AUDIT
- Verify no production data paths are affected (demo seed is isolated behind env flag)
- Verify env.ts does not expose DEMO_NPI to client bundle

3. COPY/TRUTH AUDIT
- Verify demo passport does not render "Verified" for any lane that is not truly verified in the fixture
- Verify demo banner copy does not use banned strings
- Scan all new files for banned strings

Verdict: SAFE or FAIL.
```

**Recommendation:** **REBASE-MERGE** after #266, #267. Demo path is needed for safe demos.

---

### PR #248 — Verifier Invitation Lifecycle (W6C)
**Branch:** `feat/verifier-invitations`  
**Title:** feat(verifier): live verifier-invitation lifecycle (W6C invitationSystemLive flip)  
**Files:** 11 — `apps/web/app/api/verifier/invite/route.ts`, `apps/web/app/verifier/team/invite/page.tsx`, `apps/web/lib/auth/clerkInvitationSender.ts`, `verifier/invite/[code]/accept/page.tsx`, 2 tests

**What it changes:** Wires live Clerk-based verifier team invitations. `invitationSystemLive` becomes `true`. Depends on PR #243 (RBAC) — invitations without RBAC enforcement are meaningless.

**Code Red conflict:** `apps/web/__tests__/verifier/foundation-sweep-7.test.ts` was from FOUNDATION-SWEEP-7 (already on main). May need rebase.

**Dependency:** Merge #243 first.

**Requires Codex SAFE:** YES.

**Recommendation:** **REBASE-MERGE** after #243.

---

### PR #246 + #245 — Export Bundle + CV Upload (SAME BRANCH)
**Branch:** `feat/upload-cv` (shared by both #245 and #246)  
**PR #245:** feat(upload): add CV upload route and CvUploadZone  
**PR #246:** feat(export): add foundation-tier export bundle route  

**Note:** Both PRs share `feat/upload-cv` branch. They cannot both be merged as separate PRs — one will supersede the other. Likely the branch was pushed twice with different base commits.

**What they change:** CV upload endpoint + `CvUploadZone` component (multipart, PDF/DOCX, USER_ENTERED provenance). Export bundle route foundation.

**Action:** Inspect which PR has the fuller diff. Close the lesser one. Merge the more complete one.

**Requires Codex SAFE:** YES — upload endpoints have security implications (MIME, file size, storage).

**Claude Code Terminal commands:**
```bash
# Compare the two PRs
gh pr diff 245 > /tmp/pr245.diff
gh pr diff 246 > /tmp/pr246.diff
diff /tmp/pr245.diff /tmp/pr246.diff
# Merge only the more complete one
```

**Codex audit prompt (for whichever is merged):**
```
Audit the CV upload PR (feat/upload-cv) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm upload route validates MIME type against allowlist (PDF, DOCX only — no exec types)
- Confirm file size is capped (10MB or configured limit)
- Confirm uploaded file is marked USER_ENTERED provenance — not 'verified'
- Confirm no parsing/OCR sets confidence above 'user_entered' until a source confirmation step exists
- Confirm no virus scan stub silently passes files without a warning

2. DIFF AUDIT
- Verify no Prisma schema changes
- Verify CvUploadZone is a client component (no server-side data access)
- Verify upload API route is auth-gated

3. COPY/TRUTH AUDIT
- Verify CvUploadZone copy does not say "automatically verified" or "instantly processed"
- Scan for banned strings

Verdict: SAFE or FAIL.
```

**Recommendation:** **CLOSE #245 or #246 (the lesser one), REBASE-MERGE the other.**

---

### PR #239 — Document Upload Foundation
**Branch:** `wave-5b/doc-upload`  
**Files:** 6 — `apps/web/app/api/upload/document/route.ts`, `DocumentUploadZone.tsx`, `DropZone.tsx`, `documentFoundation.ts`, `apps/web/app/clinician/import/page.tsx`, 1 test

**Same truth/security concerns as #245/#246.** Additive with no known conflicts.

**Requires Codex SAFE:** YES.

**Recommendation:** **REBASE-MERGE** after #245/#246 decision.

---

### PR #238 — Signup Gate + Magic-Link Recovery
**Branch:** `wave-5a/signup-gate`  
**Files:** 6 — `apps/web/lib/auth/signupGate.ts`, `apps/web/app/api/auth/recovery/route.ts`, `apps/web/app/sign-up/[[...sign-up]]/page.tsx`, `apps/web/lib/env.ts`, `docs/setup/clerk-google-oauth.md`, 1 test

**What it changes:** Domain-allowlist for signup (only approved domains can create accounts). Timing-safe magic-link recovery. Google OAuth setup docs.

**Code Red conflict:** `env.ts` is a shared file. `sign-up/page.tsx` is likely clean. Check for conflict.

**Requires Codex SAFE:** YES — auth path.

**Recommendation:** **REBASE-MERGE**. Prerequisite for prod auth.

---

### PR #236 — PWA Service Worker Shell
**Branch:** `wave-4e/pwa-shell`  
**Files:** 5 — `apps/web/next.config.mjs`, `apps/web/app/manifest.ts`, `apps/web/public/sw.js`, 1 test, 1 CI workflow

**What it changes:** Registers a basic service worker + offline fallback page. Adds Lighthouse PWA CI gate.

**Code Red conflict:** `next.config.mjs` is a frequent conflict surface. Rebase required.

**Requires Codex SAFE:** YES.

**Recommendation:** **REBASE-MERGE**.

---

### PR #233 — Stripe Foundation (`collectsPayment: false`)
**Branch:** `wave-4b/stripe-foundation`  
**Files:** 6 — `apps/web/lib/commerce/stripeFoundation.ts`, `pricingFoundation.ts`, checkout routes, 1 test

**What it changes:** Foundation-tier Stripe integration. `collectsPayment: false` — no actual charges. Adds `/checkout/success` and `/checkout/cancel` shell routes.

**Requires Codex SAFE:** YES.

**Recommendation:** **REBASE-MERGE**. No live payments, low risk.

---

### PR #251 — DB Migrate Cutover Runbook + Dry-Run
**Branch:** `feat/db-migrate-cutover`  
**Files:** 5 — migration SQL file, CI workflow update, test, runbook doc, dry-run script

**What it changes:** Adds the full production migration runbook + a dry-run script. Includes the actual migration SQL (`20260220000001_wave26_27_multitenant/migration.sql`).

**⚠️ FOUNDER GATE:** Contains an actual migration SQL file. **Do not run `prisma migrate` from this PR.** The SQL file should be reviewed by the founder before any production migration step.

**Conflicts with #237:** Both touch `.github/workflows/ci-preflight.yml`. Resolve after #237 merges.

**Recommendation:** **HOLD → REBASE-MERGE** after #237 and after explicit founder review of the migration SQL.

---

## Tier 3 — CLOSE (superseded, contaminated, or stale)

---

### PR #212 — Board 100% Sprint 1 (docs)
**Branch:** `docs/board-100-sprint-1`  
**Title:** docs(ops): map honest path to full completion  
**Superseded by:** `docs/ops/vitalcv-100pct-action-map.md` is already on main at `3c8dc4fa`.

**Recommendation:** **CLOSE.** Content is already on main.

---

### PR #206 — Security Compliance Board Delta (docs)
**Branch:** `docs/security-compliance-delta-1`  
**Title:** docs(ops): apply security compliance delta after EV6 and crypto merges  
**Files:** 1 — `docs/ops/vitalcv-completion-board.md`  
**Superseded by:** Completion board has been updated multiple times since, including BOARD-SCHEMA-3, PR-G delta, RELIABILITY-2 delta. This PR's content is stale.

**Recommendation:** **CLOSE.** Board doc on main is ahead.

---

### PR #181 — Completion Board Product Truth Reset (docs)
**Branch:** `docs/completion-board-product-truth-reset`  
**Superseded by:** Same as #206 — board doc on main is far ahead.

**Recommendation:** **CLOSE.**

---

### PR #190 — Passport Copy Cleanup
**Branch:** `truth/cleanup-2-passport-wording-v2`  
**Files:** `apps/web/app/passport/page.tsx` — removes wallet/real-time wording.  
**Superseded by:** Multiple subsequent PRs have modified `passport/page.tsx`. Verify with diff — if no unique changes remain, close.

**Recommendation:** **CLOSE or INSPECT.** Run `gh pr diff 190` and check if any unique content remains. If not, close.

---

### PR #165, #164, #163 — Knowledge Inbox (triplicate)
**All three branches:** Overlap (`feat/ship-knowledge-inbox-clean`, `feat/god-3-knowledge-inbox`, `feature/ai-knowledge-inbox-agent`)  
**Files:** 89 files each — include `.claude/worktrees/` metadata files, wave commands  
**Superseded by:** Knowledge Inbox foundation was merged in PR #166 (already on main). These PRs include worktree state metadata (`.claude/worktrees/dreamy-goodall-30de59`) that should not be in the repo.

**Recommendation:** **CLOSE ALL THREE.** Worktree metadata files are load-bearing local paths, not repo content.

---

### PR #161 — Wave LIVE-100 (65 files including worktree metadata)
**Branch:** `release/live-100-usable`  
**Files:** 65 — includes `.worktrees/` and `.claude/worktrees/` metadata paths  
**Superseded by:** Multiple post-LIVE-100 PRs have landed. Worktree metadata should not be committed.

**Recommendation:** **CLOSE.**

---

### PR #159 — Apply with VitalCV Core Loop (100 files)
**Branch:** `feature/apply-with-vcv-core-loop`  
**Files:** 100+ including `.claude/scheduled_tasks.lock`, `.claude/settings.local.json`, worktree paths  
**Contaminated:** Contains Claude IDE internal state files (`.claude/scheduled_tasks.lock`). These are not repo content.

**Recommendation:** **CLOSE.** If the actual Apply with VCV logic is needed, cherry-pick only the product files into a clean branch.

---

### PR #158 — Trust Warranty & Risk Transfer
**Branch:** `warranty-clean-pr`  
**Files:** 11 — includes `warranty-review/page.tsx`, `ActuarialRiskPanel.tsx`, Hardhat contracts  
**Truth risk:** "Trust Warranty", "Risk Transfer" are in the banned semantic zone. `risk transferred` is an explicit banned string. Contains blockchain/Hardhat contracts.  
**Superseded by:** Code Red removed blockchain-first features from the path.

**Recommendation:** **CLOSE.** Contains banned semantics and pre-Code-Red blockchain artifacts.

---

### PR #156 — Acceptance Graph Labs
**Branch:** `pr/acceptance-graph`  
**Files:** 7 — `apps/web/app/labs/acceptance-graph/`  

**What it changes:** Predictive acceptance probability UI in a `/labs/` route. `PredictiveAcceptancePanel`, `NetworkConsensusIndicator`, `FacilityPolicyDrawer`.

**Truth risk:** "Network consensus" and "predictive acceptance" may imply network effects that don't exist. Review copy carefully.

**Recommendation:** **HOLD.** Not needed for pilot. Review copy before deciding merge vs close.

---

### PR #134, #133, #132 — Wave 13/14 Omnibus PRs
**Files:** 60–100 files each — include `FINAL_SYSTEM_CLOSURE_PLAN.md`, `ARCHITECTURE-AUDIT-2026-04-13.md`, `AI_ANALYSIS_PROMPTS.md`, workspace metadata  
**Contaminated:** Mix of product code + planning docs + Claude workspace files.  
**Superseded by:** All product work from these waves has been superseded by Waves B through H on main.

**Recommendation:** **CLOSE ALL.** If any unique product logic is needed, extract to a clean branch.

---

### PR #131 — Hybrid Loader
**Branch:** `feat/hybrid-loader`  
**Files:** 10 — `ReviewPageClient.tsx`, identity cache, hybrid provider data hook

**Truth risk:** "instant-render" in title may imply instant credential verification. Inspect copy.  
**Superseded:** `ReviewPageClient.tsx` has been substantially modified since. Merge conflict likely total.

**Recommendation:** **CLOSE.** Rewrite as a focused cherry-pick if the caching logic is needed.

---

### PR #129, #128, #127, #126, #125, #124 — Pre-April Omnibus PRs
**All contain:** `CONTRACTORS.md`, legacy test files, pre-restructure backend code  
**Superseded by:** The entire backend and frontend have been restructured since April 8.

**Recommendation:** **CLOSE ALL.** These predate Code Red and the current architecture.

---

### PR #46, #45 — Vercel CVE Fix (bot PRs)
**Author:** `app/vercel` (bot)  
**Title:** Fix React Server Components CVE vulnerabilities  
**Age:** Created 2026-02-09, last updated 2026-03-22  

**Action:** Check if the CVE patches are already in the current `next` version on main.

**Claude Code Terminal commands:**
```bash
cd /Users/christoler/vitalcv
cat apps/web/package.json | grep '"next"'
# If next >= 15.2 or the CVE patch version, these are superseded
```

**Recommendation:** **CLOSE** if Next version on main already includes the CVE patches. Otherwise **MERGE** immediately (security fix).

---

### PR #42, #41, #40 — Pre-January Codex Wave PRs
**Age:** Created January 2026 and December 2025  
**PR #41 base:** `codex/wave-04` (not main — stale base)  

**Recommendation:** **CLOSE ALL.** Pre-architecture, stale bases, superseded by 200+ subsequent PRs.

---

### PR #39, #38, #37, #36, #35, #34, #33 — December 2025 Codex Wave PRs
**Labels:** `codex`  
**Age:** Created December 28, 2025  

**Recommendation:** **CLOSE ALL.** 5 months stale. All content superseded. Cannot rebase cleanly.

---

### PR #153 — Pilot Intake + Operator Handoff (30 files)
**Branch:** `feature/pilot-intake-operator-handoff`  

**What it changes:** Pilot intake form, operator handoff workflow, buyer pilot copy tests.  
**Conflict risk:** 30 files, opened April 19. Many files will have conflicts.  
**Truth risk:** `__tests__/buyer-pilot-copy.test.ts` — inspect whether pilot copy is still accurate.

**Recommendation:** **HOLD.** Review against current pilot page on main. If pilot intake is needed for GTM, rebase and inspect copy carefully before merge.

---

## Tier 4 — HOLD (upstream dependency or pending decision)

| PR | Reason |
|---|---|
| #267 | Depends on #266 |
| #248 | Depends on #243 |
| #250 | Depends on #266, #267 |
| #251 | Founder approval required for migration SQL |
| #247 | Founder approval required for schema change |
| #153 | Needs copy audit before pilot launch |
| #156 | Needs copy audit for "network consensus" |

---

## Merge Order (Recommended Sequence)

```
IMMEDIATE (no dependencies, highest value):
  1. #225 — banned-strings CI gate
  2. #272 — OIG three-way semantics (P0 truth fix)
  3. #223 — release checklist CI
  4. #224 — route map CI

BATCH A (independent, clean):
  5. #266 — CRS licensure cap
  6. #249 — a11y homepage landmark (after rebase)
  7. #244 — hero route smoke CI
  8. #231 — identity vendor foundation (docs)
  9. #237 — DB migration baseline (docs + dry-run)

BATCH B (sequential deps):
  10. #267 — CRS rim propagation (after #266)
  11. #243 — verifier RBAC (after rebase)
  12. #238 — signup gate (after rebase)

BATCH C (depend on BATCH B):
  13. #240 — cross-tenant reuse block (after rebase)
  14. #248 — verifier invitations (after #243)
  15. #239 — document upload foundation

BATCH D (founder-gated):
  16. #247 — policy decision persistence [FOUNDER APPROVAL REQUIRED]
  17. #251 — migrate cutover runbook [FOUNDER APPROVAL REQUIRED]

BATCH E (higher risk / needs inspection):
  18. #250 — demo passport seed (after #267)
  19. #276 — ROI Console v2
  20. #236 — PWA shell
  21. #233 — Stripe foundation
  22. #245/#246 — CV upload (choose one)
  23. #153 — pilot intake (after copy audit)

CLOSE IMMEDIATELY:
  #212, #206, #181, #165, #164, #163, #161, #159, #158, #134, #133, #132,
  #131, #129, #128, #127, #126, #125, #124, #42, #41, #40, #39, #38, #37,
  #36, #35, #34, #33
  Conditionally close: #190 (inspect diff first), #230 (verify superseded by 5d530f13)

CLOSE ONE, KEEP ONE:
  #245 vs #246 (same branch — choose the more complete PR)

CVE CHECK FIRST:
  #46, #45 — close if Next.js version already patches; merge if not
```

---

## Summary Table

| PR | Title (abbrev) | Recommendation | Priority |
|---|---|---|---|
| #276 | ROI Console v2 | MERGE | Medium |
| #272 | OIG three-way semantics | **MERGE FIRST** | **P0** |
| #267 | CRS rim propagation | MERGE (after #266) | P1 |
| #266 | CRS licensure cap | **MERGE** | P1 |
| #251 | DB migrate cutover | HOLD (founder gate) | P2 |
| #250 | Demo passport seed | REBASE-MERGE | P2 |
| #249 | A11y main landmark | MERGE (rebase) | P3 |
| #248 | Verifier invitations | REBASE-MERGE (after #243) | P2 |
| #247 | Policy decision persist | REBASE-MERGE (founder gate) | P1 |
| #246 | Export bundle route | CLOSE or MERGE (choose vs #245) | P3 |
| #245 | CV upload | CLOSE or MERGE (choose vs #246) | P3 |
| #244 | Smoke CI | **MERGE** | P2 |
| #243 | Verifier RBAC | REBASE-MERGE | P1 |
| #240 | Cross-tenant reuse | REBASE-MERGE | P1 |
| #239 | Document upload | REBASE-MERGE | P3 |
| #238 | Signup gate | REBASE-MERGE | P2 |
| #237 | DB baseline docs | **MERGE** | P2 |
| #236 | PWA shell | REBASE-MERGE | P3 |
| #233 | Stripe foundation | REBASE-MERGE | P3 |
| #231 | Identity vendor docs | **MERGE** | P3 |
| #230 | /status compliance | **CLOSE** (superseded) | — |
| #225 | Banned-strings CI | **MERGE IMMEDIATELY** | **P0** |
| #224 | Route map CI | **MERGE** | P2 |
| #223 | Release checklist | **MERGE** | P2 |
| #212 | Board 100% sprint docs | **CLOSE** | — |
| #206 | Security board delta | **CLOSE** | — |
| #190 | Passport copy cleanup | INSPECT then CLOSE | — |
| #181 | Board truth reset | **CLOSE** | — |
| #165–163 | Knowledge inbox (x3) | **CLOSE ALL** | — |
| #161 | LIVE-100 omnibus | **CLOSE** | — |
| #159 | Apply VCV omnibus | **CLOSE** | — |
| #158 | Trust warranty | **CLOSE** | — |
| #156 | Acceptance graph | HOLD (copy audit) | — |
| #153 | Pilot intake | HOLD (copy audit) | P3 |
| #134–124 | Pre-April omnibus | **CLOSE ALL** | — |
| #46, #45 | Vercel CVE | CVE check first | Security |
| #42–33 | Pre-Jan waves | **CLOSE ALL** | — |
