# VitalCV Design Backlog

Ranked, evidenced findings from production observation. Maintained by the Design Scout;
the Design Implementer takes the top unblocked item, one at a time.

Audit basis: production `vitalcv.com`, 2026-08-07, desktop 1440×900 + iPhone 14
(390pt) via Playwright. Evidence archives live under `docs/design/design-lab/<ID>/`
once a wave ships; pre-wave evidence is summarized inline.

Open-PR collision map at audit time: #1079 owns homepage composition/copy
(`app/page.tsx`, `CareerLoopHome.tsx`); #1081 owns `/profile/activate` (B1);
#1103 touches `app/get-ready/GetReadySurface.tsx` + onboarding NPI handoff;
#1109 owns WorkspaceNav/journey-header nesting.

---

## DL-001 — Floating feedback chip blocks taps on mobile — **SELECTED (wave 1)**

- **Route/surface:** global fixed chrome (`components/feedback/FeedbackButton.tsx`), measured on `/onboarding`
- **Problem:** the labeled "Feedback" chip (`fixed bottom-6 right-6`, ~109×44px) occupies
  ~28% of a 390pt viewport's width. Centered interactive content that scrolls through the
  bottom-right zone is covered; measured on `/onboarding`, the "Sign in" link
  ("Already have a workspace?") sits fully under the chip at its minimal-scroll resting
  position — `document.elementFromPoint` at the link's center resolves to the chip, so
  the tap opens the feedback reporter instead of sign-in.
- **Evidence:** Playwright measurement 2026-08-07 — sign-in rect x256.8 y606.1 41.7×17 vs
  chip rect x256.6 y596 109.4×44, `intersects: true`, `signinClickBlocked: true`
  (iPhone 14 viewport). Screenshot `verify-onboarding-mobile-signin.png` (archived with wave evidence).
- **Persona:** clinician, mobile, returning (sign-in intent) — the exact user we most
  want not to lose at the door.
- **Severity:** P0 (usability blocker on the primary clinician entry surface)
- **Strategic impact:** entry-funnel trust + effort; premium quality (chrome should never
  sit on top of a primary action)
- **Recommended direction:** shrink the permanent chrome footprint on small viewports —
  icon-only 44×44 variant (keeps CD-15 ≥44px tap floor, keeps the CD-12 float shadow,
  keeps `aria-label="Send feedback"`), labeled chip from `md:` up. At 390pt this moves the
  chip's left edge from x≈257 to x≈322, clearing the measured link (right edge ≈298).
- **Size:** XS (one component, one test)
- **Dependencies:** none
- **Collision risk:** none — no open PR touches `components/feedback/`

## DL-002 — `/onboarding` sells a "career wallet" and "readiness packet" (retired vocabulary)

- **Route/surface:** `/onboarding` right rail (source: `app/get-ready/GetReadySurface.tsx`)
- **Problem:** the rail headlines "Your free, source-backed career wallet" and promises an
  "employer-ready readiness packet". "Wallet" and "packet" are retire-tier customer-facing
  vocabulary under the founder-approved 2026-08-04 category strategy; the canonical noun
  is *your VitalCV profile*. New clinicians meet two internal nouns before their first value moment.
- **Evidence:** production page text capture 2026-08-07 (`onboarding-desktop-full.png`,
  `onboarding-mobile-full.png`).
- **Persona:** clinician, first visit
- **Severity:** P1 · **Strategic impact:** comprehension + category convergence
- **Recommended direction:** copy-only pass replacing wallet/packet with profile
  vocabulary per the strategy brief; no layout change.
- **Size:** XS · **Dependencies:** strategy docs installed (`docs/strategy/`)
- **Collision risk:** **BLOCKED — WAIT.** #1103 touches `GetReadySurface.tsx`; coordinate
  or take after it lands.

## DL-003 — Homepage journey rail exposes machinery labels ("Packet", "Their decision")

- **Route/surface:** `/` journey rail + section 03
- **Problem:** the six-stage rail names stages `NPI · Profile · Opportunity · Apply ·
  Packet · Review`, with placeholder cells "The packet" and "Their decision". "Packet" is
  internal mechanism vocabulary; "Their decision" makes the employer's power the resting
  emotional endpoint of the clinician's own homepage.
- **Evidence:** `home-desktop-hero.png`, resolved-state text capture 2026-08-07.
- **Persona:** clinician, first visit · **Severity:** P1 · **Strategic impact:** comprehension, category convergence
- **Recommended direction:** rail vocabulary converges on the four-concept architecture
  (profile / jobs / apply) — e.g. `NPI · Profile · Match · Apply · Share · Review` with
  clinician-benefit cell copy. Hero/section copy is #1079's contract.
