# VitalCV Design Backlog

Ranked, evidenced findings from production observation. Maintained by the Design Scout;
the Design Implementer takes the top unblocked item, one at a time.

Audit basis: production `vitalcv.com`, 2026-08-07, desktop 1440×900 + iPhone 14
(390pt) via Playwright. Evidence archives live under `docs/design/design-lab/<ID>/`
once a wave ships; pre-wave evidence is summarized inline.

Open-PR collision map, **refreshed 2026-08-07 after the Tier-S closure (#1127) closed
194 PRs**: #1079 still owns homepage composition/copy (`app/page.tsx`,
`CareerLoopHome.tsx`); #1081 still owns `/profile/activate` (B1); #1133 owns the
journey eyebrow header (at founder gate). **#1103 and #1109 have MERGED**, which
unblocks the `/onboarding` copy tier.

---

## DL-001 — Floating feedback chip blocks taps on mobile — **CLOSED ✅ (wave 1)**

**Shipped** as PR #1119 → `29970a559`, founder GO 2026-08-07.
**Production-verified** on `vitalcv.com/onboarding` (iPhone 14) once the deploy carried
the merge SHA: chip now `44×44 @ x322`, `intersects: false`,
`signinClickBlocked: false`, `elementFromPoint` at the link's center returns
`"Sign in"`, and clicking it navigates to `/sign-in?redirect_url=%2Fonboarding`.
Desktop unchanged (109×44, label visible). Evidence: `dl-001/`.

Re-audit note: the click only navigates after hydration settles (~6s in the harness);
an earlier click returned to the same URL. That is a general harness caveat, not a
regression — assert against a hydration signal, not a fixed wait.

<details><summary>Original finding (kept for lineage)</summary>

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

</details>

## DL-002a — Customer-language inventory — **DELIVERED (wave 2), awaiting classification sign-off**

- **Deliverable:** `docs/strategy/customer-language-inventory.md` — **revised in place**;
  a Wave 1077 PR C version already existed and its conclusions needed correcting, not replacing
- **Why it came before DL-002:** DL-002 looked like a one-file copy edit. The inventory
  shows the same vocabulary spans **443 visible occurrences across 10 terms**, so a
  narrow fix would have renamed the noun on one surface and left it standing on
  twenty — trading one incoherence for another.
- **Findings that change the plan:**
  1. **These words do two jobs.** ~45 occurrences are *truth qualifiers* (freshness
     windows like "monthly snapshot", limitation clauses like "Receipt recorded. Does
     not imply employer acceptance."), not product vocabulary. They are marked
     **protected** — a blind rename would delete the honesty the product is built on.
  2. **Primary navigation is already canonical** (Clinicians/Employers/Trust, profile-first
     labels). The debt is page copy and in-app surfaces, not IA — this retires the nav
     half of DL-003.
  3. **The real cost is tests:** 141 test files reference these terms and 20+ assert on
     rendered copy, several of them truth guards. A copy wave is a copy edit **plus** a
     test-contract migration.
  4. **The 2026-08-05 inventory's headline was wrong.** It concluded the retire list
     was "already almost absent from customer copy" using a JSX-text-node search; that
     method cannot see prose string literals, which is where most of this copy lives.
     Production screenshots settle it — `/onboarding` renders "Your free, source-backed
     career wallet". The revision annotates the original inline rather than rewriting it.
  5. **The guard that was supposed to prevent this does not exist on `main`.**
     `strategy-messaging-guard.test.tsx` lives only in open PR #1079, but the merged
     inventory describes it as active. Nothing currently fails the build when a retired
     noun reaches the homepage. Landing it is part of wave L1.
- **Proposed sequencing:** L1 `wallet` (~40, low risk) → L2 `passport` orphans (~25) →
  L3 acquisition-copy demotion (~35, after #1079) → L4 in-app snapshot noun (~30).
- **Open founder decisions:** keep `recognition` as a distinct state? rename-vs-retire
  the `/snapshot` and `/packet` routes? change the PWA description in `app/manifest.ts`?

## DL-002 — `/onboarding` sells a "career wallet" and "readiness packet" (retired vocabulary)

**Now UNBLOCKED** (#1103 merged). Superseded in scope by DL-002a: execute as **wave L1**
of the inventory's sequence rather than as a single-file edit.

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
- **Size:** XS as scoped; **~40 occurrences** as wave L1 across clinician + public surfaces
- **Dependencies:** none — `docs/strategy/` canon is already in-repo (landed in #1080)
- **Collision risk:** cleared — #1103 merged 2026-08-07; no open PR touches `GetReadySurface.tsx`

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
- **Update 2026-08-07 (DL-002a):** the *navigation* half of this finding is closed —
  `navDestinations.ts` is already canonical. What remains is the rail's cell copy
  (`CareerLoopHome.tsx:111,403` "The packet"), which stays #1079's to change.

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
| Mobile quality | 5 → **7** | DL-001 tap blocker CLOSED and prod-verified 2026-08-07; compositions otherwise sound. Next mobile evidence needed before claiming higher |
| Interaction/motion | 7 | Scenes reveal correctly on scroll (verified); motion mostly has a job |

Weakest important dimension at baseline: **mobile quality** — hence DL-001 as wave 1.
After wave 1 the weakest important dimensions are **comprehension (6)** and
**differentiation (6)**; both are gated on #1079 landing, so wave 3 should be either
the inventory's L1 (`wallet` → profile, unblocked now) or DL-005 (`/employers`
hierarchy). Re-score against fresh captures after the next deploy — these numbers are
only as good as the evidence behind them.
