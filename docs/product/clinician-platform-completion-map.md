# Clinician Career Platform — Phase 1 Completion Matrix

Baseline: origin/main `2622def4c` (2026-07-01). Sources: 4 parallel Explore audits (routes, API/backend, truth scan, duplicates) + direct verification.

## Golden Path status (mission priority order)

| # | Surface | Status | Reality | Gap to close |
|---|---------|--------|---------|--------------|
| 1 | Professional Profile | **BUILT (PR #476)** | `/clinician/profile` rebuilt live: workspace PersonProfile + passport-driven ClinicianProfileSections; self-attested links/resume/work-auth save through existing intake endpoints; completeness from backend; linked from holder home. | Gate + merge #476. |
| 2 | Credential Readiness | **BUILT** | `/holder/readiness` live passport-derived snapshot (PR #468, merged 2026-07-01). Conservative state mapping; only `checked` reads as verified. | Done. |
| 3 | Recognition | **PARTIAL** | Backend models exist (Recognition/Acceptance/Start); recognition events flow through `/api/timeline` projection (RecognitionImpact) + application workflow updates. No dedicated clinician recognition display. | Surface recognition in holder home / timeline UI. |
| 4 | Career Passport | **BUILT** | `/passport` live SSE ingest (NPPES→OIG→PECOS→license), `/passport/[id]` public share, wallet passport view. | Polish only. |
| 5 | Opportunity Center | **BUILT (+detail in PR #477)** | `/holder/opportunities` ← provider ← marketplace backend + MATCHA. PR #477 adds the missing `/holder/opportunities/[id]` role detail (match explanation + apply reuse) and fixes 5 dead `/opportunities/[id]` links. | Gate + merge #477. |
| 6 | Applications | **BUILT** | `/holder/applications` ← real backend proxy, Clerk-gated. | Verify states (Phase 4). |
| 7 | Application Detail | **BUILT** | `/holder/applications/[id]` with timeline + workflow actions. | Verify states (Phase 4). |
| 8 | Career Timeline | **BUILT (staged)** | Workspace cluster (activity/career-map/career-intelligence/professional-growth/network) is already unified by WorkspaceNav (Wave 600) — the missing edge was holder → cluster. `/holder/timeline` (branch feat/holder-career-timeline) resolves the clinician's NPI server-side and lands on `/activity/[npi]`; linked from holder home. | Open PR after #476 merges (stacked). |
| 9 | Wallet | **BUILT** | `/holder` renders WalletPassport + CredentialWallet + TrustStatePanel from real APIs. Fake-data WalletDashboard deleted (PR #474, merged 2026-07-01). ClinicianProfileSections kept and now consumed by the live profile (PR #476). | Done. |
| 10 | Settings | **BUILT (staged)** | `/holder/settings` built on branch feat/holder-settings: Clerk account row + sign-out, identity-binding status, profile link, honest data-&-sharing section (real controls only, no decorative toggles). | Open PR after #476 merges (stacked). |

## Journey stages beyond the 10

| Stage | Status | Notes |
|-------|--------|-------|
| Sign Up / Sign In | BUILT | Clerk `/sign-up`, `/sign-in`. DUPLICATE: `/signup` demo-plan stub — retire or redirect. |
| Verify Identity | PARTIAL | NPI binding via passport ingest works; `/clinician/identity` is a policy stub (gov-ID/IAL2 vendor-gated by doctrine — stays foundation tier). |
| Onboarding | BUILT | `/onboarding` + identity/readiness/fetching/success steps wired to `/api/me/*`. |
| Discover → Apply → Track → Offer | BUILT | opportunities → apply → applications → workflow (accept/decline) all proxy real backend; hiring.ts has offer/start tracking. |
| Share VitalCV | BUILT | `/passport/[id]`, `/p/[slug]`, `/apply/[bundleId]`, packet/export/embed.svg APIs. |
| Return / career moves | PARTIAL | Timeline consolidation (row 8) is the return-loop surface. |

## Truth audit hit list (Phase 5 targets)

| Priority | File | Fake data | Action |
|----------|------|-----------|--------|
| P0 | ~~ReadinessSurface.tsx~~ | fake MACIE MILLER snapshot | FIXED — PR #468 merged |
| P0 | ~~components/clinician/WalletDashboard.tsx~~ | Dr. Sarah Chen, 6 fake credentials, fake trust band/score 72, fake vita events | DELETED — PR #474 merged |
| P1 | app/employer/decision/[applicationId]/page.tsx:5 | MOCK_DECISION_ITEM (NPI 1999999984) | Wire to real application or mark preview explicitly |
| P1 | app/activation/[caseId]/page.tsx | demoCase() ignored caseId param | 404-gated to demo-001 — PR #478 |
| P1 | app/dossier/[receiptId]/page.tsx | demoDossier() ignored receiptId | 404-gated to demo ledger ids — PR #478 |
| P1 | app/inbox/page.tsx | demoInbox() hardcoded | Demo-gate or build real intake |
| P2 | app/api/map/institutions/route.ts | 15 demo institutions w/ fake stats (flagged dataSource:'demo' but consumers ignore flag) | Surface demo flag in consumers |
| P2 | app/clinician/graph/page.tsx | "Dr. Sample" nodes (labeled sample) | Acceptable if labeled; verify labeling |
| P2 | lib/research/publicationFoundation.ts | 3 sample publication candidates (verified:false by design) | Acceptable foundation; verify labeling |
| OK | lib/demo/demo-passport.ts, lib/demo/demoProfiles.ts | gated to demo-clinician entity / demo routes | Keep (honest demo fixtures) |

## Duplicates / dead code (Phase 2 targets)

1. DELETE dead components: WalletDashboard.tsx, ClinicianProfileSections.tsx (+ its test), HolderSubNav.tsx, RoleChecklist.tsx, DailyUtilityLoop.tsx.
2. `/signup` (demo plan stub) vs `/sign-up` (Clerk, real) — redirect /signup → /sign-up.
3. Career triplet: /activity vs /career-intelligence vs /professional-growth — consolidate to one canonical career timeline linked from holder nav.
4. Readiness variants: /holder/readiness (canonical) vs /onboarding/readiness (onboarding-scoped, OK) vs /mobile/native-readiness (check reachability).
5. `_archive/` (~39 wave119 dirs + old verifier/demo/simulation) — already unroutable; leave as archive (deletion = separate janitorial PR, low priority).

## Platform integration reality (Phase 6)

- PersonProfile: backend Prisma model → /api/me/workspaces → ClinicianMobileProvider → holder surfaces. Profile page does NOT yet use it (stub).
- Trust Graph/Evidence/Timeline: @vitalcv/domain-evidence projections, in-memory transforms over passport runtime; APIs exist (/api/evidence, /api/graph, /api/timeline, /api/mobility/readiness).
- MATCHA: real deterministic engine in backend (matchaEngine.ts) with explainable scoring; web proxies live.
- Applications: real Postgres models via marketplace proxy.
- TRUST-PERSIST-1: schema scaffold only (ReceiptCandidate w/ DB CHECK constraints), writer feature-flagged OFF. Largest persistence blocker per completion board.

## Mission wave state (2026-07-01 evening)

Merged: #468 (live readiness), #474 (dead fake-data components + /signup redirect).
Open, CI green, awaiting Codex gate: #475 (/get-ready NPI binding — closes the no-NPI dead end), #476 (live professional profile), #477 (opportunity detail + dead-link fixes), #478 (demo param gates).
Staged stacked branches (PR after #476): feat/holder-career-timeline, feat/holder-settings, feat/holder-ux-states (home retry + contextual application not-found).
Out of clinician scope, untouched: #465 (ops-engine), #466 (Vercel deprecation), employer demo surfaces (decision/review) — flagged for an employer-side wave.
