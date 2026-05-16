# W2-PR3D - Clinician Workflow Map

**Wave:** W2-PR3D - Workflow + Product Coherence
**Date:** 2026-05-08
**Status:** Docs-only. Read-only investigation of clinician-facing routes. No product code changed.
**Risk class:** SAFE.

## Mission

Map every clinician-facing route in `apps/web/app/`, identify the canonical entry, list dead ends with file:line evidence, and surface readiness explainability gaps. Companion to `w2-pr3d-product-coherence-review.md`.

## Route inventory

### Onboarding

| Route | File | Status | Forward CTA |
|---|---|---|---|
| `/onboarding` | `apps/web/app/onboarding/page.tsx:1-67` | Foundation copy. Renders `buildOnboardingFoundationPlan()` with six milestone summaries. | None. |
| `/onboarding/identity` | `apps/web/app/onboarding/identity/page.tsx:4` | `redirect('/')` | None. Cannot be reached. |
| `/onboarding/fetching` | `apps/web/app/onboarding/fetching/page.tsx:4` | `redirect('/')` | None. Cannot be reached. |
| `/onboarding/readiness` | `apps/web/app/onboarding/readiness/page.tsx:4` | `redirect('/')` | None. Cannot be reached. |
| `/onboarding/success` | `apps/web/app/onboarding/success/page.tsx:4` | `redirect('/')` | None. Cannot be reached. |
| `/clinician/onboarding` | `apps/web/app/clinician/onboarding/page.tsx:1-92` | User-facing six-step guide. | "Open profile" → `/clinician/profile` (lines 77-89); "Import from existing sources" → `/clinician/import` (lines 77-89). |

**Canonical entry:** `/clinician/onboarding`. The `/onboarding/*` family is foundation-only; `/onboarding/page.tsx` advertises a chain whose four child routes redirect away.

### Clinician hub

| Route | File | What the user sees | Action wiring |
|---|---|---|---|
| `/clinician/profile` | `apps/web/app/clinician/profile/page.tsx` | Read-only profile shell. Completion summary hard-coded `0/0` (lines 136-138); inputs `readOnly` (line 208); explicit disclaimer "This is the foundation shell. Editing flow, source-backed import wiring, and verification gating ship in subsequent waves" (line 226). | None. |
| `/clinician/profile-layers` | `apps/web/app/clinician/profile-layers/page.tsx` | Foundation documentation page describing the layered profile model. | None. Informational only. |
| `/holder/home` | `apps/web/app/holder/home/page.tsx:1-11` (renders `ClinicianHomeSurface`) | Operational clinician workspace: primary-action banner, readiness display, blockers list, recent-changes feed, proof-of-progress metrics, quick-action grid. | Real `href`s: `primaryAction.href` (lines 241-280), blocker rows (lines 346-366), quick actions to `/holder/readiness`, `/holder/opportunities`, `/holder/applications` (line 470). |
| `/holder/readiness` | `apps/web/app/holder/readiness/ReadinessSurface.tsx` | Lane state log + limitations. | Backward link to `/holder/home` (line 96). No forward action queue. |
| `/clinician/identity` | `apps/web/app/clinician/identity/page.tsx` | Identity scaffold. | None known to be wired. |
| `/clinician/graph` | `apps/web/app/clinician/graph/page.tsx` | Knowledge graph view. | None. |
| `/clinician/research` | `apps/web/app/clinician/research/page.tsx` | Research surface. | None. |
| `/clinician/import` | `apps/web/app/clinician/import/page.tsx:19-71` | Card grid: CV upload, document upload, PubMed, LinkedIn, Doximity, CSV/roster, export bundle, shareable passport. Each card explicitly marked entry-point or planned (line 132: "Import entries may be planned or entry-only. Imported or uploaded data is not verified until source-backed evidence is attached."). | None. No card wired. |
| `/clinician/mobile-capture` | `apps/web/app/clinician/mobile-capture/page.tsx:30` | "Not enabled yet." | None. |
| `/clinician/device-security` | `apps/web/app/clinician/device-security/page.tsx:28` | "Planned device-level control." | None. |
| `/mobile/native-readiness` | `apps/web/app/mobile/native-readiness/page.tsx:30` | "Planned foundations." | None. |

