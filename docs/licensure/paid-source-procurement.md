# Paid-source procurement — the physician unlock

Status: **authorized to propose, 2026-08-09** ("if something cost money but we
need it to reach goals then propose those paths"). Each path below still needs
an explicit founder GO before any agreement is signed or money moves.
Companion to [L1-access-diligence.md](./L1-access-diligence.md), which holds
the full vendor question lists; this document adds verified pricing, the
sequencing argument, and what each dollar unlocks.

All prices verified against vendor-published material on 2026-08-09. Sources
inline. Where a price could not be verified, the row says so.

---

## The one-paragraph argument

The goal is dominating clinician hiring and faster credentialing. Nurse-side
verification is free (Nursys) and the nurse-side market is crowded (Incredible
Health, Vivian, Nomad, Trusted — all non-physician). Physician hiring is
agency-dominated, product-undisrupted, and gated by exactly one thing: physician
PSV costs money and takes months. The free-sources-only rule therefore
protected us from the only spend that opens the uncontested market. Under
verify-once-reuse-everywhere economics — which our clinician-owned receipt +
consent-ledger architecture uniquely supports — the spend is one-time per
clinician and amortizes across every employer they ever apply to, while every
competitor re-charges per employer.

## Tier 0 — $0, blocked on paperwork, not money

| Item | Cost | Blocked on |
|---|---|---|
| Nursys e-Notify for Institutions | **Free** | Institutional enrolment (NCSBN) + the open nurse-SSN/DOB privacy decision |
| Nursys QuickConfirm | **Free** | Nothing — public lookup |

The entire nurse/APRN licensure lane goes live for $0. This precedes every
paid item below and should not share a queue with them.
(Endorsement verification at $30/license/jurisdiction is a different product —
nurses moving states — and is not needed.)

## Tier 1 — decision-grade physician file, ≈$59 one-time per physician

| Source | Price | What it verifies | Monitoring |
|---|---|---|---|
| FSMB Physician Data Center — Standard | **$9.00**/physician | Licensure + disciplinary, all member boards | 12 months included |
| FSMB PDC — Premium | **$12.00**/physician | + ABMS board certification | 12 months included |
| AMA Physician Profile — initial | **$41.00** (+$3 for 2-yr monitoring) | Medical school, GME/residency, specialty, licenses, NBME, ABMS | optional add-on |
| AMA Profile — reappointment | $18 (1–9) / **$10** (10+) | refresh | — |
| AMA PA Profile | **$24.00** | physician-assistant education/training | — |
| NPDB self-query (clinician-initiated) | **$3.00** | malpractice payments, adverse actions, exclusions | n/a |

**≈$56–59 per physician for the elements that take a credentialing office weeks
by hand.** Reappointment cadence ≈$25/yr. Budget shape:

| Cohort | One-time cost |
|---|---|
| 50 (pilot) | ~$2,950 |
| 250 | ~$14,750 |
| 1,000 | ~$59,000 |

Reference points for the same dollar: one agency physician placement fee is
$30–50k; one physician-day lost to credentialing is commonly estimated at
$7–10k of billable revenue.

### The NPDB lane is architecturally special

VitalCV is likely not an NPDB-eligible entity, and does not need to be. The
practitioner **self-query** is identity-proofed (ID.me), returned as a
**digitally certified PDF whose signature breaks on any alteration**, and
**explicitly forwardable by the practitioner to third parties**. That is a
clinician-owned, tamper-evident, independently re-verifiable credential
artifact — our architecture, already existing inside a federal system, at $3.
Engineering work: an intake lane that accepts the clinician's certified PDF and
verifies the embedded certifying signature. No agreement required.

## Tier 2 — the acceptance layer (NCQA CVO certification)

Verification nobody accepts is a demo. NCQA CVO certification is what lets a
medical staff office accept our file instead of redoing it.

- Direct fees are small (standards $285; survey tool $390+; customized
  application/survey fees on top — exact quote required from NCQA).
- **Eligibility bar 1:** $1–2M errors & omissions insurance.
- **Eligibility bar 2:** ≥6 months of verification operations, covering ≥50% of
  contracted practitioners, **before applying**.

**Consequence: the six-month clock only starts when Tier 1 starts.** Every
week of deferral on FSMB/AMA moves the earliest possible CVO certification
date a week. This is the sequencing argument for deciding now.

## Open diligence (could change the plan)

1. **FSMB eligibility for a platform/CVO** — PDC access was expanded to
   hospitals; whether our category qualifies needs the call in L1 Track A.
   This is the one Tier-1 path with eligibility risk, not just price.
2. ECFMG/EPIC for IMG physicians (~¼ of the US physician workforce) — not yet
   priced; own line item.
3. Real DEA registration validation (current adapter infers from NPPES, which
   is not verification).
4. AMA annual-subscription pricing at roster scale (quotes at ≥$900/yr spend).

## Recommended sequence

1. **Now, $0:** Nursys institutional enrolment + settle the SSN/DOB privacy
   question. Nurse lane live.
2. **On GO, ~$3k:** FSMB PDC + AMA Profiles for a 50-physician pilot cohort;
   NPDB self-query added as a clinician-initiated onboarding step.
3. **Same month:** E&O insurance quote + NCQA overview call, so Tier 2 begins
   the day eligibility is met.
4. **Month 2+:** scale Tier 1 with the pilot; start the CVO application at the
   six-month mark.

Costs above are data-source costs, previously excluded by the 2026-07-13
cost rule; that rule was amended 2026-08-09 to allow exactly this proposal.
