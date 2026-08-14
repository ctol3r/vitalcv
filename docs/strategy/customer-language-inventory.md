# Customer language inventory

**Date:** 2026-08-05 · **Wave:** 1077 (PR C)
**Revised:** 2026-08-07 · Continuous Design Lab wave 2 (DL-002a) — see
[Revision 2026-08-07](#revision-2026-08-07--measured-against-production).

Classifies every term the Wave 1077 instruction §3 names, plus the four canonical
concepts, against what the code actually renders.

## Method, and its limits

Each term was searched three ways, because they answer different questions:

1. **Rendered customer text** — `>…term…<` inside `app/` and `components/`, which
   is the only form a customer ever sees.
2. **Route paths** — a URL is customer-visible in the address bar and in anything
   anyone has linked, but renaming one breaks links.
3. **Internal code** — class names, types, schemas, audit records. The strategy
   explicitly says *do not mass-rename these*.

The distinction matters because raw file counts are misleading: "Passport" appears
in 65 files and is rendered to a customer in **none** of them.

**Limit:** rendered-text search misses text assembled from variables or coming
from an API. Interior signed-in surfaces were sampled, not exhaustively audited.

> **2026-08-07:** that stated limit is exactly what went wrong. Much customer copy
> lives in **prose string literals** — `const BENEFITS = [{ text: '…' }]` rendered
> through `.map()` — which a `>…term…<` search cannot see. The revision below
> re-measures including string literals and checks the result against production
> screenshots. Several ❌ marks in the tables that follow are wrong; each is
> annotated inline rather than silently rewritten, so the correction is auditable.

---

## Headline finding

> ⚠️ **Superseded 2026-08-07.** This finding does not survive production
> observation. See [Revision 2026-08-07](#revision-2026-08-07--measured-against-production).

**The retire list is already almost absent from customer-visible copy.** Of the
fourteen terms, **zero** render on the acquisition surfaces (homepage, primary
nav, `/onboarding`, `/employers`, `/trust`), and one renders on an interior
surface. The vocabulary problem is now concentrated in **route paths** and
**internal code** — not in what a clinician reads.

That is a materially smaller problem than the strategy document anticipated, and
it changes the recommended action from "rewrite the product's language" to "stop
the route names leaking, and do not add more nouns."

---

## Canonical — use these

| Term | Where it must appear | Status |
| --- | --- | --- |
| **VitalCV** | Everywhere the company or network is named | ✅ in use |
| **Your VitalCV profile** | The reusable professional identity | ✅ homepage, post-1077 copy |
| **VitalCV Jobs** | The opportunity marketplace | ⚠️ **not yet used** — `/holder/matcha` is labelled from the engine |
| **Apply with VitalCV** | The canonical transaction | ✅ `components/apply/ApplyWithVitalCV.tsx`, homepage |

---

## Allowed when task-specific

Terms a customer may legitimately meet at the moment they need them, but which
must never lead.

| Term | Where it is allowed | Reference |
| --- | --- | --- |
| Source / source-backed | Beside a fact, explaining where it came from | `CareerLoopHome` resolved state |
| Review | The employer's step, at the point of applying | `data-home-truth-boundary` |
| Readiness | Interior clinician surfaces about their own state | `/holder/readiness` |
| Evidence | `/trust/*` explanatory pages | `/evidence-network`, `/trust/attribution` |

---

## Internal only — keep, do not market

The strategy is explicit: **do not mass-rename backend classes, schemas, APIs or
audit records.** These are correct names for the machinery.

| Term | Lives in | Rendered to customers |
| --- | --- | --- |
| MATCHA | `services/matcha/*`, `/api/matcha/*`, route `/holder/matcha` | ❌ (removed from hero in PR B) |
| PSV | `lib/issuer-verification/*`, truth contract | ❌ |
| Receipt | `ReceiptCandidate`, `PSVReceiptCandidate`, audit records | ❌ |
| Packet | `application_packets`, `applicationPacketReadService` | ❌ (removed from the homepage rail in PR B) |
| Snapshot | `graph_snapshots`, source-lane cadence labels | ❌ as a product name; ✅ as a cadence word ("monthly snapshot") |
| Holder | Route prefix `/holder/*`, `sharedByClerkUserId` semantics | ❌ |
| Trust tier / SD-JWT / knowledge graph | Crypto and graph internals | ❌ |

---

## Retire — and the honest status of each

> ⚠️ The "Rendered to customers?" column below was measured with the JSX-text-node
> method and is **wrong for six terms**. Corrected counts are in the revision.

| Term | Rendered to customers? | Route path? | Action |
| --- | --- | --- | --- |
| Wallet | ~~❌ none~~ → **✅ 52 visible, incl. `/onboarding` and `/trust`** | ❌ | **Retire.** Wave L1. |
| Passport | ~~❌ none~~ → **✅ 35 visible** | ~~✅ `/passport`~~ route retired by #1096 | Orphaned vocabulary for a dead concept. **Retire.** Wave L2. |
| Dossier | ❌ none | ❌ | Already clear |
| Trust Passport | ❌ none | ❌ | Already clear |
| Evidence OS | ❌ none | ❌ | Already clear |
| Evidence packet *(as product name)* | ~~❌ none~~ → **✅ 95 visible** (50 on public surfaces) | ❌ | Allowed when task-specific; **retire from acquisition copy only.** Wave L3. |
| Recognition | ~~⚠️ 1 interior~~ → **✅ 43 visible** | ✅ `/holder/recognition` | Names a real state; keep in-app, retire from acquisition copy. Wave L3. |
| Snapshot | ~~❌ as a product name~~ → **✅ 79 visible**, ~22 of them cadence | ✅ `/snapshot/[id]` | Cadence usage **protected**; retire the product-noun usage. Wave L4. |
| Receipt | ~~❌ none~~ → **✅ 97 visible** | ✅ `/receipt/[receiptId]` | Limitation-clause usage **protected**; task-specific elsewhere. Wave L3. |
| Holder | ❌ none | ✅ `/holder/*` | Route only; label as "Profile" |
| PSV | ❌ none | ❌ | Internal only |
| Trust tier | ❌ none | ❌ | Internal only |
| SD-JWT | ❌ none | ❌ | Internal only |
| Blockchain | ❌ none | ❌ | Already absent repo-wide |

---

## The two real gaps

1. **VitalCV Jobs does not exist as a customer word.** The marketplace is
   labelled from the engine (`matcha`) or as "opportunities". This is the one
   canonical concept with no surface using it. Fixing it is a **label** change on
   a real route (`/holder/matcha`), proposed in the
   [IA audit](./information-architecture-audit.md).

2. **Route paths are the remaining leak.** `/passport` and `/holder/*` are the
   two retired words a customer can still see — in the address bar. Renaming
   them is a redirect exercise, not a copy exercise, and is deliberately not
   bundled into a messaging wave.

---

## The rule that keeps this list short

From the [decision filter](./product-decision-filter.md): a new customer-facing
noun is a **product decision**, not a free addition. Every term above got here by
being added once, reasonably, in isolation. ~~The guard in
`apps/web/__tests__/strategy-messaging-guard.test.tsx` now fails the build if any
of them reaches the homepage again.~~

> ⚠️ **2026-08-07: that guard does not exist on `main`.** It lives only in open PR
> #1079. Nothing currently fails the build when a retired noun reaches the homepage.
> This is the orphaned-guard pattern in reverse — a document describing protection
> that was never merged. Landing a guard is part of wave L1.

---

# Revision 2026-08-07 — measured against production

Re-measured by the Continuous Design Lab (wave 2, DL-002a) because a wave scoped as
"fix the `/onboarding` copy" needed to know whether that was one file or two hundred.

## What changed and why

The 2026-08-05 pass searched JSX text nodes. This pass adds **prose string
literals**, then checks the result against **production screenshots** of
`vitalcv.com`. The two disagree, and production is the tiebreaker:

`app/get-ready/GetReadySurface.tsx:1002` renders `Your free, source-backed career
wallet` on `/onboarding` — captured in production on 2026-08-07
(`docs/design/design-lab/dl-001/`, the `/onboarding` mobile and desktop shots). Three
more `wallet` lines sit in a `BENEFITS` array at lines 109–110, rendered through
`.map()`. So `wallet` was never "already clear"; it leads the right rail of the
primary clinician entry surface.

**Corrected headline:** the retire list is **not** absent from customer copy. It is
**443 visible occurrences across 10 terms**, concentrated in page copy and in-app
surfaces. The earlier conclusion — "stop the route names leaking, don't add nouns" —
understated the work. Route paths are, if anything, the *smaller* half now that
`/passport` is retired.

## Measured counts by audience

| Term | Public | Clinician app | Employer app | Shared chrome | Internal/ops | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| receipt | 26 | 5 | 14 | 3 | 39 | **97** |
| packet | 50 | 14 | 20 | 3 | 8 | **95** |
| snapshot | 38 | 5 | 2 | 0 | 28 | **79** |
| wallet | 12 | 24 | 1 | 6 | 9 | **52** |
| recognition | 12 | 14 | 8 | 2 | 6 | **43** |
| passport | 14 | 7 | 2 | 3 | 9 | **35** |
| PSV | 5 | 6 | 8 | 0 | 5 | **24** |
| holder | 1 | 1 | 1 | 0 | 8 | **11** |
| SD-JWT | 0 | 0 | 0 | 0 | 5 | **5** |
| dossier | 0 | 0 | 0 | 0 | 2 | **2** |

## The distinction that governs every later wave

**These words do two different jobs, and only one of them is product vocabulary.**

| Job | Example | Disposition |
| --- | --- | --- |
| **Product noun** — a thing the customer is meant to remember | "Your free, source-backed career **wallet**" | Retire; converge on *your VitalCV profile* |
| **Truth qualifier** — states a limit, freshness window, or what a thing does *not* establish | "OIG/LEIE refresh on a monthly **snapshot**"; "**Receipt** recorded. Does not imply employer acceptance." | **Protected. Do not touch.** |

The 2026-08-05 pass already caught the shape of this for `snapshot` ("✅ as a cadence
word"). The revision generalises it and counts it: **~45 occurrences are truth
qualifiers**, including the issuer/PSV limitation clauses
(`components/VerificationReceipts.tsx:40,48`;
`app/issuer/psv-receipt/[requestId]/page.tsx:180`) and every source-cadence label
(`app/evidence-network/page.tsx:59`, `components/home/w1501/Hero.tsx:203-204`).

A find-and-replace would delete freshness windows and limitation notes. Where the
vocabulary strategy and the truth contract disagree, **the truth contract wins**.

## The real cost is the test contract

**141 test files** reference these terms; **20+ assert on rendered copy**, several of
them truth guards (`homepage-truth-contract.test.tsx`, `passport-review-truth.test.tsx`,
`status-source-lanes.test.tsx`, `evidence-network-quarantine.test.tsx`). A copy wave is
a copy edit **plus** a test-contract migration — and some of those tests exist
specifically to stop copy polish from dropping truth strings.

## Already canonical — no action needed

**Primary navigation is clean.** `components/layout/navDestinations.ts` carries
Clinicians / Employers / Trust with profile-first labels ("Build your profile",
"Opportunities"), and Wave 1077's IA correction demoting "Evidence" under Trust is
recorded in the file. `journeyStages.ts` (Your Number / Sources / Permission /
Review) contains no retire-tier vocabulary. **The debt is page copy, not IA.**

## Proposed sequencing

| Wave | Scope | Occurrences | Test risk |
| --- | --- | ---: | --- |
| **L1** | `wallet` → profile (clinician + public) **+ land the missing guard** | ~40 | Low — no truth strings |
| **L2** | `passport` orphans — **excluding `app/manifest.ts`** (founder: do not touch) | ~24 | Low — concept already retired |
| **L3** | acquisition-copy demotion of packet/receipt/recognition | ~35 | **Medium — every adjacent limitation clause must survive** |
| **L4** | in-app `snapshot`-as-noun | ~30 | Medium |
| — | protected truth qualifiers | ~45 | **Never touched** |

L3 waits for #1079 (it owns the homepage copy carrying much of that tier).

The guard landed in L1 should assert **both** directions: that acquisition surfaces do
not reintroduce `wallet`/`passport`, **and** that the freshness qualifiers and
limitation clauses remain. Guard the truth strings, not only the marketing strings.

## Founder decisions — recorded 2026-08-07

### Amendment — recorded 2026-08-13

The founder-locked human+tactile career-mobility direction restores two precise
public labels without reopening the wider retired vocabulary:

1. **CV Wallet — KEEP as the compound product name.** It names the
   clinician-owned reusable career record. Generic “wallet” and crypto-wallet
   language remain retired.
2. **Exact packet — KEEP inside the record-to-reuse process.** It names the
   clinician-selected, versioned record an employer receives. Generic packet
   marketing remains retired; `ApplicationPacket` remains the technical name.
3. **Accepted head start — KEEP as public acquisition language.** Recognition
   remains the distinct in-app state tied to the exact employer decision.

This dated direction supersedes the 2026-08-07 classification only for these
exact compounds. The copy gate encodes them as narrow `allowWithin` phrases so
the earlier vocabulary-sprawl protection remains effective.

### Standing decisions from 2026-08-07

1. **`recognition` — KEEP** as a distinct in-app state. It names a real thing an
   employer did; folding it into "employer accepted" would cost meaning. Stays
   *allowed when task-specific*: in-app yes, acquisition copy no.
2. **Routes — LABELS ONLY.** `/snapshot/[id]`, `/packet/[entityId]`,
   `/receipt/[receiptId]` keep their paths. Change rendered labels; do not rename or
   redirect routes in a copy wave. Route-level IA is a separate, later decision.
3. **`app/manifest.ts` — DO NOT TOUCH.** The PWA description stays as-is. It is an
   install-surface string on every mobile home screen and is explicitly out of scope
   for every wave below. **This removes it from L2.**
4. **"VitalCV Jobs"** — still unused, as the 2026-08-05 pass found. Unchanged and
   still the one canonical concept with no surface. Not part of L1–L4; needs its own
   decision about whether the marketplace takes the canonical name.

These decisions are the classification sign-off. Waves L1–L4 may now execute against
this inventory, each stopping at its own founder visual gate.
