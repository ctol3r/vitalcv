# Beachhead decision packet

**Date:** 2026-08-05 · **Amended:** 2026-08-14 · **Status:** **SUPERSEDED — see founder decision below**

> **Supersession notice.** The 2026-08-05 hospital-based APP-only beachhead is
> retained below as decision history. The founder broadened the initial pilot on
> 2026-08-14 to employed physicians and advanced practice providers at health
> systems. That later decision is canonical.

The Wave 1077 instruction is explicit: *"Do not independently declare VitalCV 'for
every clinician'"* and *"Evaluate each using only verifiable evidence and current
product fit."* This packet therefore separates what the product can demonstrate
from what only the founder can answer, and does not fill the second category with
plausible-sounding numbers.

---

## The measurement that dominates everything else

Production, queried 2026-08-05:

| Fact | Value |
| --- | --- |
| Opportunities in the database | **6** |
| Of those, distinct organizations | **6** |
| Specialty spread | Internal Medicine 2 · Psychiatry 1 · Cardiology 1 · Family Medicine 1 · Critical Care 1 |
| `npi_ownership` rows (verified clinicians) | **0** |
| Live source lanes | 1 read live · 1 monthly snapshot · 1 quarterly snapshot · 1 access-gated · 2 not read |

**Read that honestly:** there is no segment in which VitalCV currently has demand
density. Six listings across six organizations is one listing per employer. No
beachhead can be selected on the basis of existing match data, because there is
essentially none.

This inverts the usual framing. The question is not *"where is our data
strongest?"* — it is *"where can 5–10 employers be signed fastest, so that data
exists at all?"* That is a founder-access question, not a product-analytics one.

---

## Criteria: what is knowable today

| # | Criterion | Knowable from evidence? | Source |
| --- | --- | --- | --- |
| 1 | NPI coverage | ✅ Yes | NPPES covers all six segments; Type-1 individual records exist for every one |
| 2 | Repeated employer hiring | ⚠️ Partly | Industry-structural, not measurable in-product |
| 3 | Cost of hiring delay | ❌ Founder input | No VitalCV data |
| 4 | Fragmentation of professional info | ⚠️ Partly | Structural; the more state licences and privileges, the more fragmented |
| 5 | Match-data availability | ✅ Yes — **and it is ~zero everywhere** | Query above |
| 6 | Employer access | ❌ **Founder input** | Only the founder knows the warm-intro map |
| 7 | Founder credibility and network | ❌ **Founder input** | — |
| 8 | Sales-cycle difficulty | ⚠️ Partly | Structural |
| 9 | Regulatory / credential complexity | ✅ Yes | Directly proportional to what VitalCV must verify per clinician |
| 10 | Prove starts and reuse in 90 days | ✅ Yes | Requires repeat hiring + short time-to-start |

**Six of ten criteria cannot be scored from evidence available to me.** Anything I
asserted about them would be invention dressed as analysis.

---

## The six candidates, on what is knowable

Scored only on criteria 1, 5, 9, 10 and the structural reading of 2, 4, 8.
`—` means "requires founder input".

| Candidate | NPI coverage | Repeat hiring | Fragmentation | Reg. complexity | Provable in 90 days | Employer access |
| --- | --- | --- | --- | --- | --- | --- |
| **Hospital-based APPs** (NP/PA) | Full | **High** — systems hire APPs continuously | High (state licence + collaborative agreements + privileges) | Moderate | **High** — short time-to-start, high volume | — |
| **Behavioral health prescribers** | Full | **High** — chronic shortage, constant hiring | High (DEA + state + telehealth multi-state) | **High** (controlled substances) | Moderate | — |
| **Locum physicians** | Full | **Very high** — repeat by definition | **Very high** — many states, many facilities | High (multi-state licensure) | **Very high** — assignments are short and repeat | — |
| **Primary care in shortage markets** | Full | Moderate | Moderate | Moderate | Low — long recruit-to-start | — |
| **Radiology groups** | Full | Low–moderate | Moderate | Moderate (multi-state for teleradiology) | Low | — |
| **Anesthesia groups** | Full | Moderate | Moderate–high | Moderate | Moderate | — |

