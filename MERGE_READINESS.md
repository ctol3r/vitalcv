# Merge Readiness Audit — Tier-1 Convergence Stack

**Generated**: 2026-05-12
**Audit scope**: PRs requested by operator: #338, #339, #340, #341, #343, #347, #348, #349, #350, #351, #352, #353, #354, #355 (14 PRs)
**Implicit stack-base PRs (NOT in audit list but required by stacked dependencies)**: #342, #344, #345 (3 PRs)
**Effective merge set**: 17 PRs total
**`origin/main` tip at audit time**: `9eb5cdee`

This document covers the seven concrete risks the brief named —
route collisions, schema conflicts, replay-contract drift, well-known
path conflicts, auth-boundary regressions, build-order failures,
runtime namespace collisions — plus the deploy sequencing plan.

---

## 1. Audit-set integrity flag

The 14 PRs in the audit list cannot all merge alone — three stack-base
PRs are omitted from the list but required by the dependency chain:

| Stack-base (omitted) | Required by (in audit) |
|---|---|
| **#342** Wave 2 adoption (5 web surfaces) | #350, #352 |
| **#344** Wave 14 survivability suite | #351, #353 |
| **#345** /verify partial | — (no PR in the audit list stacks on it, but it shares the #341 base) |

**Recommendation**: include #342 and #344 in the merge set. #345 can
land separately but should also land in the same Tier-1 batch since it
shares the #341 dependency and the Codex review surface is identical.

The effective merge set is **17 PRs**, not 14. The remainder of this
document treats it as 17.

---

## 2. Merge state — all PRs

| PR | Title | Base | mergeStateStatus | CI |
|---|---|---|---|---|
| #338 | docs(ops): production promotion protocol | main | CLEAN | Web Quality ✅ |
| #339 | feat(readiness): canonical trust-readiness boundary (P0-P2) | main | CLEAN | Railway Preflight ✅ |
| #340 | fix(web): passport proxy entity-shape | main | CLEAN | Web Quality ✅ |
| #341 | feat(trust): Lane B primitives | main | CLEAN | Web Quality ✅ |
| #342 | feat(trust): Wave 2 adoption (5 surfaces) | wave/trust-primitives-lane-b | CLEAN | Web Quality ✅ |
| #343 | feat(replay): canonical replay identity (Wave 10) | main | CLEAN | Web ✅ Railway ✅ |
| #344 | test(replay): survivability simulation (Wave 14) | wave/replay-identity-w10 | CLEAN | (test-only; CI N/A) |
| #345 | feat(verify): /verify partial | wave/trust-primitives-lane-b | CLEAN | Web Quality ✅ |
| #347 | security: anon-write extinction (pilot/track) | main | CLEAN | Web ✅ Railway ✅ |
| #348 | security: audit-chain actor attribution | main | CLEAN | Railway ✅ |
| #349 | feat(verifier): well-known + receipt | main | CLEAN | Web Quality ✅ |
| #350 | feat(trust): recent-NPI memory | wave/trust-primitives-adoption | CLEAN | Web Quality ✅ |
| #351 | feat(replay): integrity scripts | wave/replay-survivability-w14 | CLEAN | Web Quality ✅ |
| #352 | feat(trust): replay-integrity panel | wave/recent-npis-lineage | CLEAN | Web Quality ✅ |
| #353 | docs(contracts): replay-identity contract | wave/replay-survivability-w14 | CLEAN | (doc-only) |
| #354 | feat(replay): cross-surface convergence verifier | wave/replay-integrity-scripts | CLEAN | Web Quality ✅ |
| #355 | feat(verifier): completion (openid-config, /trust, by-lineage) | wave/well-known-w9 | CLEAN | Web Quality ✅ |

**Every PR is CLEAN + MERGEABLE.** No PR has a blocking review or
failed required check.

---

## 3. Dependency graph

```
origin/main (9eb5cdee)
  │
  ├─ #338  docs/protocol                                  [INDEPENDENT]
  ├─ #339  canonical readiness                            [INDEPENDENT]
  ├─ #340  passport-proxy fix                             [INDEPENDENT]
  ├─ #341  Lane B primitives  ─┬─→ #342  Wave 2 adoption  ──→ #350  recent-NPIs  ──→ #352  replay-integrity panel
  │                            └─→ #345  /verify partial
  ├─ #343  replay identity (Wave 10)  ──→ #344  survivability  ─┬─→ #351  integrity scripts  ──→ #354  surface convergence
  │                                                             └─→ #353  contract doc
  ├─ #347  anon-write extinction (pilot/track)            [INDEPENDENT]
  ├─ #348  audit-chain actor attribution                  [INDEPENDENT]
  └─ #349  well-known + receipt  ──→ #355  verifier completion
```

