# BASE-0 — current-state contract (Wave 0)

**Baseline commit:** `86151ad8e` (`origin/main`, 2026-07-20)
**Plan reconciled:** `VitalCV_Deep_Audit_and_Claude_Code_Master_Waves_2026-07-19.md` (Waves 0–11)
**Second source reconciled:** `docs/design/shd-0-source-parity-manifest.md` §7 (SHD execution ledger)
**Method:** every status below was read from `origin/main` at the commit named above, not from a working branch. Claims sourced from a subagent sweep were re-verified against `git show origin/main:<path>` before being written down.

> **Why this document exists.** Two build lanes merged into `main` within 30 minutes of each other on 2026-07-20 (`#791` hero reset, `#792` NUM-1) working from the same plan. NUM-1 was dispatched twice; the second dispatch was abandoned on discovery. This is the plan's own Wave 0 exit gate: *every later PR knows whether it is mounting, refactoring, or replacing existing work.* Read this before starting any wave, and re-read `git log origin/main` before merging.

---

## 1. Status vocabulary

| Status | Means |
| --- | --- |
| **LIVE** | Mounted on a route a real visitor can reach |
| **AUTH-ONLY** | Behind a Clerk/role gate |
| **DEV-ONLY** | Reachable only via `/dev/*` or `/design/*` harness |
| **IMPLEMENTED-NOT-MOUNTED** | Code exists and is tested; nothing renders or calls it |
| **OBSOLETE/REDIRECT** | Superseded; route redirects or is archived |

---

## 2. Homepage composition (`app/HomePageClient.tsx`) — all LIVE

Render order: `SceneProvider` → `ChapterProgressProvider` → ambient scene (`SceneBoundary`/`AmbientField`/`GrainOverlay`/`SceneCursor`) → `HomepageSectionRail` → **hero** (NPI form, `MagneticButton` wallet pill, employer entry, `CareerEvidenceField` / `LiveNpiResult`) → `HeroLoopPills` → `SourceCoverageRibbon` → `ProblemStatBand` → `ScrollFocusManifesto` → `TimeToStartComparison` → `StickyProductStory` → `EvidenceTruthPanel` → `RotatingProofLine` → `ProductCarousel` → `ResumeToProof` → `MetricStrip` → `DualAudienceCta` → trust footer.

There are no dead imports in the file: everything imported is rendered.

**Same directory, nothing renders them** — treat as candidates for deletion, not reuse:

| Component | Status |
| --- | --- |
| `components/home/ForEmployersSection.tsx` | IMPLEMENTED-NOT-MOUNTED |
| `components/home/OutcomeTriad.tsx` | IMPLEMENTED-NOT-MOUNTED |
| `components/home/SocialProofSection.tsx` | IMPLEMENTED-NOT-MOUNTED |
| `components/home/WhatWeCheckSection.tsx` | IMPLEMENTED-NOT-MOUNTED |
| `components/home/WorkflowStoryTabs.tsx` | IMPLEMENTED-NOT-MOUNTED |
| `components/home/PublicTruthSections.tsx` | IMPLEMENTED-NOT-MOUNTED (test-only reference) |

---

## 3. The three plan-critical "already built" assets

### 3.1 `HorizontalStoryRail` — DEV-ONLY, production 404s the harness

| Fact | Evidence |
| --- | --- |
| Importers | `app/dev/story-rail/StoryRailHarness.tsx` only |
| Route guard | `app/dev/story-rail/page.tsx:26` — `NODE_ENV !== 'production' \|\| STORY_RAIL_PREVIEW === '1'`, else `notFound()` |
| Flag set in | `playwright.config.ts:101` **only** — no `.env`, no deploy config |
| Net | Canonical production denies `/dev/story-rail`. The engine is real, tested, and unreachable. |

**HORIZ-2 is therefore a *mount + migrate*, not a build.** Do not write a second rail.

### 3.2 `StickyProductStory` — owns a private scroll driver (the ROLO-3.1 target)

