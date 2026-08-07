# VitalCV master backlog — one list, all tracks (2026-07-20)

**Purpose:** collapse five overlapping planning documents into one prioritized, deduplicated backlog a single lane can act from. This is the superset BASE-0 deliberately did not build.

**Extends:** [`base-0-current-state-2026-07-20.md`](base-0-current-state-2026-07-20.md) — the mount-status authority for the homepage/product waves. Where this doc and BASE-0 disagree on a homepage section, BASE-0 (and the composition manifest it points to) win. This doc adds the tracks BASE-0 does *not* cover: enterprise security (M3), compliance/sources (M4/M7), revenue/GTM (M9 / Wave Q), demand-side product (Waves K–T), ops (M5 / Wave S), and housekeeping.

**Source plans merged:**
- `VitalCV_Current_State_Deep_Audit_..._2026-07-19.md` — homepage/product Waves 0–11
- `VITALCV_MASTER_WAVE_PLAN_2026-07-06.md` — enterprise waves M0–M12
- `GODMODE_WAVE_BUNDLES_II_2026-07-04.md` — demand-side Waves K–T
- `docs/ops/launch-blockers.md` — open blockers #2, #6–#13
- BASE-0 (reconciliation) + `docs/design/shd-0-source-parity-manifest.md` (SHD ledger)

**Baseline commit:** `2012cee6e` (`origin/main`, 2026-07-20). Required checks on main: `Web E2E (Playwright)`, `SCA — critical-only gate`.

---

## 0. Founder decisions — settled 2026-07-20

These gate the lanes below. Recorded here as the decision of record.

