# 90-day category execution plan

**Date:** 2026-08-05 · **Wave:** 1077 (PR C) · Derived from
[`vitalcv-category-strategy.md`](./vitalcv-category-strategy.md) and
[`vitalcv-strategy-operating-brief.md`](./vitalcv-strategy-operating-brief.md).

## North-star metric

> **Clinician starts enabled by a reused VitalCV profile**

Not profiles created, checks run, or packets generated. Those measure activity.
The north star measures whether the product worked for someone.

**Baseline, measured 2026-08-05:** `0`. There are 0 verified NPI bindings, 6
opportunities across 6 organizations, and no completed application in production.
Every number below starts from zero, and saying so is the point — a plan that
opens by implying traction cannot be checked against reality later.

---

## Days 1–30 · Ruthless simplification

| # | Item | State | Evidence |
| --- | --- | --- | --- |
| 1 | Install the strategy contract | ✅ **Done** | PR #1078 |
| 2 | Converge homepage copy | 🟡 **Ready, unmerged** | PR #1079, live review environment |
| 3 | Converge customer-facing vocabulary | ✅ **Audited** — smaller than expected | [inventory](./customer-language-inventory.md): 0 retired terms render on acquisition surfaces |
| 4 | Audit navigation and routes | ✅ **Done** | [IA audit](./information-architecture-audit.md); 5 gaps recorded |
| 5 | Choose one beachhead | ⏸ **Blocked on founder** | [packet](./beachhead-decision.md); 6 of 10 criteria need founder input |
| 6 | Fix remaining critical security and legal blockers | 🟡 **Two closed, one open** | #1074 closed anonymous NPI disclosure; #1075 made a self-asserted claim non-authoritative; **no verification path exists yet** |
| 7 | Instrument the full funnel | 🟡 **Events defined, sink unconfirmed** | 13 events in `lib/analytics/funnel.ts`; the preview transmits none — no analytics key configured |
| 8 | Freeze new customer-facing concept creation | ✅ **Enforced** | `strategy-messaging-guard.test.tsx` fails the build on the retire list |

**The blocking item is 5.** Items 2 and 6 can proceed without it; nothing in
days 31–60 can.

---

## Days 31–60 · One perfect loop

Ship and verify end to end:

> NPI → useful preview → claim profile → set preferences → see real role → apply with profile → employer reviews

**Honest status of each link today:**

| Link | Works? | What is missing |
| --- | --- | --- |
| NPI → useful preview | ✅ Live on `/` | — |
| → claim profile | 🟡 Claim submits as **pending** | Nothing verifies it |
| → set preferences | 🟡 Route exists (`/holder/matcha`) | Not exercised end to end |
| → see real role | ⚠️ Works, but **6 listings exist** | Demand-side density |
| → apply with profile | 🟡 Component is real and gated correctly | Blocked behind unverified ownership |
| → employer reviews | ⚠️ Surface exists | No employer has used it |

**The critical path is not code — it is two things:** a working ownership
verification path (Wave 1076 PR B, scoped but unbuilt), and employers with real
listings.

Recruit **5–10 employer design partners in the same segment** — the segment
chosen in item 5.

---

## Days 61–90 · Prove economic value

Instrument and report:

| Metric | Baseline | Instrumented? |
| --- | --- | --- |
| NPI-to-preview success | — | ✅ `npi_resolved` / `npi_resolution_failed` |
| Preview-to-claimed-profile conversion | 0 | 🟡 needs a claim event |
| Time to first useful profile | — | ❌ not instrumented |
| Profile-to-application conversion | 0 | ✅ `apply_opened` → `share_completed` |
| Application completion | 0 | ✅ `share_completed` fires only on backend success |
| Employer time to first review | — | ❌ not instrumented |
| Repeated data entry avoided | — | ❌ not instrumented |
| Offer-to-start time | — | ❌ requires employer input |
| Starts per employer | 0 | ❌ **no Starts surface exists** |
| Clinician profile reuse | 0 | ❌ not instrumented |

**Four of ten are instrumented.** The north star itself — starts enabled by reuse
— has neither a surface nor an event. That is the single largest gap between the
strategy and the product, and it is recorded as gap #1 in the
[IA audit](./information-architecture-audit.md).

---

## What would make this plan fail

1. **Choosing a beachhead by intuition rather than by employer access.** On
   current evidence, access is the deciding variable and it is the one the
   codebase cannot answer.
2. **Building the loop before anyone can be verified.** Apply is correctly gated;
   with no verification path, a correctly-gated door is still a closed one.
3. **Measuring activity because it is easy.** Profiles created will move first and
   fastest, and it is not the north star.
4. **Adding a concept.** The vocabulary sprawl the strategy diagnoses was created
   one reasonable noun at a time.