It does **not** consume `ChapterProgress`. It runs its own Framer Motion pipeline: `useScroll({ target: rootRef, offset: ['start start','end end'] })` → `useTransform` → `useSpring` → `useMotionValueEvent`, over a CSS runway `min-height: calc(100vh + 100vh)` (`styles/homepage-motion.css:174-177`) with `.story-stage { position: sticky }`.

The relationship to the shared driver is one-way: it *emits* the anchors `#readiness` / `#matcha` / `#apply` that `ChapterProgressProvider` discovers via `CHAPTER_DOM_IDS`, and reads none of it back. `StickyProductStory()` takes no props.

This is exactly the "second scroll model" the plan's law 4 forbids — and precisely what ROLO-3.1 asks to delete.

### 3.3 `ProofPacketInspector` — DEV-ONLY and *unguarded*

Mounted only at `app/design/proof-packet/page.tsx`. Unlike `/dev/story-rail`, that page has **no `notFound()` guard** — only `robots: { index: false, follow: false }` (`:20`). It is technically reachable in production, merely unlinked and unindexed.

PROOF-5.1 mounts this into the Apply chapter. Either give `/design/*` the same guard as `/dev/*`, or accept it as a deliberate public reference page — but the current state is neither decision, it is an oversight.

---

## 4. Scene system (`components/home/scene/*`) — all LIVE

`SceneProvider` (tier context) · `SceneBoundary` (poster-always wrapper) · `capabilities.ts` (`static→canvas2d→webgpu` ladder, `?sceneTier=` override gated on `NEXT_PUBLIC_SCENE_DEBUG`) · `ChapterProgress.tsx` (**the one** rAF-throttled scroll listener) · `progress.ts` (pure blend model) · `AmbientField` · `GrainOverlay` · `MagneticButton` · `SceneCursor` · `registry.ts` (six chapters).

**Discrepancy worth fixing during HORIZ-2:** `registry.ts` declares six chapters (`wallet, evidence, matcha, apply, employers, start`) and `CHAPTER_DOM_IDS` lists six ids, but the live homepage renders no `#start` anchor — that chapter is silently skipped by the driver.

---

## 5. Public trust surfaces

| Surface | Status | Notes |
| --- | --- | --- |
| `/verify/[npi]` | **LIVE**, public, no auth | Two-half `VerdictSplit` (integrity / issuer) + revocation pinned `unknown` — "not checked on this public snapshot". Real backend fetches (`/api/passport/npi/:npi`, acceptance-history, `revalidate: 60`); null passport → `NotFound`, never fabricated. NPPES self-report chips are `mz-chip-unknown`, not green. |
| `/review/[entityId]` | **LIVE route, action-gated** | `lib/auth/roles.ts:99` classes `/review/*` as a public packet link. Gating is at the *action* layer: `canPersistActions` from `useRoleContext()` disables every mutation; the backend enforces 401/403 independently. |
| `/evidence-network` | **LIVE**, public | Static concept map (`EvidenceModelMap`, pure SVG, `role="img"`). No person data. Carries the explicit retirement notice. |
| `/clinician/graph` | **OBSOLETE/REDIRECT** | `redirect('/trust')`. |
| `/employers` | **LIVE**, public | Type-2 NPI claim flow + three value cards. Note: a doc comment at `lib/auth/roles.ts:37` implies `/employers/*` is VERIFIER-gated; **no such pattern exists in `PROTECTED_ROUTES`**, so it passes through unauthenticated. The page is *meant* to be public; the comment is misleading and should be corrected. |

**The synthetic roster is retired from view but still in the tree.** `components/career-graph/data.ts` retains 14 `Dr. …` fixtures; `CareerGraph.tsx` has **zero non-test importers**. Status: IMPLEMENTED-NOT-MOUNTED. It cannot render today, but it remains a loaded gun for anyone who greps for a graph component to reuse. GRAPH-8 should delete it or move it under a test fixture path.

---

