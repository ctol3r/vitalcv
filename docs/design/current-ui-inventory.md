# VitalCV Frontend Component Inventory — 2026-05-27

Read-only audit of `apps/web` against the planned visual-system upgrade. No code modified; this document captures the current state and prioritizes the upgrade scope.

## Scope of this inventory

| Directory | Surveyed | Notes |
|---|---|---|
| `apps/web/app` | yes | Next 15 App Router; 70+ top-level route directories incl. `_archive/` |
| `apps/web/components` | yes | 60+ sub-directories, 600+ `.tsx` files |
| `apps/web/design-system` | yes | Canonical token + component system shipped in PR-E (#209) |
| `apps/web/styles` | yes | `themes/index.css`, `typography.css` plus globals |
| `apps/web/ui` | yes | Sparse: `animation`, `hooks`, `theme` (not the same as `components/ui`) |
| `apps/web/postcss.config.mjs` | yes | PostCSS pipeline only; **no Tailwind config file exists** in apps/web |
| Tailwind | n/a | Not in use here; styling is **token-driven via design-system CSS variables** + component-level styles. |

## Two parallel design systems exist today

A central finding: there are **two parallel design systems** in `apps/web`, and components reach for whichever is closer in their import tree.

### A. `apps/web/design-system/` (canonical, PR-E #209)

Newer, token-driven, intended canonical surface.

```
apps/web/design-system/
├── components/      Badge, Button, Card, ActionCard, ConfidenceBadge,
│                    ConfidenceTierBadge, EvidenceTable, FindingCard,
│                    FreshnessIndicator, GraphLegend, GraphToolbar,
│                    IdentityField, IdentityFieldsCard, Input,
│                    InvestigationPanel, LaneStateBadge, LaneStateLegend, …
├── tokens/          colors.ts, graph.ts, motion.ts, spacing.ts, typography.ts
├── themes/          dark, light, graphite, midnight (+ types)
├── layouts/         layout primitives
├── patterns/        higher-level composites
├── styles/          CSS variable definitions
└── docs/            catalog + usage docs
```

Used by: newer routes, intelligence-ops surfaces, some passport components.

### B. `apps/web/components/ui/` (shadcn-style, older)

shadcn / Radix-derived primitives that predate the canonical design system.

```
apps/web/components/ui/
├── badge.tsx                 (shadcn Badge)
├── BadgeStatus.tsx
├── StatusBadge.tsx
├── trust-status-badge.tsx
├── claim-badge.tsx
├── skeleton.tsx
├── EmptyState.tsx
└── … (other shadcn primitives)
```

Used by: marketing/home surfaces, older clinician/employer flows, many legacy routes.

**Risk:** A `Badge` import inside the codebase can resolve to either system depending on the path. Visual drift is high. The Wave G "central truth-state chip" must land in **system A** (`design-system/components/`) to converge — that's the recommended target.

## Badge/Chip/Pill proliferation (≥ 30 implementations)

Beyond the two `Badge.tsx` primitives, the codebase has ~30 status-shaped components:

| Component | Path | Purpose |
|---|---|---|
| `LaneStateBadge` | `design-system/components/LaneStateBadge.tsx` | 7 states: verified/pending/access/blocked/contradicted/unknown/info. **Internal type uses "verified"; visible label says "Checked".** Good model. |
| `ConfidenceBadge`, `ConfidenceTierBadge` | `design-system/components/` | Confidence-tier indicator |
| `TrustTierBadge` | `components/proof/TrustTierBadge.tsx` | T1–T4 trust tier (per CLAUDE.md ban: "No status label may be the bare word `Verified`" — this honors it) |
| `VerificationBadge` | `components/passport/VerificationBadge.tsx` | Passport-side verification indicator |
| `LaneHealthBadge` | `components/source-health/LaneHealthBadge.tsx` | Per-lane health snapshot |
| `ExclusionBadge` | `components/psv/ExclusionBadge.tsx` | OIG/LEIE exclusion result |
| `ReceiptVerificationBadge` | `components/employer/ReceiptVerificationBadge.tsx` | Receipt verification on employer side |
| `MonitoringStatusBadge`, `SanctionRiskBadge` | `components/trust-state/` | Ongoing-monitoring states |
| `DecisionBadge` | `components/decision/DecisionBadge.tsx` | Decision outcome label |
| `ReplayIntegrityBadge` | `components/replay-diagnostics/` | Audit replay integrity signal |
| `ReuseSignalBadge` | `components/trust/ReuseSignalBadge.tsx` | Reuse-from-prior-receipt signal |
| `SystemCapacityBadge`, `DeployBadge` | `components/capacity/`, `components/layout/` | Infrastructure signals |
| `BadgeStatus`, `StatusBadge`, `claim-badge`, `trust-status-badge` | `components/ui/` | Multiple shadcn-style overlap |
| `TrustStatusIndicator`, `SystemStatus` | `components/system/`, `components/marketing/` | More infrastructure signals |

**Recommendation:** Wave G introduces **one canonical `TruthStateChip`** in `design-system/components/` that owns the 8 product-state vocabulary (source-backed / temporarily-unavailable / connector-not-live / access-required / institution-review-required / snapshot-only / demo-only / auth-required). Domain-specific badges (TrustTierBadge for T1–T4, ExclusionBadge for OIG outcomes, etc.) continue to exist for their orthogonal axes and over time call into the chip for their inner state visual.

## Passport surface (`apps/web/app/passport/*`)

```
apps/web/app/passport/
├── layout.tsx                          shared chrome
├── page.tsx                            unauthenticated /passport?npi=… view
└── [id]/
    ├── page.tsx                        authenticated /passport/[id]
    └── PassportEntityClient.tsx
```

Passport-domain components (in `components/passport/`):

| Component | Role |
|---|---|
| `ClinicianPassport.tsx` | top-level Passport composite |
| `CredentialPassportLayout.tsx` | layout shell |
| `CredentialStatusCard.tsx` | per-credential status block |
| `PassportTrustPosture.tsx` | trust-posture summary |
| `VerificationArtifacts.tsx` | artifact list / proof links |
| `VerificationBadge.tsx` | status indicator (Wave G will likely retire or refactor) |
| `TrustSummarySection.tsx` | top-of-page truth summary |
| `WhatsNextPanel.tsx` | next-step / "institution review" disclosure surface |
| `PassportShareActions.tsx`, `SharePacketModal.tsx`, `ApplyWithVitalCV.tsx`, `PassportWallet.tsx`, `ResearchPublicationsSection.tsx` | various |

**Wave H scope** (next turn): apply the new `TruthStateChip` to source rows, add the 5-row truth legend, replace skeleton loaders in terminal degraded state with a calm degraded surface, surface the institution-review boundary copy.

## Trust surface (`apps/web/app/trust/*`)

```
apps/web/app/trust/
├── page.tsx              Trust State Register landing
├── doctrine/page.tsx     Trust doctrine / philosophy
├── attribution/page.tsx  Per-field source attribution
├── schema/page.tsx       Knowledge Trust Graph schema
└── graph/page.tsx        Graph visualization
```

Trust-domain components (`components/trust/`, `components/trust-state/`):

| Component | Role |
|---|---|
| `TrustStateRegister.tsx`, `TrustStateCard.tsx` | top-level trust register |
| `TrustRegisterCard.tsx`, `TrustRegisterRow.tsx`, `TrustRegisterLegend.tsx` | per-row trust state |
| `TrustGraphXRay.tsx`, `KnowledgeTrustGraphPanel.tsx` | graph rendering |
| `EvidenceDisclosureCard.tsx`, `ProofDetailsList.tsx` | evidence + proof |
| `SourceCoverageTag.tsx`, `SourceCoverageRow.tsx`, `PassportSourceCoveragePanel.tsx` | source coverage signals |
| `TrustStateView.tsx`, `TrustStateResultCard.tsx` | view-state results |
| `DivergenceSummaryCard.tsx`, `ReuseSignalBadge.tsx` | divergence / reuse |
| `TimeToStartEstimateSummary.tsx` | TTS readout |
| `CopyableDID.tsx`, `TrustRegistryFooter.tsx` | utility |

**Wave K scope** (next turn): `/trust/attribution` becomes a receipt-like register (field / source / retrieval-time / state / review-boundary).

## Auth pages (`apps/web/app/sign-in/*`, `apps/web/app/sign-up/*`)

```
apps/web/app/sign-in/[[...sign-in]]/page.tsx
apps/web/app/sign-up/[[...sign-up]]/page.tsx
```

Auth components (`components/auth/`):

| Component | Role |
|---|---|
| `CreateAccountModal.tsx` | modal account creation entry |
| `RoleContext.tsx` | role-aware auth helpers |
| `AuthButton.tsx` (top-level component) | sign-in/sign-out CTA |

**Wave J scope** (next turn): calm auth-gate disclosure card, no "verify your email to get verified" language.

## Nav / Footer / Layout (`apps/web/components/layout/`)

| Component | Role |
|---|---|
| `RootChrome.tsx` | top-level chrome wrapper |
| `Navbar.tsx` | top navigation |
| `Footer.tsx` | bottom links |
| `Grid.tsx` | layout primitive |
| `DeployBadge.tsx` | small infrastructure badge |

`/app/layout.tsx` mounts the chrome; `/app/HomePageClient.tsx` is the homepage client surface (PR-F #214).

## Skeleton loaders and degraded-state UI

Found:

- `components/ui/skeleton.tsx` — shadcn skeleton primitive
- `components/shell/OpsLoadingScreen.tsx` — full-screen loading
- `components/intelligence-ops/detail-loading.tsx` — section loading
- `components/hero/FunnelLoadingSequence.tsx` — homepage funnel loader

**Wave H concern:** the Passport degraded state currently shows skeleton-style placeholders in some surfaces. The next wave wants to **remove the skeleton feel for terminal degraded states** (i.e., when the system has classified the read as "Source temporarily unavailable", don't keep pretending it's loading — surface the honest degraded copy with a calm visual).

## Banned-phrase scan (production UI)

`rg -g '*.tsx' -g '*.ts' -in 'HIPAA compliant|SOC2 certified|NCQA certified|risk transferred|guaranteed verification|instant credentialing|complete credentialing'` over `apps/web/app` and `apps/web/components`:

| Hit | Path | Status |
|---|---|---|
| "Instant credentialing verification vs weeks of manual paperwork" | `apps/web/app/_archive/wave119/compare/vitalcv-vs-manual-credentialing/page.tsx:20` | **Archived — not live.** `_archive/` routes are dead code. |
| Bare `>Verified<` label | `apps/web/app/_archive/verifier/candidates/page.tsx:91` | **Archived — not live.** |
| `Stat label="Verified"` | `apps/web/app/_archive/wave119/internal/yc/page.tsx:226` | **Archived — not live.** |

**LIVE app (non-archive) is clean of banned phrases.** Confirmed by Browser inventory of `/passport?npi=1699264564` (Wave 22 side-finding): unauthenticated public surface contains zero banned phrases and renders honest "Unavailable / not connected" copy across all four source lanes.

**Recommendation (future wave, low priority):** delete `apps/web/app/_archive/` outright. It's not on any deployed route, but it makes the rg grep noisy and adds confusion for new contributors.

## Inconsistent state pills (the central problem Wave G solves)

Same conceptual state expressed differently across the codebase:

| Concept | Variants seen |
|---|---|
| "Source temporarily unavailable" | `LaneStateBadge[unknown]` ("Not checked"), `LaneHealthBadge`-degraded, raw `<span>Unavailable</span>` in passport rows, `MonitoringStatusBadge`-stale, "Try again in a moment" copy in degraded shell |
| "Connector not live / not connected" | hand-rolled spans in `/trust/attribution`, `LaneHealthBadge`-not-connected, `SourceCoverageRow` empty state, `/passport` honest copy |
| "Access required" | `LaneStateBadge[access]`, `AuthButton` redirect interstitial, sign-in disclosure on `/sign-in`, 403 page copy |
| "Institution review required" | `WhatsNextPanel` copy, employer review pages, decision-routing surfaces |
| "Snapshot / demo only" | `OpsLoadingScreen` legacy text, demo-mode banners, `/admin/demo-reset`, scattered `recordedBy:'demo'` callouts |

This is the **#1 visual debt** in the app. Wave G fixes it by introducing a single canonical chip with the 8-state vocabulary.

## Routes most ready for visual upgrade (Wave H–K targets)

1. **`/passport?npi=…` (unauthenticated)** — Wave H. The hottest surface; users hit this without auth. Already clean of banned phrases; needs the new chip family + calm degraded layout.
2. **`/passport/[id]` (authenticated)** — Wave H follow-on. After deploy validation by SSE smoke.
3. **`/` (homepage)** — Wave I. NPI-first hero + 4 role doors.
4. **`/sign-in`, `/sign-up`** — Wave J. Calm disclosure + no false promises.
5. **`/status`** — Wave K. Connector Matrix; receipt-style infrastructure document.
6. **`/trust/attribution`** — Wave K. Per-field receipt-style register.
7. **`/trust`** (Trust State Register landing) — could be Wave K's bonus.
8. **`/contact`** (Pilot Intake) — already disciplined; might just adopt the new chip vocabulary for source-health signals.
9. **`/employers`, `/for/*` persona landing pages** — adopt chip family + footer trust row.
10. **`/pricing`** — small cleanup; per-plan CTAs already disciplined.

## Top 10 implementation targets (this batch)

In recommended order:

1. **`design-system/components/TruthStateChip.tsx`** — the canonical chip. 8 states. (Wave G — this turn.)
2. **`design-system/components/TruthStateChip.stories.tsx`** (or a route stub) — for visual review. (Wave G — this turn.)
3. **`design-system/components/TruthStateLegend.tsx`** — the 5-row legend used on Passport and other surfaces. (Wave G or H.)
4. **`apps/web/app/passport/page.tsx`** + Passport source row components — adopt chips. (Wave H.)
5. **`components/passport/CredentialStatusCard.tsx`**, **`components/passport/PassportTrustPosture.tsx`** — adopt chips, remove ad-hoc state spans. (Wave H.)
6. **`apps/web/app/page.tsx`** + **`HomePageClient.tsx`** — NPI-first hero + 4 role doors. (Wave I.)
7. **`apps/web/app/sign-in/[[...sign-in]]/page.tsx`**, **`apps/web/app/sign-up/[[...sign-up]]/page.tsx`** — disclosure card. (Wave J.)
8. **`apps/web/app/status/page.tsx`** — Connector Matrix receipt-document layout. (Wave K.)
9. **`apps/web/app/trust/attribution/page.tsx`** — Trust Attribution receipt-document layout. (Wave K.)
10. **Retire / refactor legacy badges** in favor of the canonical chip — `components/ui/StatusBadge.tsx`, `components/ui/BadgeStatus.tsx`, `components/ui/trust-status-badge.tsx`, `components/ui/claim-badge.tsx`, several domain badges. Long tail; not blocking.

## Risky duplicated patterns to consolidate

| Pattern | Where | Risk |
|---|---|---|
| Two `Badge` primitives in active use | `design-system/components/Badge.tsx` AND `components/ui/badge.tsx` | Visual drift. Wave G chip lives in design-system; future PR collapses `components/ui/badge.tsx` callers onto it. |
| Hand-rolled "Unavailable / Not connected" `<span>`s | Passport rows, Trust Attribution rows, Source Coverage panels | Inconsistent voice. Wave H/K replaces with chip + standardized copy. |
| Multiple skeleton loaders | `ui/skeleton.tsx`, `OpsLoadingScreen.tsx`, `detail-loading.tsx`, `FunnelLoadingSequence.tsx` | OK for transient loading; **not OK for terminal degraded state** (Wave H removes skeleton in terminal state). |
| `_archive/` dead routes | `apps/web/app/_archive/**` | Carries legacy banned phrases ("Verified", "instant credentialing") that show up in grep scans. Not live but should be deleted in a sweep wave. |
| Per-domain badges duplicating LaneStateBadge semantics | `VerificationBadge`, `DecisionBadge`, etc. | Long-tail cleanup; not Phase 1 scope. |

## Implementation complexity per wave

| Wave | Estimated complexity | Risk | Notes |
|---|---|---|---|
| G — Truth-state chip + tokens | **Low** (1 component + 8 states + tests + 1 docs) | Low | Foundational; touches no existing routes. |
| H — Passport degraded upgrade | **Medium** | Low–Medium | Multiple components adopt chip; copy refactor; preserve all truth invariants. |
| I — Homepage NPI-first | **Medium** | Low | Reorganizes hero; no truth-state code path. |
| J — Sign-in/sign-up upgrade | **Low–Medium** | Low | Pure presentation; no Clerk-config changes. |
| K — `/status` + `/trust/attribution` receipt-like | **Medium** | Low | Layout refactor; new disclosure copy; no backend touched. |

## Phase 1 UI upgrade scope (recommended)

**Phase 1 = Waves G, H, J.** That's: canonical chip + Passport (the hottest unauthenticated surface) + auth pages (where the SSE-smoke gate currently lands users).

Phase 2 = Wave I (homepage) + Wave K (status + attribution). These are higher-traffic but lower-stakes for truth-state invariants.

Phase 3 = legacy badge sweep + `_archive/` deletion.

## Recommended first code wave

**Wave G — `TruthStateChip` + supporting docs + tests.** Single component, no route mutations, lands as the foundation every subsequent UI wave will import. This turn ships exactly that.

## Audit trail

- Audit date: 2026-05-27
- Apps surveyed at HEAD of `wave/passport-deployment-evidence-repair` (working branch); cross-referenced against `main` (`801100c7f`) — no structural difference relevant to this inventory.
- Read-only audit; no code modified.
