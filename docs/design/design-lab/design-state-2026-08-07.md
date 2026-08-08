# VITALCV DESIGN STATE — 2026-08-07

First weekly synthesis of the Continuous Design Lab. Covers six merged PRs and one
production audit. Every claim below is tied to a capture, a measurement, or a merged SHA.

---

## The honest headline

**Vocabulary converged; comprehension did not materially move.**

Four waves shipped and all of them were *naming* waves. That was the right sequence —
a product with two names for its central object cannot be made clearer by rearranging
it — but naming is the floor, not the ceiling. The two weakest important dimensions on
the baseline scorecard, **comprehension (6)** and **differentiation (6)**, are decided
on the homepage, and the homepage has been owned by an open PR (#1079) for the entire
period. Nothing this week touched it.

So: real debt retired, one P0 usability blocker closed, a whole class of regression
now guarded — and the single highest-value experience question untouched. Both halves
are true and the second one is the one that should drive next week.

---

## What improved

| Change | Evidence |
| --- | --- |
| **P0 tap blocker closed** — the floating Feedback chip covered the Sign-in link on mobile `/onboarding`; `elementFromPoint` at the link's centre returned the chip | #1119 `29970a559`. Prod-verified: chip 44×44 @ x322, `elementFromPoint` returns "Sign in", link navigates to `/sign-in?redirect_url=%2Fonboarding` |
| **One name for the central object** — `wallet` (52 occurrences) retired | #1139 `96d3255b2`. Prod-verified absent from `/onboarding`, `/get-ready`, `/trust`, `/employers`, `/sign-in` |
| **Orphaned vocabulary deleted** — `passport` (35) named a concept whose route died in #1096 | #1145 `e55bf2b84`. Prod-verified absent from the same five surfaces |
| **`snapshot` split by sense** — the possession noun retired, three honest senses kept | #1157 `efda1a5d8` |
| **Truth qualifiers are now guarded, not merely present** | `customer-language-guard.test.ts` asserts cadence windows, limitation clauses and the employer decision boundary REMAIN; proven red by deleting one |
| **Language canon is measured, not asserted** | `customer-language-inventory.md` revised against production; 443 occurrences counted and classified |

## What got worse, or failed to improve

1. **Comprehension and differentiation are unchanged.** No wave touched hierarchy,
   pacing, or the homepage story. Vocabulary convergence is necessary and not
   sufficient; a clinician who understood the product in five seconds before still
   does, and one who did not still does not.
2. **The #1079 blockage is now the dominant constraint,** not a scheduling detail. It
   holds DL-003, DL-004, DL-006 **and** language wave L3 — four of the ten backlog
   items, including every item that would move the weakest dimensions.
3. **New IA debt became visible** (it pre-existed; the wave exposed it): `HolderDesktopNav`
   carries both `Wallet → /holder` and `Profile → /clinician/profile`. Two surfaces
   claim to be the profile and the product has not decided which is.
4. **A verification blind spot was found the expensive way.** `vitest.config` excludes
   `tests/**`, so a green unit suite says nothing about copy pinned by e2e specs. L2
   shipped its first CI attempt red on exactly that. Now written into the charter.

---

## Scorecard — baseline → now

Scores without evidence are meaningless; each row cites what it is based on.

| Dimension | 08-07 baseline | Now | Basis |
| --- | :---: | :---: | --- |
| Comprehension | 6 | **6** | Vocabulary converged, but rail nouns and cinematic pacing are untouched (#1079) |
| Clinician ease | 7 | **7** | NPI still above the fold, free/no-account stated; no effort removed this week |
| Employer ease | 6 | **6** | `/employers` six-step text wall unchanged (DL-005 open) |
| Next-step clarity | 7 | **7** | One primary action per surface holds |
| Visual hierarchy | 6 | **6** | Untouched |
| Design coherence | 7 | **8** | One noun for the profile across five prod-verified surfaces |
| Differentiation | 6 | **6** | Untouched — the Start Agent surface (DL-007) is where this moves |
| Trust clarity | 8 | **9** | Qualifiers now *guarded* in both directions, not just present |
| Mobile quality | 5 | **7** | DL-001 closed and prod-verified; no new mobile evidence beyond it |
| Interaction / motion | 7 | **7** | Untouched |

Two dimensions moved. Six are unchanged because nothing addressed them, and saying so
is more useful than distributing credit across the board.

---

## Top 10 backlog

| # | Item | P | Status |
| --- | --- | :---: | --- |
| 1 | **DL-007** — Start Agent activity language (doing / waiting / needs you / needs employer / done) | P1 | Doc-first; A0 #1113 + A1 #1123 + A2.1 #1159 in flight |
| 2 | **DL-003** — homepage rail machinery labels ("The packet", "Their decision") | P1 | **Blocked — #1079** |
| 3 | **DL-008** — `/holder` vs `/clinician/profile` both claim "the profile" | P1 | **Needs founder IA decision** |
| 4 | **L3** — acquisition-copy demotion of packet / receipt / recognition (~35) | P1 | **Blocked — #1079** |
| 5 | **DL-005** — `/employers` hierarchy pass | P2 | **Unblocked** |
| 6 | **DL-004** — cinematic interstitials outrank utility | P2 | **Blocked — #1079** |
| 7 | **DL-006** — anonymous rail spends prime real estate on empty placeholders | P2 | **Blocked — #1079** |
| 8 | **DL-009** — delete dead `ProductCarousel` / `OutcomeTriad` | P3 | Unblocked; verify against #1079 first |
| 9 | Route-level IA — `/snapshot`, `/packet`, `/receipt`, `/holder` carry retired words in URLs | P2 | Needs founder decision (labels-only was decided; routes were not) |
| 10 | "VitalCV Jobs" has no surface — the one canonical concept with nothing using it | P2 | Carried from the 2026-08-05 inventory, still true |

## Highest-impact unfinished experience

**The clinician's first thirty seconds.** `/onboarding` now says the right words, but
the sequence is unchanged: enter an NPI, then read. The Easy Button canon and the
category strategy agree on the moment — *enter your NPI and immediately see a useful
professional profile* — and the product still spends its best real estate on
placeholders before that moment lands. This is DL-003/004/006 and L3 together, and all
four wait on one PR.

## Surfaces carrying stale strategy

- `components/home/ProductCarousel.tsx`, `OutcomeTriad.tsx` — zero importers, still
  carrying wallet/packet/recognition copy (DL-009)
- `app/snapshot/[id]`, `app/packet/[entityId]`, `app/receipt/[receiptId]` — live routes
  whose URLs are retire-tier vocabulary
- `components/matcha/buyer/*` — investor/buyer framing predating the category lock
- `docs/strategy/customer-language-inventory.md` §"two real gaps" — "VitalCV Jobs"
  still unused, unchanged since 2026-08-05

## Design-system inconsistencies

1. **Guard coverage was audience-scoped.** `BUYER_BANNED_STRINGS` banned `wallet`
   rigorously on buyer surfaces; nothing covered clinician surfaces. The vocabulary was
   protected where an employer would read it and unguarded where a clinician starts.
2. **A guard's surface list is a commitment, not a net.** L1 left "Access your Wallet"
   in `AuthDisclosureCard` because that file was not on the list; the guard stayed green.
3. **`strategy-messaging-guard.test.tsx` does not exist on `main`** — only in #1079,
   though merged docs describe it as active.
4. **`sitemap-freshness` drifts at every UTC rollover** — stamps written as local dates,
   test measures UTC. Hit three times this week; fixed each time, will recur.

## Journey discontinuities

- Two nav entries claiming to be the profile (DL-008)
- Retired nouns still visible in the address bar on four live routes
- `/onboarding` renders a degraded workspace panel in any environment without Clerk —
  harmless locally, but it means the first-run surface has a failure state that is
  never exercised in the unit suite

## Collision map

| Owner | Territory | Blocks |
| --- | --- | --- |
| **#1079** | homepage composition + copy (`app/page.tsx`, `CareerLoopHome.tsx`) | DL-003, DL-004, DL-006, L3 |
| **#1081** | `/profile/activate` (B1) | DL-007 sequencing; informs DL-008 |
| **#1133** | journey eyebrow header + walkthrough | shared header |
| **#1113 / #1123 / #1159** | Start Agent A0 / A1 / A2.1 | DL-007 substrate |
| **#1160** | Phase 0 freeze + Experience Constitution | **may supersede parts of this charter — reconcile before next wave** |

## Recommended next three waves

1. **Resolve #1079 (founder decision, not a design wave).** It is the single constraint
   holding four backlog items and both weakest dimensions. Land it, revise it, or close
   it — any of the three unblocks more than another vocabulary wave would deliver.
2. **DL-007 — Start Agent activity language, doc-first.** The highest strategic value
   available and the only unblocked path to differentiation. Three agent PRs are in
   flight; the design primitives should exist before the surface is improvised.
3. **DL-005 — `/employers` hierarchy pass.** Unblocked, bounded, and moves employer ease
   — the dimension no wave has touched.

**Not recommended:** another language wave. L3 is blocked, and the remaining
occurrences are task-specific or protected. The vocabulary work has reached the point
of diminishing returns; the next gains are in hierarchy and sequence.

## Note on #1160

An open PR proposes a "Phase 0 freeze" and an "Experience Constitution". If that lands
it may govern or supersede parts of this charter. **Reconcile the two before the next
wave rather than running competing design doctrines** — that is precisely the failure
this program's parallel-work rules exist to prevent.