| # | Decision | Resolution | What it unblocks |
| --- | --- | --- | --- |
| D1 | **Opportunity model** — how roles enter the system | **All three, phased.** P1 = **concierge import** (hand-load roles for pilot employers; matches the M9 concierge motion, fastest to real matches). P2 = **employer-created native** (existing job-board UI #606; the durable self-serve surface EMP-6.1/#803 already assumes). P3 = **ATS integration** (scale only). | EMP-6.3+ proceeds against this phasing rather than waiting. |
| D2 | **Public-verification scope** | **Public stays NPI-only snapshot; anything richer (incl. relationships) is consent- or auth-gated only.** #748 may reopen **only** behind an ADR, as a consented/authorized feature — never public-by-NPI. *(Founder delegated to recommended default.)* | Wave 8 / GRAPH-8 and the #748 merge, now scoped as consent-gated. |
| D3 | **Pilot-metric threshold** | **Qualitative until a defined cohort + window + method exists.** No numeric "faster" claim on public surfaces until then; only source-backed readiness and requirement progress render meanwhile. *(Founder delegated to recommended default.)* | NUM-1.5, TimeToStart copy, and all public marketing metrics. |

---

## 1. Lanes and priority

Priority: **P0** = do now / gates a pilot · **P1** = next · **P2** = after · **P3** = deferred/park.
Parallel-safety follows BASE-0 §9 (lane-claim) and the release protocol (one homepage-visual PR at a time). Re-read `git log origin/main` before merging any item.

**Verification confidence (read this before dispatching):**
- **✅ VERIFIED** against `origin/main` this session (2026-07-20): Lanes **A**, **B**, **G**, and Lane D's shipped status. Safe to act on.
- **⚠️ PLAN-CLAIMED** — sourced from the 07-04/07-06 plans and **NOT** re-verified against current `main`: Lanes **C, E, F, H**. Grounding already exposed one stale P0 (Wave Q was described as unbuilt; it has fully shipped — see Lane D). **Re-verify each item against `origin/main` before building it.** Treat these as candidates, not facts.

### Lane A — Product / homepage (Waves 0–11)

Homepage Waves 0–3 shipped (#791/792/796/799/800). Remaining:

| ID | Item | State | Next action | Pri | Blocked by |
| --- | --- | --- | --- | --- | --- |
| A1 | **EMP-6.1** honest job-to-start employer preview | **PR #803 OPEN** | Land it; it's the active homepage-zone lane | P0 | — |
| A2 | **PROOF-5.1** mount ProofPacketInspector into Apply chapter | component exists, DEV/design-only | Mount (reuse component, not the /design route); `/design` guard question already resolved (BASE-0 §3.3) | P1 | A1 (homepage zone) |
| A3 | **NUM-1.5** dynamic metrics on signed-in product surfaces | primitive shipped (#792) | Route live product numbers through `EvidenceMetric` | P1 | D3 (copy rules) |
| A4 | **NUM-1.6** metric analytics / registry provenance sweep | partial | Provenance + as-of + classification on every homepage metric | P2 | — |
| A5 | **VIS-4.5** contrast / visual-regression residual | scene matrix shipped (#787) | Extend only if a gap is proven; do not rebuild | P2 | — |
| A6 | **GRAPH-8** synthetic roster deletion | `components/career-graph/data.ts` = 14 `Dr.` fixtures, no importers | Delete or move under test-fixture path (loaded gun) | P1 | — |

### Lane B — Activation / start-ready loop (ACT-1 HTTP surface) — *elevated*

The "start faster" promise cannot be driven by a user today. BASE-0 §6: ledger (1.3) and start events (1.4) are implemented-not-mounted; **two unconnected start paths** exist.

| ID | Item | State | Next action | Pri |
| --- | --- | --- | --- | --- |
| B2 | **ACT-7.3** HTTP surface for the requirement ledger + start-state | ✅ **MERGED** `280cf991d` (#806). 6 audited app-scoped routes (mutations + start-state); tenant via application→opportunity→org; start-ready gated; 12 tests green. The ledger *read* is ACT-7.1's (#805) — collision caught at merge and reconciled. | Done | ✅ |
| B1 | **ACT-7.2** establish the review→application linkage | **Bigger than a field-add.** Backend accept route already verifies `applicationId`+`packetHash`; but `ReviewClient` is entity-keyed (`passport.entityId`) and has NO applicationId — the app context lives in `/employer/decision/[applicationId]`. | Decide how an entity-keyed review obtains its application (pass into `ReviewClient`, or reconcile the two employer surfaces). Prereq for B3. | P1 |
| B3 | **ACT-7.4** bridge `confirm-start` → START_* lifecycle | **Option 1 CHOSEN 2026-07-20.** Two constraints recorded in the design note: `recordStart` only fires from `start_ready`; needs B1 so acceptances carry `applicationId`. | After B1: bridge honoring the `start_ready` gate; never force a start past open required requirements. | P1 |

### Lane C — Enterprise security baseline (M3) — ✅ **VERIFIED 2026-07-20: mostly BUILT, not un-dispatched**

**Third stale-plan correction.** The M-plan framed this as an unbuilt pilot-blocker "not in active rotation." Verification against `origin/main` shows the controls are **substantially built and wired globally** — the real gap splits into *founder env-flips* (the pilot-gate action) and a few *targeted code proofs*. What's actually there:
- **Global authN**: `verifiedIdentityMiddleware` (G1) at `app.ts:3538`, modes off/shadow/enforce (`CLERK_JWT_VERIFICATION`), **security-control-never-silently-no-ops** design.
- **Global tenant gate**: `requireTenantContextOrReadAccess` (`tenantGuard.ts`) at `app.ts:3542` + tests; rich `services/multi-tenant/tenantIsolation.ts` (`assertTenantScope`, `computeBlastRadius`, drift signatures).
- **Org-role guard**: `requireOrgRole` on `verifier.ts`, `applications.ts`, `activation.ts`; `VERIFIER_RBAC_MODE` off/shadow/enforce.
- **HTTP hardening**: `helmet()` (3497) + structured CORS allowlist (3509).

| ID | Item | Verified state | Real next action | Pri |
| --- | --- | --- | --- | --- |
| **C0** | **Founder env-flips** (the actual pilot gate) | `CLERK_JWT_VERIFICATION` + `VERIFIER_RBAC_MODE` default **off**; likely SHADOW on Railway (can't see env). Both are built + fail-loud-not-silent. | **Chris:** confirm shadow is clean in Railway logs, then promote `CLERK_JWT_VERIFICATION=enforce` (needs `CLERK_ISSUER`) → then `VERIFIER_RBAC_MODE=enforce`. Same dark-pending pattern as G1/G2/Sentry. | **P0** |
| C1 | **M3-1** authN coverage *proof* | Middleware global + env-gated; **no route-by-route "401 unauthenticated" coverage test / explicit public-route allowlist audit** found. | Build the allowlist inventory + a test asserting every non-public route rejects unauth (in enforce test-mode). | P1 |
| C2 | **M3-3** tenant isolation *depth* | Middleware + assertion service exist, but scoping is **per-callsite + assertion helpers, not a Prisma query-level extension**; the cross-tenant test is a federation-resolution unit test, **not a per-model deny matrix, and no nightly CI**. | Add a `$extends` org-scope (or prove per-callsite coverage) + a real cross-tenant deny matrix on a nightly job. | P1 |
| C3 | **Blocker #2** verifier RBAC | `rbacEnforced:false`; `getRbacMode()` default off; header-trust until G1 enforce. | Covered by C0 flip **plus** replacing header-trust org-role with real membership resolution once G1 is at enforce. | P1 |
| C4 | **M3-6** HTTP hardening | helmet + CORS allowlist present; **CSP/HSTS specifics unverified**. | Verify CSP enforce + HSTS headers on prod; close any gap. | P2 |
| C5 | **M3-9** enterprise SSO | WebAuthn stub still present. | Real OIDC/SAML; remove stub. | P2 |

### Lane D — GTM / first revenue (M9 + Wave Q) — *the code shipped; what's left is process*

**✅ Verified 2026-07-20 — Wave Q is DONE, not open.** `/api/pilot-intake` and `/api/pilot-request` persist a durable `PilotLead` row (durable-first pattern; `slackDelivered` corrected after delivery); `/admin/leads` exists and is ADMIN-role-gated; `/concierge` page exists; `lib/commercial/pricingFoundation.ts` holds the `collectsPayment:false` discipline across all plans. The 07-04 plan's "leads only hit Slack" is stale. **Do not rebuild.**

Product is far ahead of demand; GTM is at ~0 outreach / 0 pilots. What actually remains is **non-code / founder work**:

| ID | Item | State | Pri |
| --- | --- | --- | --- |
| D-1 | ~~persist pilot leads~~ | **SHIPPED** (`PilotLead`, `persistPilotLead`, `/admin/leads`) | ✅ done |
| D-2 | ~~concierge offer page~~ | **SHIPPED** (`/concierge`) — verify its copy points at the readiness-packet offer and routes to intake | ✅ done (copy audit only) |
| D-3 | **M9-2** founder outreach cadence (locums/staffing/payer credentialing); weekly metric | zero — **founder action, not code** | P0 |
| D-4 | **M9-3** pilot kit (one-pager, agreement template, success-criteria, security overview from Lane C) | docs/process | P1 |
| D-5 | **M9-4** pilot instrumentation — TTS/ISV scoped per org, feeds D3 threshold (`PilotMetric` model exists — verify what's wired) | ⚠️ verify | P1 |

### Lane E — Demand-side product (Waves K–T)

MATCHA (K) + Discover deck (J1–J7) shipped. Remaining:

| ID | Item | Pri | depends-on |
| --- | --- | --- | --- |
| E-L | **Wave L** employer review depth: batch queue + head-start prequalification signal (per-candidate AuditEvent, no batch shortcut) | P1 | D1 phasing |
| E-M | **Wave M** persisted reusable readiness snapshot (`ReadinessSnapshot`, immutable, `GET /api/snapshot/:id`, audited, stale/revoked fail-closed) — the reuse thesis made literal | P1 | — |
| E-N | **Wave N** restore the dead `/widget/apply` embed route + `card.json`/`embed.svg` | P2 | E-K done |
| E-O | **Wave O** honest AI enrichment (real OCR behind flag; "Based on observed patterns" labeling; no AI in verification/decision) | P2 | — |
| E-P | **Wave P** SEAL learning-loop insight surfaces (read-only aggregates, append-only, no source-truth mutation) | P2 | — |
| E-T | **Wave T** cross-employer trust network — **spike/ADR only**, flag-gated, single-tenant, non-binding | P3 | E-L, E-M, D2 |

### Lane F — Sources & compliance (M4 / M7 / blockers)

| ID | Item | State | Pri |
| --- | --- | --- | --- |
| F-1 | **Blocker #6** STATE_BOARD physician-licensure lane | gated, no live adapter | P1 |
| F-2 | **Blocker #8** Nursys institutional access (agreement + E-Notify); stays `accessRequired` until live | fail-closed stub | P1 |
| F-3 | **Blocker #9** continuous monitoring (Wave 245 scheduler, `MONITORING_ENABLED`) | off | P1 |
| F-4 | **Blocker #7** SAM.gov exclusions live wiring | gated | P2 |
| F-5 | **M4-3** HIPAA-alignment packet (safeguards map, IR plan, BAA template) | none | P1 |
| F-6 | **Blocker #11** revocation registry VC 2.0 Bitstring + verifier fail-closed tests (passport half shipped #799) | StatusList2021 only | P1 |
| F-7 | **Blocker #12/#13** compliance proof-pack + certs (SOC 2 / NCQA) — copy stays "aligned", never "certified" | none | P2 |

### Lane G — Housekeeping (M0 residue)

| ID | Item | Pri |
| --- | --- | --- |
| G-1 | ~~`SCA — critical-only` RED main-wide: `tar ≤7.5.18` DoS (GHSA-23hp-3jrh-7fpw) via `apps/mobile` Expo toolchain~~ | ✅ **RESOLVED** `320479eea` (#808): root `pnpm.overrides` `tar: ">=7.5.19"` → resolves 7.5.20, critical 1→0; blast radius confined to `@expo/cli` (web/api don't use tar). **Note:** #810 landed a *second* fix in parallel (documented `ignoreGhsas` + ignore-aware gate). Both are on main. Since the override actually remediates the CVE, the ignore entry is now redundant — consider dropping it so a future recurrence isn't silently masked. | ✅ (see note) |
| G-0 | ~~`Web E2E (Playwright)` required-but-path-filtered → every backend-only PR permanently BLOCKED~~ | ✅ **RESOLVED** `5966537c2` (#811): removed the `paths:` filter from ci.yml's **pull_request** trigger only (`push` stays filtered). Rejected the usual `paths-ignore` companion stub — `paths`/`paths-ignore` are not exact complements, so a mixed web+non-web PR fires both and emits two same-named check runs, which can mask a real E2E failure. Cost: web suite runs on every PR (~8m E2E). If that bites, short-circuit *inside* the job — never re-add a trigger-level filter. | ✅ |
| G-1b | Batch the other 8 Dependabot PRs (#794, #582, #580, #577, #576, #575, #574, #573) | P1 |
| G-2 | vitest 1.6→4.1 migration (#581) — a real migration, its own task, not a bump | P1 |
| G-3 | Open-PR triage per BASE-0 §8: #636 rebase-and-merge (148 behind), #748 rebase+hold-for-ADR, #543 extract-or-close (231 behind), #420 re-validate, #506 hold | P1 |
| G-4 | Worktree/branch triage (~80 worktrees, stale feature branches) | P2 |
| G-5 | ~32 pre-existing vitest failures on main — quarantine or fix, stop treating as noise | P2 |

### Lane H — Ops & observability (M5 / Wave S)

| ID | Item | State | Pri |
| --- | --- | --- | --- |
| H-1 | **M5-6** backup restore drill (PITR configured 2026-07-07; drill never run) | pending | P0 |
| H-2 | **M5-1** Sentry on web/api/verifier with PII scrubbing | partial | P1 |
| H-3 | **Wave S** operator remediation hints, GATED alerts, absolute ISO timestamps, diagnostics polling (residual W16) | partial | P2 |

### Park (explicit, with trigger)

- **Wave R — mobile wallet productionization.** Built + tested on the Expo skeleton; **park until first pilot demands mobile presentation.** Do not silently forget.

---

## 2. First dispatch (recommended order — corrected after grounding)

1. **Verified P0 build → start here:** Lane **B** (ACT-1 HTTP surface, B1→B2→B3). From BASE-0 §6 (verified). It's the elevated gap — the live hero promises "start faster" and no user can drive start-ready today. Not in the homepage zone, so it doesn't collide with #803.
2. **In-flight, let it land:** A1 (#803 employer preview). Homepage zone → honors one-PR-at-a-time.
3. **Founder / process, parallel, no eng gate:** D-3 outreach cadence + D-4 pilot kit. (Lane D *code* is already shipped — see Lane D.)
4. **P0 but VERIFY-FIRST:** Lane C (C1/C2/C3 security) and H-1 (restore drill) — plan-claimed; confirm against `main` before building. C3 (verifier RBAC) is likely *shadow-live, enforcement-off*, not unbuilt — check `VERIFIER_RBAC_MODE`.
5. **P1 after:** A2 PROOF-5.1 mount, A3 NUM-1.5, E-M reusable snapshot, A6 roster deletion, G-3 PR triage.
6. **ADR-gated:** E-T and #748 wait on the D2-scoped consent ADR.

> **Standing correction from this session:** the 07-04/07-06 plans overstate what's open (Wave Q was already fully built). Before dispatching any ⚠️ plan-claimed item, grep `origin/main` first — the code is routinely ahead of the plan.

## 3. Anti-drift rules (carried from both master plans — apply to every closing PR)

- Audit-first: every mutating action writes an AuditEvent **before** 2xx.
- Recognition → Acceptance → Start frozen; revoked/expired/missing fails closed; revocation overrides all.
- Zero PHI on-chain. Gated stays gated. Never claim NPDB/DEA/ABMS/SAM/Nursys/FSMB until live; never "certified"; no bare `Verified` label.
- No `prisma migrate` without founder approval — SQL plans to `docs/migrations/` first.
- No demo theater: if it isn't real, it's labeled "Illustrative" or it doesn't ship.
- Every displayed number declares industry-benchmark / live-capability / pilot-outcome (D3).
- Re-audit `origin/main` before building **and** before merging; claim your lane in BASE-0 §9 first.