Note the product's current data does not favour any of these: its 6 listings are
Internal Medicine, Psychiatry, Cardiology, Family Medicine and Critical Care —
five different segments, none of them a cluster.

---

## Two finalists

The instruction asks for no more than two.

### Finalist 1 — Locum physicians

**Why it fits the north star best.** The north-star metric is *clinician starts
enabled by a reused profile*. Locums is the only segment where **reuse is the
job**: a locum clinician starts repeatedly, at multiple facilities, within a
90-day window. Every other segment requires waiting for a second hire to observe
reuse at all.

It is also the segment where the clinician's pain is sharpest and most literal —
"I do not want to fill all this out again" is a locum's weekly experience — and
where fragmentation across states and facilities is greatest.

**The risk:** multi-state licensure is the hardest verification surface, and
VitalCV's licensure lane is currently `access-gated`, not read live. The product
would be promising portability in exactly the dimension it cannot yet verify.

### Finalist 2 — Hospital-based advanced practice providers

**Why it is the safer of the two.** High, continuous, repeat hiring by
multi-site systems; short time-to-start; a single employer relationship can
produce many starts, which makes 5–10 design partners sufficient to prove the
loop. Regulatory complexity is real but lower than behavioural health's
controlled-substance surface.

**The risk:** reuse is observed across *hires*, not within one assignment, so a
90-day reuse proof is tighter than for locums.

### Not recommended now

- **Behavioral health prescribers** — strong hiring demand, but the DEA and
  multi-state telehealth surface is the most regulated place to debut a
  portable-identity claim.
- **Primary care in shortage markets**, **radiology**, **anesthesia** — all
  viable later; each has a longer recruit-to-start cycle, which makes proving
  starts inside 90 days unlikely.

---

## What the founder must supply before this can be decided

1. **Employer access** — which of the two segments has warm introductions to 5–10
   organizations that hire repeatedly? This is criterion 6, it is unknowable from
   the codebase, and on current evidence **it is the deciding variable.**
2. **Whether the licensure gap is acceptable for locums.** If VitalCV cannot read
   state licensure live, a locum-first promise is thinner than it sounds.

The homepage stays segment-neutral until this is answered — the instruction
requires it, and on the evidence above, narrowing now would be guessing.

---

## Decision (founder, 2026-08-05)

**Hospital-based advanced practice providers** is the initial controlled
beachhead. Rationale as given: lower access dependency than locums, repeat
hiring behaviour, meaningful credential and application friction, a clearer
employer-side pilot path, better fit with current product and public-source
coverage, and a faster route to proving reuse **without making access-gated
licensure the critical path** — which was precisely the risk flagged against the
locum option above.

**Locum physicians** is retained as the second beachhead, once state-board and
licensure access is operationally reliable.

Pilot recruitment expresses the segment more narrowly:

> Hospital-based nurse practitioners and physician assistants changing employers
> or taking an additional role.

This is an operating hypothesis to validate. **No market dominance or density
claim** — the 6 opportunities / 0 verified clinicians measured above is evidence
that clinician activation is the bottleneck, not evidence about any segment.

---

## Superseding founder decision (2026-08-14)

The initial market is **employed physicians and advanced practice providers at
health systems**. The primary buyer is **provider recruitment leadership**.
Credentialing, medical staff services, HR, and onboarding remain essential
participants, but VitalCV does not enter their credentialing or privileging
category.

Pilot controls:

- Recruit 5–10 health-system design partners and launch with the first 2–3 that
  can provide real cases and signed data/integration scope.
- Permit physician and APP participation, while limiting each partner to no more
  than two service lines.
- Measure employer-confirmed actual first day as the primary outcome.
- Keep the pilot free under signed scope and keep production billing disabled.
- Do not infer market density, speed, savings, credentialing completion, or
  integration support from the selected beachhead.

This decision supersedes only the APP-only scope. The evidence cautions and the
prohibition on unsupported market claims above remain in force.
