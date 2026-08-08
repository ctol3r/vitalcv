# Wave L1 — `wallet` retired as a customer-facing product noun

Executes wave L1 of the sequencing in
[`docs/strategy/customer-language-inventory.md`](../../../strategy/customer-language-inventory.md),
under the founder classification sign-off recorded there on 2026-08-07.

## Problem

**What is wrong now:** the clinician's thing has two names. The canonical noun is
*your VitalCV profile*, but 52 visible occurrences call it a *wallet* — including the
headline of the `/onboarding` right rail, which is the first thing a new clinician
reads. Two nouns for one object is the exact failure the category strategy exists to
prevent.

**What the user should understand instead:** VitalCV builds *one profile*, and that
profile is the thing they own, reuse, and apply with.

**Design principle:** easy outside — one name per concept. A customer should hold four
concepts, not five.

**Deliberately not changing:** the truth qualifiers (untouched and now guarded), the
homepage (PR #1079 owns it), deep-link anchors, analytics event keys, package names,
component identifiers, and the holder nav labels (see the IA finding below).

## Evidence

| | |
| --- | --- |
| `before-prod-onboarding-career-wallet.png` | Production 2026-08-07 — rail reads **"Your free, source-backed career wallet"** |
| `after-local-onboarding-career-profile.png` | This branch — rail reads **"Your free, source-backed career profile"**; zero `wallet` on the surface |

The after-capture shows the degraded "Couldn't check your workspace" panel on the left:
local dev has no Clerk middleware, so the workspace probe 500s. That is an environment
artifact, not part of this change — the rail on the right is the surface under review.

## Verification

- **Full web suite: 3308 passed**, 1 skipped, 0 failed.
- **Typecheck: 0 errors** outside `.next/types` (stale generated route types from a
  local dev run, referencing routes #1104 deleted).
- **Guard proven by injecting the bug** — reintroducing "CV Wallet" on `/trust` turns
  `customer-language-guard.test.ts` red; restoring turns it green. A guard never seen
  red is not evidence.
- **Rendered check:** `/get-ready` and `/onboarding` both report `wallet present: false`.

## The guard asserts both directions

The negative direction (no `wallet` on cleaned surfaces) is the obvious half. The
positive direction matters more: it asserts the **truth qualifiers survive** — the
source-cadence windows on `/evidence-network` ("monthly", "quarterly", "snapshot"), the
`VerificationReceipts` "does not imply" clause, the PSV "scoped evidence / does not"
language, and the employer doorway's decision boundary.

~45 of the retire-tier occurrences are truth qualifiers rather than vocabulary. A
find-and-replace that stripped them would satisfy a negative-only guard while deleting
the honesty the product is built on. That is why this guard is two-way.

A one-way guard is also precisely what failed here: the 2026-08-05 inventory closed by
saying `strategy-messaging-guard.test.tsx` prevented retired nouns from reaching the
homepage. That file only ever existed in unmerged PR #1079 — nothing was enforcing it,
and `wallet` drifted onto the primary entry surface.

## Findings logged, not fixed here

1. **IA — two "Profile" entries.** `HolderDesktopNav` carries both `Wallet → /holder`
   and `Profile → /clinician/profile`. Renaming the label would produce two identically
   named nav items pointing at different routes. That is an IA decision about what
   `/holder` versus `/clinician/profile` *are*, not a copy fix. Nav labels excluded from
   this wave; logged as **DL-008**.
2. **Dead code.** `components/home/ProductCarousel.tsx` and
   `components/home/OutcomeTriad.tsx` have zero real importers; their wallet/packet/
   recognition copy never renders. Not polished here — logged for deletion as **DL-009**.
3. **Pre-existing red fixed to unblock.** `sitemap-freshness.test.ts` was already
   failing on a clean checkout of `origin/main`: `/onboarding`'s stamp was written as a
   local date while the test measures UTC, so it drifted at the UTC rollover. Verified
   pre-existing by stashing this branch's changes and re-running. This wave's edit to
   `app/trust/page.tsx` then added `/trust` to the same drift. Both stamps corrected to
   the measured commit date (`2026-08-08`) — a factual correction, which is what that
   test is for.
