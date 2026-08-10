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
- **Sequencing:** **L1 MERGED** `96d3255b2` → **L2 MERGED** `e55bf2b84` →
  **L4 AT FOUNDER GATE** → L3 acquisition-copy demotion (~35) still blocked on #1079.
- **Founder decisions recorded 2026-08-07:** `recognition` **KEPT** as a distinct
  in-app state; routes are **labels-only** (no path renames or redirects in a copy
  wave); `app/manifest.ts` is **not to be touched**, which removes the PWA description
  from L2. Classification sign-off given — L1–L4 may execute, each at its own gate.

## DL-002 / wave L1 — `wallet` retired from customer copy — **AT FOUNDER GATE**

Shipped as the L1 wave: 55+ replacements across 25 files, two-way guard landed
(`__tests__/customer-language-guard.test.ts`), full suite 3308 passing. Evidence in
`design-lab/l1-wallet/`. Surfaced DL-008 (nav IA) and DL-009 (dead components) rather
than forcing them into scope.

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

## DL-008 — `/holder` and `/clinician/profile` both claim to be "the profile" (IA)

- **Route/surface:** `components/holder/HolderDesktopNav.tsx`, `components/clinician/MobileBottomNav.tsx`
- **Problem:** the desktop holder nav carries **both** `Wallet → /holder` and
  `Profile → /clinician/profile`. Wave L1 retired "wallet" as a customer noun, but the
  label cannot simply become "Profile" — that would put two identically named entries in
  one nav pointing at different routes. The real question is what these two surfaces
  *are*: one of them is the clinician's profile, and the product has not decided which.
- **Evidence:** `HolderDesktopNav.tsx:29-38` (8 items incl. both), `MobileBottomNav.tsx:14-19`.
- **Persona:** clinician, activated · **Severity:** P1 · **Strategic impact:** comprehension, coherence
- **Recommended direction:** founder IA decision first (merge the surfaces, or name them
  distinctly — e.g. workspace home vs published profile), then a label wave.
- **Size:** S (labels) / M (if surfaces merge) · **Collision risk:** low today; #1081 (B1)
  lands `/profile/activate` and may inform the answer — **sequence after B1**.
- **Note:** nav labels were deliberately excluded from wave L1 for this reason.

## DL-009 — Dead homepage components still carrying retired vocabulary — **CLOSED 2026-08-09**

- **Route/surface:** `components/home/ProductCarousel.tsx`, `components/home/OutcomeTriad.tsx`
- **Problem:** both have **zero real importers** — nothing renders them. They still carry
  wallet/packet/recognition acquisition copy ("Reuse the same Wallet and Proof Packet…",
  "Source checks, receipts, and Recognition — one wallet."), which inflates every
  vocabulary audit with occurrences no customer can ever read.
- **Evidence:** no `from '@/components/home/ProductCarousel'` or `.../OutcomeTriad'`
  anywhere in `app/` or `components/`; verified 2026-08-07.
- **Persona:** n/a (maintenance) · **Severity:** P3 · **Strategic impact:** coherence — deletion makes the product simpler
- **Recommended direction:** delete both, with their tests. Do not "fix" their copy —
  polishing dead code is how it survives another audit.
- **Size:** XS · **Collision risk:** verify against #1079 before deleting (it owns `components/home/`)
- **Closure (2026-08-09):** deleted as recommended — copy untouched, files removed —
  along with `MetricStrip.tsx`, the same dead-component class (zero importers; its
  retirement was already ruled by the C5 composition ruling and
  `docs/strategy/one-platform-synthesis-2026-07-25.md`). Their tests went with them:
  the ProductCarousel glyph-grammar blocks in `homepage-truth-pass.test.tsx` and the
  MetricStrip lane-parity block in `source-lane-registry.test.ts`. #1079 verified
  CLOSED (unmerged) before deletion. Baselines regenerated: 8 (file, term) pairs left
  `copy-rules-baseline.json`; LINT-02 ceiling lowered 284 → 281.

## L2 — `passport` retired from customer copy — **AT FOUNDER GATE**