## 6. ACT-1 activation — the backend is real, the HTTP surface is not

The plan states the ACT-1.1–1.4 loop "has landed on `main`". Precisely:

| Sub-wave | Service code | HTTP route | Web UI |
| --- | --- | --- | --- |
| ACT-1.1 decision context | `lib/applications/decisionContext.ts`, `components/verifier/DecisionContext.tsx` | n/a (web-side derivation) | **Yes** — `/employer/decision/[applicationId]`, AUTH-ONLY |
| ACT-1.2 acceptance ↔ packet | `services/entity/packetAcceptanceGuard.ts`, `acceptanceSourceSnapshot.ts` | **Yes** — `POST /api/employer-review/:entityId/accept` | **No** — `ReviewClient` posts only `{ acceptanceScope: 'pilot' }`; it never sends `applicationId` or `packetHash`, so the linked branch is unreachable from the UI |
| ACT-1.3 requirement ledger | `services/activation/activationRequirementService.ts`, `requirementLifecycle.ts`, model `ActivationRequirement` | **None** | **No** |
| ACT-1.4 start-ready / started | `services/activation/startEventService.ts`, `startState.ts`, events `START_READY/RECORDED/CANCELLED` | **None** | **No** |

**Verified:** nothing under `apps/api/backend/src/routes` or `apps/web` imports `services/activation` — the only importer is one sibling file. ACT-1.3 and ACT-1.4 are **IMPLEMENTED-NOT-MOUNTED**: tested service layers with no way to call them.

There is an adjacent, *different* start path that **is** live: `POST /api/employer-review/:entityId/confirm-start`, driven by `ReviewClient`. It writes an attestation gated on an `ACCEPTED` acceptance, does **not** go through `startEventService`, and emits **no** `START_*` audit event. **Two unconnected start concepts exist in the tree.** ACT-7.4 must reconcile them, not add a third.

---

## 7. Wave ↔ reality reconciliation

| Plan wave | Actual state at `86151ad8e` | Correct next action |
| --- | --- | --- |
| **Wave 0** BASE-0.1/0.2/0.4 | This document. BASE-0.4 already satisfied — the stale "graph moves to /evidence-network" comments were removed in `#791`; surviving mentions are honest. | BASE-0.3 (visual/a11y baselines) is **largely already covered** by `scene-degradation`, `homepage-motion`, `scrub-headings`, `visual-density` specs + the axe WCAG CI job. Do not rebuild it; extend if a gap is proven. |
| **Wave 1** NUM-1.1–1.6 | **NUM-1.1–1.4 SHIPPED** (`#792`): `components/motion/EvidenceMetric.tsx` primitive with four source classes, `ProblemStatBand`/`MetricStrip` converted, and the unsourced 34% bar **deleted** (recast as evidence-coverage, no day count, no implied SLA). | Only **NUM-1.5** (dynamic numbers on live product surfaces) and **NUM-1.6** (metric analytics) remain. |
| **Wave 2** HORIZ-2.1–2.6 | Engine + harness shipped (`#780`); **not mounted**; `StickyProductStory` still owns a competing scroll model. | **Unclaimed — the highest-value next build.** Mount + migrate, per §3.1/§3.2. |
| **Wave 3** ROLO-3.1–3.5 | Rolodex 3D shipped (`#779`, `rolodex-leaves.test.ts` locks ≥2 leaves). Residual = run it *inside* the rail. | Serial after Wave 2. §3.2 is the exact target. |
| **Wave 4** VIS-4.1–4.5 | Scene runtime/primitives/chapter driver (`#770/#771/#774`), WebGPU Graphene hero (`#777`), liquid menu (`#763`), degradation matrix (`#787`) all shipped. **Hero portion superseded by HERO-RESET-1 (`#791`).** | Remaining: per-chapter scene reaction (SHD-3.3 residual), VIS-4.5 contrast/visual regression. |
| **Wave 5** PROOF-5.1–5.5 | `ProofPacketInspector` exists, DEV-ONLY (§3.3). | PROOF-5.1 is a mount. Resolve the `/design/*` guard question first. |
| **Wave 6** EMP-6.1–6.7 | `/employers` = NPI claim + 3 cards (§5). Backend review/packet/queue surface is deep and real. | Unclaimed. EMP-6.3+ **blocked on the opportunity-model product decision.** |
| **Wave 7** ACT-7.1–7.6 | See §6 — 1.1 has UI, 1.2 is route-only, **1.3/1.4 have no HTTP surface at all**. | ACT-7.3/7.4 must *build the route layer*, not just a UI. Reconcile the two start paths. |
| **Wave 8** GRAPH-8.1–8.5 | `#748` open and 44 commits behind. Synthetic roster dormant but present (§5). | ADR first (GRAPH-8.1); **blocked on the public-verification-scope product decision.** |
| **Wave 9–11** | Not started. | Per plan. |

