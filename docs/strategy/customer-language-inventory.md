# Customer language inventory

**Date:** 2026-08-05 · **Wave:** 1077 (PR C)

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

---

## Headline finding

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

| Term | Rendered to customers? | Route path? | Action |
| --- | --- | --- | --- |
| Wallet | ❌ none | ❌ | **Already clear.** Hold the line. |
| Passport | ❌ none | ✅ `/passport` | Label already reads "Your evidence record"; change to "Your VitalCV profile". **Do not rename the route** without a redirect. |
| Dossier | ❌ none | ❌ | Already clear |
| Trust Passport | ❌ none | ❌ | Already clear |
| Evidence OS | ❌ none | ❌ | Already clear |
| Evidence packet *(as product name)* | ❌ none | ❌ | Clear since PR B removed `Packet` from the rail |
| Recognition | ⚠️ 1 interior occurrence | ✅ `/holder/recognition` | Interior only; re-word when that surface is next touched |
| Snapshot | ❌ as a product name | ❌ | Keep as a **cadence** word only |
| Receipt | ❌ none | ❌ | Internal only |
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
being added once, reasonably, in isolation. The guard in
`apps/web/__tests__/strategy-messaging-guard.test.tsx` now fails the build if any
of them reaches the homepage again.