- **Size:** S · **Collision risk:** **BLOCKED — WAIT.** #1079 owns homepage composition;
  recommendation handed to that wave rather than a competing implementation.

## DL-004 — Cinematic interstitials outrank utility in the homepage story

- **Route/surface:** `/` sections 01–04
- **Problem:** full-viewport set-pieces ("A number becomes a career.") sit between the
  NPI action and the product's proof; the five-second test currently rewards mood over
  the four answers a clinician needs (profile from NPI, real roles, apply with it, reuse it).
- **Evidence:** scene-by-scene captures (`verify-home-scene-01..04.png`), 2026-08-07.
- **Persona:** clinician, first visit · **Severity:** P2 · **Strategic impact:** comprehension, conversion
- **Recommended direction:** #1079 already carries the copy convergence; after it lands,
  Scout re-audits whether scene pacing still buries utility (motion-has-a-job test).
- **Collision risk:** **BLOCKED — WAIT** (#1079).

## DL-005 — `/employers` reading load before the first action

- **Route/surface:** `/employers`
- **Problem:** the doorway now leads with outcome (good, post-#1086) but the workflow
  section runs six long text steps with near-uniform typographic weight before the
  size-tiered doors; recruiters scan, and the page currently rewards reading.
- **Evidence:** `employers-desktop.png`, `employers-mobile.png`, full text capture 2026-08-07.
- **Persona:** employer (recruiter / MSP) · **Severity:** P2 · **Strategic impact:** employer conversion, premium quality
- **Recommended direction:** hierarchy pass only — tighten step copy to one scannable
  line + one qualifier, keep the truth qualifiers; no strategy change.
- **Size:** S · **Collision risk:** low (no open PR owns `/employers` today) — candidate wave 2/3.

## DL-006 — Homepage rail placeholder cells are empty chrome before any NPI exists

- **Route/surface:** `/` journey rail (anonymous state)
- **Problem:** before a visitor types anything, four dashed placeholder cells
  ("Your profile", "A match", "You choose", "The packet", "Their decision") occupy the
  prime first-scroll band as empty machinery — the anonymous state spends its best real
  estate on what the visitor doesn't have yet.
- **Evidence:** `home-desktop-hero.png`, `home-mobile-hero.png` 2026-08-07.
- **Persona:** clinician, first visit · **Severity:** P2 · **Strategic impact:** comprehension, effort
- **Recommended direction:** fold into #1079's homepage contract (anonymous rail could
  carry benefit copy instead of placeholder nouns).
- **Collision risk:** **BLOCKED — WAIT** (#1079).

## DL-007 — Start Agent activity language has no designed surface yet (standing stream)

- **Route/surface:** future — activation/readiness surfaces (B1 `/profile/activate`, readiness planner)
- **Problem:** as the Readiness Planner (first agent capability per the Easy Button
  canon) lands, there is no designed primitive set for *doing / waiting / needs you /
  needs employer / done*. Default risk: chat UI or raw checklists.
- **Evidence:** Easy Button canon (2026-08-05 founder decisions); B1 PR #1081 in flight.
- **Persona:** clinician, activated · **Severity:** P1 (strategically) · **Strategic impact:** differentiation — this is where VitalCV looks unlike healthcare SaaS
- **Recommended direction:** design exploration doc + component primitives (agent plan,
  activity receipt, consent queue, blocker ownership, change detected) staged against
  B1's real states; no implementation until B1 lands and A0 semantics exist.
- **Size:** M (exploration first) · **Collision risk:** high with #1081 until merged — design doc only for now.

---

## Scorecard (baseline 2026-08-07 — every score tied to today's captures)

| Dimension | Score | Evidence anchor |
| --- | --- | --- |
| Comprehension | 6 | Hero states profile-from-NPI plainly; rail nouns (Packet/Their decision) and cinematic interstitials still tax first-read (DL-003/004) |
| Clinician ease | 7 | NPI above fold, free/no-account stated; illustrative example is honest (labeled fictional) |
| Employer ease | 6 | Outcome-first doorway post-#1086; six-step text wall before doors (DL-005) |
| Next-step clarity | 7 | One primary action per surface on `/` and `/onboarding` |
| Visual hierarchy | 6 | Strong hero; uniform-weight body walls on `/employers` |
| Design coherence | 7 | Paper/ink system holds across `/`, `/onboarding`, `/employers` |
| Differentiation | 6 | Journey rail + source-attribution feel ownable; interstitial mood pieces read generic-cinematic |
| Trust clarity | 8 | Source/freshness qualifiers present and honest everywhere audited |
| Mobile quality | 5 | DL-001 tap blocker; compositions otherwise sound |
| Interaction/motion | 7 | Scenes reveal correctly on scroll (verified); motion mostly has a job |

Weakest important dimension: **mobile quality** — hence DL-001 as wave 1.