---

## 8. BASE-0.2 — open PR triage

| PR | Age / drift | Verdict | Rationale |
| --- | --- | --- | --- |
| **#748** G4 bidirectional relationships | 2026-07-18, **44 behind** | **REBASE, then hold for ADR** | Real feature over a real projection runtime. Its endpoint is public-by-NPI; the plan (BASE-0.2, GRAPH-8.2) requires an authorization/consent review before merge. Do not merge on CI-green alone. |
| **#636** NPPES licensure + Doximity | 2026-07-13, **148 behind** | **REBASE and merge** | Self-contained, honest by construction (self-reported label, never a status). Touches profile surfaces the reskins have since moved — expect conflicts; re-verify the three host-validation sync points survive the rebase. |
| **#543** student / no-NPI lane | 2026-07-05, **231 behind** | **EXTRACT or CLOSE** | Predates the identity-tier ladder and the signup gate. Rebasing 231 commits of onboarding drift is likely more work than re-cutting the lane against today's gate. Decide deliberately; do not leave it rotting. |
| **#506** backend transport-auth for `/api/me/role` | 2026-07-03 | **HOLD (correctly)** | Title says DO-NOT-MERGE pending backend env rollout. Still true. Revisit with the Clerk enforce flip. |
| **#465** ops-engine live (+3011 lines) | 2026-06-28, **305 behind** | **CLOSE** | Three thousand lines, ten months of drift, and the Ops Center has moved to `/admin/platform` since. Re-cut from the current roster/ledger if still wanted. |
| **#443** open-PR triage matrix (docs) | 2026-05-30 | **CLOSE — superseded** | This document replaces it. |
| Dependabot (#794, #582, #581, #580, #577, #576, #575, #574, #573) | — | **Batch separately** | Not wave work. `#581` (vitest 1.6→4.1) is a real migration, not a bump — treat as its own task. |

---

## 9. Lane claim (anti-collision protocol)

Because parallel lanes work from the same plan documents, a lane **must** claim its bundle here before writing code, and re-check `git log origin/main` immediately before merging.

| Bundle | Status | Claimed |
| --- | --- | --- |
| BASE-0.1 / 0.2 / 0.4 | this PR | Wave-0 lane |
| HORIZ-2.1 → 2.6 | **UNCLAIMED — next up** | — |
| NUM-1.5 / 1.6 | unclaimed | — |
| EMP-6.1 / 6.2 | unclaimed (6.3+ blocked on product decision) | — |

---

## 10. Open product decisions (only the founder can settle these)

1. **Opportunity model** — employer-created roles vs ATS integration vs concierge import. **Blocks EMP-6.3+.**
2. **Public-verification scope** — NPI-only snapshot, consent-link richer view, or split public/employer detail. **Blocks Wave 8 and the `#748` merge.**
3. **Pilot metric threshold** — minimum cohort/window before any "faster start" claim may appear publicly. Until set, only source-backed readiness and requirement progress may render.

Rollout order is already answered by the plan itself: metrics → horizontal/Rolodex → employer activation. Metrics are now done.