- **Thesis:** the concept died with the route (#1096 retired `/passport`); the
  vocabulary outlived it. This is deletion of a name that points at nothing.
- **Scope:** 27 rendered-copy replacements across 21 files. Internal names untouched
  (`PassportData`, `passport` variables, `/api/passport/*`, `lib/trust/passport-*`) —
  the strategy explicitly forbids mass-renaming machinery.
- **Delicate case:** `TrustAttributionRegister` is a truth surface with its own
  contract test. Its `retrievalTime` values state *when* a source is read; the fact
  ("per request") survives, and one row citing `/passport input` — a route that no
  longer exists — is corrected to the route that carries NPI input today. Guarded
  both ways.
- **Caught an L1 miss:** `AuthDisclosureCard` still read "Access your Wallet"; it was
  not on L1's guard surface list, so the guard stayed green and its own pinned test
  caught it instead. The surface list is a commitment, not a net — noted in the
  charter's evidence contract.
- **Verification:** full suite **3357 passed**; guard extended to `passport`; the two
  migrated e2e specs run and pass locally (12/12 for the film project).
- **Process lesson — the vitest suite cannot see e2e pins.** `vitest.config` excludes
  `tests/**`, so `tests/e2e/*.spec.ts` assertions on rendered copy are invisible to a
  green local run. L2's first CI attempt failed on exactly that: two specs pinned
  "This clinician passport is not available for review yet…". Worse, one of them
  (`npi-truth-engine.spec.ts`) is **film-gated** — it needs
  `E2E_HOME_VARIANT=film --project=chromium-film` or it silently reports "No tests
  found". **Any future copy wave must grep `tests/` for every string it changes and
  run the affected specs under the right project**, not just the vitest suite.

## L4 — `snapshot`-as-possession retired — **AT FOUNDER GATE**

- **Thesis:** the word does four jobs; only one is product vocabulary.
  | Sense | Example | Disposition |
  | --- | --- | --- |
  | cadence | "OIG/LEIE refresh on a monthly snapshot" | **protected** |
  | point-in-time | "not checked on this public snapshot" | **protected** |
  | trust state | "OWNED SNAPSHOT" (attributed, replay-visible) | **protected** |
  | possession | "your readiness snapshot" — a thing you have and share | **retired** |
- **Scope: 12 replacements across 8 files** — far smaller than the inventory's ~30
  estimate, which counted raw occurrences before the sense-split. `readiness` itself
  stays: it is an allowed task-specific term for a clinician's own state, and only the
  artifact noun goes.
- **Deliberately NOT changed:** `app/snapshot/[id]` page labels. The artifact's identity
  is tied to its route, and renaming the label while the URL still reads `/snapshot`
  swaps one incoherence for another. Folded into the route-level IA decision alongside
  DL-008 rather than half-done here.
- **Guard proven red in BOTH directions:** reintroducing "Readiness snapshot." fails the
  negative half; changing "monthly snapshot" to "monthly refresh" fails the positive
  half. For this wave the positive half is the point — three protected senses survive.
- **Two real bugs caught during the wave:** the guard found three further
  `readiness snapshot` strings in `ApplyModal.tsx` that the extraction heuristic missed;
  and a replacement introducing "clinician's" broke a single-quoted string
  (`matcha/recruiters/page.tsx`) — a build-breaking syntax error the suite caught.
- **Verification:** full suite **3364 passed**; typecheck 0 non-generated errors; `tests/`
  swept for every changed string (no e2e pins — the L2 lesson applied up front).

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

## DL-005 — `/employers` reading load before the first action — **AT FOUNDER GATE**

**Shipped as a hierarchy pass.** Root cause was narrower than "long copy": the stage
model already has a `boundary` slot with its own rendered treatment (mono, accent rule,
muted), and three of six stages buried the same kind of qualifier mid-sentence in `body`
instead. Half the grid showed its honesty rail; half hid it. Three qualifiers moved into
the slot — **no words added, removed, or softened**, all seven truth strings verified
verbatim afterwards. Bodies are one scannable line each; 6/6 stages now carry a rail.
Evidence in `dl-005-employers/`. Full suite 3368 passed.

<details><summary>Original finding</summary>

- **Route/surface:** `/employers`
- **Problem:** the doorway now leads with outcome (good, post-#1086) but the workflow
  section runs six long text steps with near-uniform typographic weight before the
  size-tiered doors; recruiters scan, and the page currently rewards reading.
- **Evidence:** `employers-desktop.png`, `employers-mobile.png`, full text capture 2026-08-07.
- **Persona:** employer (recruiter / MSP) · **Severity:** P2 · **Strategic impact:** employer conversion, premium quality
- **Recommended direction:** hierarchy pass only — tighten step copy to one scannable
  line + one qualifier, keep the truth qualifiers; no strategy change.
- **Size:** S · **Collision risk:** verified nil at implementation time — #1079, #1133 and
  #1160 touch zero `/employers` files.

</details>

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

## DL-007 — Start Agent activity language — **EXPLORATION DELIVERED**

- **Deliverable:** [`dl-007-start-agent-language.md`](./dl-007-start-agent-language.md)
- **Core finding:** the primitives are **already in the domain model**. A0's
  `ACTION_OWNERS` × `PERMISSION_CLASSES` generate all of the charter's requested
  primitives — plus a seventh the charter missed (`source`-controlled, distinct from
  `employer`-controlled, because "the board hasn't replied" and "the hospital is
  deciding" feel different and only one is anyone's fault). We render these; we do not
  invent a parallel vocabulary.
- **Position:** not a chat interface — a worklist with provenance. Chat makes every
  statement look the same, and these statements carry different authority.
- **Honesty constraint:** A0 executes nothing above Level 2 (`prepare`), so the surface
  must say "I drafted this; it sends when you approve" rather than "I sent this" —
  and grow into execution without changing voice.
- **No aggregate:** seven load-bearing distinctions (resolved≠owned, pending≠verified,
  not_found is a finding, unsupported is OUR gap, invalid is never evidence, a
  correction has no winner, ready_to_start only when canonical) exist precisely to
  resist the summary a score would impose.
- **Next step is NOT implementation:** when A1 (#1123) merges, render one real plan
  read-only and check whether all seven disclosure elements can be filled from live
  data. An element that cannot be filled is a substrate finding, cheaper to learn in a
  render than in a wave.
- **Blocked on:** DL-008 (the agent surface must not become a third claimant to "the
  profile"); A1 for real plan data.

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