**Topological tiers** (a tier may merge in any order; dependent tiers
land after their base merges):

| Tier | PRs | Dependency |
|---|---|---|
| **A** | 338, 339, 340, 341, 343, 347, 348, 349 | base = main, fully independent of each other |
| **B** | 342, 345, 344, 355 | base = a Tier-A PR; rebase after Tier-A merges |
| **C** | 350, 351, 353 | base = a Tier-B PR; rebase after Tier-B merges |
| **D** | 352, 354 | base = a Tier-C PR; rebase after Tier-C merges |

---

## 4. File-collision matrix

Two files are touched by more than one PR. **Both are on the SAME
linear stack** — they are rebase concerns, not merge-time conflicts:

| File | PRs (chronological on stack) |
|---|---|
| `apps/web/components/trust/index.ts` | #341 (creates), #350 (extends), #352 (extends) |
| `apps/web/app/passport/[id]/PassportEntityClient.tsx` | #342 (TrustHeader), #350 (RecentNpis), #352 (ReplayIntegrityPanel) |

Each later PR in the chain has already absorbed the prior PR's
modifications via the stack base. **After each PR in the chain merges,
the next PR rebases automatically against new main without conflict.**

**All other files appear in exactly ONE PR.** Zero cross-stack file
collisions.

---

## 5. Risk audit — seven concrete checks

### 5.1 Route collisions