### Passport

| Route | File | What the user sees | Action wiring |
|---|---|---|---|
| `/passport` | `apps/web/app/passport/page.tsx` | Passport entry. Readiness score (lines 671-712) with confidence label and tier-upgrade prompt. NPI lookup form. | "View full passport" and "View as employer" buttons in `PassportEntityClient`; entry form posts NPI → `/passport?npi={npi}`. |
| `/passport/[id]` | `apps/web/app/passport/[id]/page.tsx`, `PassportEntityClient.tsx` | Per-entity passport. | `buildPassportEntityHref` (line 719) and `buildEmployerReviewHref` (line 724) resolve to `/passport/[id]` and `/review/[entityId]`. |

## Linear flow chain (intended vs actual)

**Intended (from `/onboarding/page.tsx` milestone copy):**

```
sign-up → /onboarding/identity → /onboarding/fetching → /onboarding/readiness → /onboarding/success → ?
```

**Actual:**

```
/onboarding              → static milestone copy, no CTA
/onboarding/identity     → redirect('/')
/onboarding/fetching     → redirect('/')
/onboarding/readiness    → redirect('/')
/onboarding/success      → redirect('/')

/clinician/onboarding    → "Open profile" → /clinician/profile (read-only shell, no edit flow)
                       └─ "Import from existing sources" → /clinician/import (no card wired)
```

The advertised chain is unreachable. The functional path is `/clinician/onboarding → (read-only shell or unwired card grid)`. Neither path hands off to `/passport` or `/holder/home`.

## Dead-end register (clinician side)