| Concern | Status |
|---|---|
| `/api/passport/[npi]` proxy collision | none — #340 modifies the existing handler; no parallel PR touches it |
| `.well-known/*` slug overlap | none — #349 introduces 4 new dir names (`jwks.json`, `did.json`, `openid-credential-issuer`, `trust-register`); #355 adds `openid-configuration` (distinct); zero overlap with the pre-existing `apple-app-site-association` + `assetlinks.json` on origin/main |
| `[npi]` vs `[lineageKey]` slug collision under `/api/receipt/` | **resolved in #355** by mounting at `/api/receipt/by-lineage/[lineageKey]` instead of `/api/receipt/[lineageKey]` (Next.js does not allow two different dynamic-slug names at the same path level) |
| `/verify` vs `/verify-receipt` etc. | none — only `/verify` introduced (#345); `/api/receipt/*` separate |
| `/trust` overview page | new (#355); no existing route on origin/main owns it |
| Pilot-event + audit-chain hardening | route names unchanged; only handler logic + auth gate added |

**Verdict: zero route collisions.**

### 5.2 Schema conflicts

| Concern | Status |
|---|---|
| Prisma `schema.prisma` modifications | **NONE.** No PR in the merge set modifies the Prisma schema. |
| Migration files | **NONE.** No new `prisma/migrations/*` files. |
| DB column additions | **NONE.** All identifier work (replay identity, audit-actor) uses existing columns + JSON metadata. |
| Web `PassportData` type | #343 extends with optional `replay` field (backward-compatible). No other PR modifies the type. |
| Backend `PassportDataContract` | #343 extends with `replay` field. No other PR modifies. |
| `DeterministicTrustReadiness` | #339 changes scoring math; field shape unchanged. |

**Verdict: zero schema conflicts.**

### 5.3 Replay contract drift

| Concern | Status |
|---|---|
| `lin_v1_` / `run_v1_` algorithm changes | #343 establishes the canonical algorithm; #352 mirrors it on web; #354 + #351 consume it; #353 documents it. **No PR alters the algorithm.** |
| Scheme version drift | All PRs emit `schemeVersion: 'v1'` consistently. |
| Backend ↔ web parity | #352's `clientReplayIdentity.ts` mirrors #343's `replayIdentity.ts`. The contract doc (#353 §3.3) names both modules as the parity-tested reference implementations. |
| Receipt `jti` derivation | #349 pins `jti = receipt:<runId>`; identical across NPI-keyed and lineageKey-keyed receipts (#355 delegates to the NPI handler). |

**Verdict: zero contract drift across the merge set.**

### 5.4 Well-known path conflicts

| Path | PR | Conflict |
|---|---|---|
| `/.well-known/apple-app-site-association` | (origin/main) | preserved untouched |
| `/.well-known/assetlinks.json` | (origin/main) | preserved untouched |
| `/api/.well-known/jwks.json` | (origin/main) | preserved untouched |
| `/.well-known/jwks.json` (RFC root) | #349 | new mount; backward-compat with namespaced version |
| `/.well-known/did.json` | #349 | new |
| `/.well-known/openid-credential-issuer` | #349 | new |
| `/.well-known/trust-register` | #349 | new |
| `/.well-known/openid-configuration` | #355 | new |

All five new well-known routes are **additive**. The pre-existing
mobile-linking routes are not modified.

**Verdict: zero path conflicts.**

### 5.5 Auth-boundary regressions

| Concern | Status |
|---|---|
| Clerk middleware allowlist | well-known surfaces under `/.well-known/*` and `/api/.well-known/*` are public; `/trust`, `/verify`, `/api/receipt/*` should be public-by-design (verifier-facing). **Recommend verifying `apps/web/lib/auth/roles.ts:isPublicRoute()` allows these.** |
| Audit-chain anonymous writes | #348 closes `/api/audit/decision` + `/api/employer-action`. **Existing tests on origin/main that POST to these without `x-clerk-user-id` will start failing post-merge.** None known. |
| Pilot/track anonymous writes | #347 closes `/api/pilot-ops/events` + adds `/api/track/apply`. **Browser tabs open during deploy may send `APPLY_CLICKED` to the deprecated path.** Low risk. |
| Public read surfaces | all `.well-known/*` + `/trust` + `/verify` + `/api/receipt/*` are read-only public. Recommend Clerk middleware matcher exempts them. |

**Risk: MEDIUM** — confirm `isPublicRoute()` covers all new public
verifier surfaces before #349 + #355 merge. If not, add to allowlist in
a small follow-up; the routes themselves work either way (Clerk
middleware would just 401 them, which is wrong for public verifier
endpoints).

### 5.6 Build-order failures

| Concern | Status |
|---|---|
| `packages/trust-state` prebuild | turbo pipeline already handles this; all PRs build via `pnpm turbo run build --filter @vitalcv/web` and the workspace dep prebuilds automatically. |
| Cross-app imports (web ← backend) | #352's `apps/web/__tests__/replay-identity-parity.test.ts` and #354's `verify-surface-convergence` ts use the existing `externalDir: true` Next experiment + vitest's resolver; tested under CI. |
| Prisma client generation | not touched. |
| `@types/react` override at root | not touched. |
| `apps/marketing` divergence | not touched. |

**Verdict: zero build-order failures expected.**

### 5.7 Runtime namespace collisions

| Concern | Status |
|---|---|
| Two `next-server` processes | runtime-collapse work already retired the OpenClaw scaffold (see prior session). Only one canonical web :3030 + api :4000 alive. |
| ENV variable collisions | new env reads: `VITALCV_ISSUER_ORIGIN` (#349 helper), `VITALCV_RUNTIME_CHANNEL` (#349), `VITALCV_DEPLOY_COMMIT` (#349). All optional with fallback. No collision with existing env. |
| Worktree fleet | 88 worktrees (post-cleanup). None of the audit set's branches collide with worktree paths. |
| Port allocation | no PR changes port bindings. |
| Background processes / cron | none added or modified. |

**Verdict: zero namespace collisions.**

---

## 6. Blocker matrix

| Blocker | Severity | Affects | Mitigation |
|---|---|---|---|
| `isPublicRoute()` allowlist may not cover new well-known + /trust + /verify + receipt routes | MEDIUM | #349, #345, #355 | verify on canonical runtime BEFORE merging; if blocked, add a 5-line PR to `apps/web/lib/auth/roles.ts` |
| #339 scoring math change invalidates `getCachedTrustState` cache rows post-deploy | MEDIUM | #339 | run `DELETE FROM verification_artifact WHERE source='TRUST_STATE_ENGINE'` against Railway DB after the backend deploy completes |
| #348 changes `metadata.actorId` shape: previously `employerId`, now Clerk user id | MEDIUM | downstream analytics consumers reading `AuditEvent.metadata.actorId` | grep for `metadata.actorId` reads before merge; #348 also adds `metadata.employerId` so org-level joins still work |
| #347 `useTrackEvent` client cache during deploy | LOW | open browser tabs sending APPLY_CLICKED to deprecated path | acceptable telemetry-class drop; no user-facing impact |
| Codex SAFE verdict missing on all 17 PRs | **CRITICAL** | every merge | operator runs `codex exec` per PR; required by `gh pr merge` hook |
| Tier-B/C/D rebase after Tier-A merges | LOW | #342, #344, #345, #350, #351, #352, #353, #354, #355 | mechanical: `gh pr edit <N> --base main` per dependent PR after its parent merges; or `gh pr merge` with auto-rebase if available |
| #344 has no Web Quality check recorded | LOW | merge UI may flag as not-yet-verified | test-only PR; push an empty commit or close/reopen to trigger CI before merge |

---

## 7. Safe merge order

### 7.1 Tier A (independent, base=main) — any order

These 8 PRs have **zero file overlap** with each other and zero
dependency on each other. They can merge in any sequence. Recommended
order (lowest to highest runtime impact):

1. **#338** docs only — zero runtime impact
2. **#340** 1-line web proxy fix — unblocks `/api/passport/[npi]`
3. **#341** new components only (additive) — no surface adoption yet
4. **#349** new routes only (additive) — verifier discoverability surfaces
5. **#343** backend response field + optional web type (additive)
6. **#348** auth gate on 2 audit routes + actor attribution
7. **#347** auth gate on 2 routes + new endpoint
8. **#339** backend math change — **requires cache flush post-deploy**

Reasoning for sequencing within Tier A:
- Docs first establishes the protocol doc + lockdown test in main.
- Proxy fix (#340) before primitives (#341) so visual smoke tests pass.
- Additive PRs (#341, #349, #343) before security (#347, #348) so the
  surface stack is in place when auth boundaries tighten.
- #339 last in Tier A because it needs the cache-flush operational step.

### 7.2 Tier B — after Tier A merges + rebase

| PR | New base | Notes |
|---|---|---|
| #342 | main | rebase off main after #341 merges |
| #345 | main | rebase off main after #341 merges |
| #344 | main | rebase off main after #343 merges (test-only — trigger CI before merge) |
| #355 | main | rebase off main after #349 merges |

### 7.3 Tier C — after Tier B merges + rebase

| PR | New base | Notes |
|---|---|---|
| #350 | main | rebase off main after #342 merges |
| #351 | main | rebase off main after #344 merges |
| #353 | main | rebase off main after #344 merges (doc-only) |

### 7.4 Tier D — after Tier C merges + rebase

| PR | New base | Notes |
|---|---|---|
| #352 | main | rebase off main after #350 merges |
| #354 | main | rebase off main after #351 merges |

---

## 8. Risky merge points

| Merge | Risk | What to watch |
|---|---|---|
| #339 → main | MEDIUM | Run cache-flush SQL within the same operator session; verify a seeded NPI's readiness score on the live API afterward |
| #347 → main | MEDIUM | Verify `/api/pilot-ops/events` returns 401 anonymous + 200 authenticated against the Vercel preview before merging |
| #348 → main | MEDIUM | Verify `/api/employer-action` 401 contract; grep downstream consumers for `metadata.actorId` assumptions |
| #349 → main | MEDIUM | Verify `/.well-known/jwks.json` returns 200 (not 500 from Clerk middleware) on Vercel preview |
| #355 → main | MEDIUM | Same as #349 for the additional surfaces (`openid-configuration`, `/trust`, `/api/receipt/by-lineage/*`) |
| All other Tier-A PRs | LOW | standard convergence checks |
| Tier B/C/D rebases | LOW | mechanical; CI re-runs catch any rebase introducing breakage |

---

## 9. Deploy sequencing plan

### Phase 1 — Tier A (after Codex SAFE per PR)

```
git fetch origin main
codex exec --pr 338 --policy=safe
gh pr merge 338 --squash --delete-branch \
  --subject "docs(ops): formalize production promotion protocol with lockdown test"

codex exec --pr 340 --policy=safe
gh pr merge 340 --squash --delete-branch \
  --subject "fix(web): point passport proxy at entity-shape backend route"

codex exec --pr 341 --policy=safe
gh pr merge 341 --squash --delete-branch \
  --subject "feat(trust): canonical institutional trust primitives (Lane B)"

codex exec --pr 349 --policy=safe
gh pr merge 349 --squash --delete-branch \
  --subject "feat(verifier): well-known discovery surfaces + signed VC 2.0 receipt endpoint"

codex exec --pr 343 --policy=safe
gh pr merge 343 --squash --delete-branch \
  --subject "feat(replay): canonical deterministic replay identity (Wave 10)"

codex exec --pr 348 --policy=safe
gh pr merge 348 --squash --delete-branch \
  --subject "security: actor-attribution on audit-chain writes (Cluster 1)"

codex exec --pr 347 --policy=safe
gh pr merge 347 --squash --delete-branch \
  --subject "security: eliminate anonymous write contamination in pilot events and apply tracking"

# Pre-stage cache flush before #339:
psql "$RAILWAY_DATABASE_URL" -c \
  "DELETE FROM verification_artifact WHERE source='TRUST_STATE_ENGINE';"

codex exec --pr 339 --policy=safe
gh pr merge 339 --squash --delete-branch \
  --subject "feat(readiness): canonical trust-readiness boundary (P0-P2 convergence)"
```

### Phase 2 — Tier B (rebase + Codex per PR)

After every Tier-A PR has merged, rebase each Tier-B PR:

```
for n in 342 344 345 355; do
  gh pr edit $n --base main
done

# Push empty commit on #344 to trigger CI (it's test-only and has no checks recorded yet)
git fetch origin wave/replay-survivability-w14
# (operator does the empty-commit push from a worktree)

# Then per PR:
codex exec --pr 342 --policy=safe
gh pr merge 342 --squash --delete-branch ...

codex exec --pr 344 --policy=safe
gh pr merge 344 --squash --delete-branch ...

codex exec --pr 345 --policy=safe
gh pr merge 345 --squash --delete-branch ...

codex exec --pr 355 --policy=safe
gh pr merge 355 --squash --delete-branch ...
```

### Phase 3 — Tier C

After Tier B merges:

```
for n in 350 351 353; do gh pr edit $n --base main; done
# Codex + merge each in order
```

### Phase 4 — Tier D

After Tier C merges:

```
for n in 352 354; do gh pr edit $n --base main; done
# Codex + merge each
```

### Phase 5 — Post-merge convergence verification

After all 17 PRs land:

```bash
# Run the cross-surface convergence verifier against the Vercel preview
pnpm exec tsx scripts/replay/verify-surface-convergence.ts \
  --base-url https://app.vitalcv-preview.example.com \
  --npi 1346053246

# Expected: exit 0, all 5 findings ok
```

Exit code 0 → promote `origin/main` to production. Exit code 7 →
investigate which surface drifted before promoting.

---

## 10. Operator checklist (pre-merge gate)

Before initiating Phase 1:

- [ ] Confirm all 17 PRs still report `mergeStateStatus: CLEAN`
- [ ] Confirm CI status: 16/17 green (#344 will need a CI nudge)
- [ ] Push an empty commit on `wave/replay-survivability-w14` to trigger CI on #344
- [ ] Confirm `apps/web/lib/auth/roles.ts:isPublicRoute()` covers:
  - `/.well-known/jwks.json`
  - `/.well-known/did.json`
  - `/.well-known/openid-credential-issuer`
  - `/.well-known/openid-configuration`
  - `/.well-known/trust-register`
  - `/trust`
  - `/verify`
  - `/api/receipt/[npi]`
  - `/api/receipt/by-lineage/[lineageKey]`
- [ ] Identify a known-good NPI on the Railway preview DB for post-merge smoke (the seed NPI `1346053246` works locally; production may need a separate seed)
- [ ] Pre-stage the cache-flush SQL for #339 in an operator terminal
- [ ] Identify analytics consumers reading `AuditEvent.metadata.actorId`
  (grep `apps/api/backend/src` for `metadata.actorId` reads); the
  field's semantics change in #348

---

## 11. Success condition

After Phase 5 completes:

- 17 PRs merged into `origin/main`
- Production deploys on Vercel + Railway carry the new SHA
- `scripts/replay/verify-surface-convergence.ts` returns exit 0 against
  the production runtime
- `/trust` page reachable; all four `.well-known/*` surfaces respond
  200 with RFC-correct payloads
- `/api/receipt/<npi>` issues an ES256 JWT that validates against the
  JWKS surface
- Anonymous writes to `/api/pilot-ops/events`, `/api/track/apply`,
  `/api/audit/decision`, `/api/employer-action` all return 401
- Audit chain writes carry `metadata.actorId` = Clerk user id (not
  organization id)

**The institutional trust stack has merged safely without runtime drift.**

---

## 12. Out of scope

This audit does NOT cover:

- New feature waves outside the 17-PR set (the user explicitly froze
  new-wave generation earlier in the session)
- Production deployment configuration (Vercel project settings,
  Railway env vars) — those are operator concerns owned outside this
  repo
- Codex SAFE verdict generation — operator runs `codex exec`
- Browser visual QA — operator visits the Vercel preview URL
- NCQA / Joint Commission acceptance audits — separate domain

---

**Maintainer**: this document was generated from the PR state at
`origin/main` SHA `9eb5cdee`. Re-run the audit if any of the 17 PRs
mutate or any new PR is added to the merge set.