| ID | Surface | Evidence | Severity | Required alignment |
|---|---|---|---|---|
| C-DE-1 | `/onboarding/{identity,fetching,readiness,success}` | All four files: `export default () => redirect('/')` (line 4 of each). | P0 | Replace with real step pages or delete and update `/onboarding/page.tsx` to point to `/clinician/onboarding`. |
| C-DE-2 | `/clinician/profile` from "Open profile" CTA | Read-only shell with `0/0` completion summary (lines 136-138, 208, 226). | P0 | Either wire profile editing or change the CTA text from "Open profile" to "Open profile (read-only foundation)" until editing ships. |
| C-DE-3 | `KnowledgeInboxPanel` "Dismiss" and "Add as profile context" buttons | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx:123-135` — no `href`, no `onClick` handler bound. | P0 | Either bind handlers and route, or render the buttons disabled with explanatory copy. |
| C-DE-4 | `/clinician/import` cards | All eight cards (lines 19-71) marked entry-point or planned; `Import entries may be planned or entry-only` (line 132). | P1 | Hide unwired cards behind a feature flag or label them "Planned, not yet available." |
| C-DE-5 | `/clinician/mobile-capture`, `/clinician/device-security`, `/mobile/native-readiness` | Marked planned; no inbound link from `/holder/home` or `/clinician/onboarding`. | P2 | Hide from sitemap until activated. |
| C-DE-6 | Onboarding → passport handoff | No link from `/clinician/onboarding` or `/clinician/profile` to `/passport`. | P1 | Add an explicit "View your passport at …" hand-off card on a successful onboarding submit. |
| C-DE-7 | Canonical home discoverability | `/holder/home` has the action wiring; `/clinician/profile` is the named profile but is a shell. No global nav puts `/holder/home` as the clinician home. | P1 | Either rename `/holder/home` to `/clinician/home` for consistency, or document the split. |

## Readiness explainability gaps

The clinician sees a readiness score in two places. Neither breaks down what is driving the score.

| Surface | File | What is shown | What is missing |
|---|---|---|---|
| Passport readiness display | `apps/web/app/passport/page.tsx:671-712` | Score badge with confidence label (e.g., "Very confident") + tier-upgrade prompt below T2. | No per-lane breakdown ("Identity LANE: checked", "Sanctions LANE: clear", "Licensure LANE: review_required"). No prioritization of which gap to fill first. |
| Clinician home momentum block | `apps/web/components/mobile/ClinicianHomeSurface.tsx:283-315` | Momentum descriptor + readiness link to `/holder/readiness`. | Same as above. The descriptor is qualitative; the underlying lane states are not surfaced. |

The trust-state machine exposes two readiness layers that are *never* shown to the clinician:

- `ReadinessState` (`packages/trust-state/sourceCoverage.ts:689`): `CHECKING | PARTIAL | DECISION_GRADE | BLOCKED`. Hard-block if any launch-spine source is `reviewRequired` or `unavailable`. Used internally to gate accept/start flows; never rendered.
- `CalibratedDecisionState` (`apps/api/backend/src/services/decision/confidenceEngine.ts:23`): `READY_CONFIDENT | READY_UNCERTAIN | BLOCKED_CONFIDENT | BLOCKED_UNCERTAIN | PENDING`. Modulates by confidence inputs (evidenceStrength, freshnessScore, issuerTrustLevel, outcomeHistoryStrength). The user sees the modulated state, not the inputs.

Result: a clinician seeing "Blocked — Confident" cannot tell whether the cause is a hard exclusion (e.g., OIG result) or a stale license freshness window. The remediation differs by cause; the UI does not differentiate.

## Inbox / next-step coherence (clinician side)

| Surface | Audience | Listed items | Item destination |
|---|---|---|---|
| `KnowledgeInboxPanel` | Clinician | Classification suggestions (provenance, confidence, suggested mapping). `nextAction` is rendered as text (line 121). | None. Buttons unwired. |
| `ClinicianHomeSurface.primaryAction` | Clinician | One primary action (resume path, blocker, opportunity). | `data.recommendedAction.href` (real `<Link>`). |
| `ClinicianHomeSurface.blockers` | Clinician | Blocker rows. | Real `href`s (lines 346-366). |
| `clinician/NextBestAction.tsx` | Clinician (mobile) | Title, description, action label. | `action.onClick` callback only (line 30). No `href`. |
| `WhatsNextPanel` | Clinician (post-ingest) | Action suggestions. | Unverified; likely text-only or links back to `/holder/readiness` only. |
| `DecisionCard` / `DecisionQueue` | Clinician/employer | Recommended actions with priority, confidence, drivers. | Callback-only ("Execute Recommendation", "Defer Signal"). No `href`. |

Five surfaces ostensibly tell the clinician "do this next." Two are wired (`ClinicianHomeSurface.primaryAction` and `blockers`); three are not. The user is trained that "do this next" is sometimes a real button and sometimes a text-only sign post.

## Confusion patterns specific to the clinician

1. **"Open profile" lands a user on a read-only shell.** The button label promises capability the destination does not have.
2. **Three potential clinician homes.** `/clinician/profile`, `/clinician/profile-layers`, and `/holder/home` all read like a home; only `/holder/home` is operational.
3. **The advertised onboarding chain is broken.** `/onboarding/page.tsx` describes a milestone path the redirected child pages cannot fulfill.
4. **Readiness score with no lane breakdown.** The clinician sees the number, not the gaps that move the number.
5. **Inbox shows "next action" as a text string.** No button click resolves it.

## Out of scope

- No edits to clinician routes.
- No copy rewrites; PR3C language changes are assumed.
- Mobile capture, device security, and native readiness are flagged but not specified.

## See also

- `w2-pr3d-product-coherence-review.md`
- `w2-pr3d-workflow-fragmentation-register.md`
