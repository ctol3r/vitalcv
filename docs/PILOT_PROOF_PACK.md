# VitalCV — Pilot Proof Pack

**For:** Healthcare Employer — Credentialing Director / Staffing Ops
**From:** VitalCV Pilot Team
**Date:** 2026-03-28
**Source:** Real system outputs — vitalcv.com / Railway backend

---

## The Problem We Solve

Healthcare employers manually cross-reference NPPES, OIG/LEIE, PECOS, and state board portals before a clinician can start. This takes 7–21+ days per case. Every day delayed is a shift unfilled and, at a typical physician opportunity cost of $1,200–$2,000/day, real revenue not earned.

VitalCV runs those checks in under 15 seconds from a single NPI and delivers a source-backed readiness snapshot your team can act on immediately.

---

## Real Clinician Example — NPI 1003000126

> The following data was pulled live from the VitalCV system on 2026-03-28 at 22:29 UTC.
> Source: `GET /api/trust-state/1003000126`

**Clinician:** ARDALAN ENKESHAFI  
**NPI:** 1003000126  
**Trust Band:** L2 (Credentialed)  
**Trust Score:** 67/100

### Readiness Snapshot

| Source | State | Confidence | Detail |
|--------|-------|------------|--------|
| NPPES Identity | ✅ **Checked** (live) | 99% | Identity verified against CMS NPI Registry |
| OIG / LEIE Sanctions | ✅ **Clear** (live) | 95% | No exclusion record found in current monthly LEIE CSV |
| CMS PECOS Enrollment | ✅ **Checked** (live) | 95% | Quarterly enrollment confirmed active |
| State Board Licensure | ⚡ **Stale** | 25% | Licensure evidence is stale — requires refresh |

**Blockers:** None  
**Review Required:** No  
**Next Actions:** Refresh licensure proof (state board access required for this pilot)

**Checked at:** 2026-03-28T22:29 UTC  
**Ingest time:** ~7 seconds for NPPES + OIG parallel run

---

## What the Employer Sees

When the readiness passport is shared, your credentialing team sees:

```
ARDALAN ENKESHAFI — NPI 1003000126
Trust Band: L2 · Score: 67/100

Identity           ✓ Checked     NPPES — CMS NPI Registry
Sanctions          ✓ Clear       OIG/LEIE — No exclusion found
Enrollment         ✓ Checked     CMS PECOS — Enrolled (quarterly)
State Licensure    ⚡ Stale       Refresh required — state board access pending
```

**Employer Actions Available:** Proceed / Request Refresh / Route to Review

---

## Contrast: Blocked Clinician Example — NPI 1841498016

Not all lookups show a clean result. This is intentional.

| Source | State | Detail |
|--------|-------|--------|
| NPPES Identity | ⚠️ **Not Verified** | NPPES returned no active identity record for this NPI |
| OIG / LEIE | 🔒 Gated | Cannot check — identity match required first |
| PECOS | 🔒 Gated | Not checked — blocked by identity failure |
| State Board | 🔒 Gated | Not checked |

**Trust Band:** L0 · **Score:** 0/100  
**Blockers:** Identity not verified  
**Employer action:** Route to Review — do not proceed without manual identity confirmation

This is the honest state. VitalCV does not hide gaps or invent data. An employer reviewing this case knows exactly why it is blocked and what needs to happen next.

---

## What Changed

| Before VitalCV | With VitalCV |
|----------------|--------------|
| Manual lookup: NPPES portal (~20 min) | Automated: NPPES check in ~3 seconds |
| Manual lookup: OIG/LEIE portal (~20 min) | Automated: OIG/LEIE check in ~4 seconds parallel |
| Manual lookup: PECOS portal (~30 min) | Automated: PECOS quarterly check in ~1 second |
| State board: varies by state (30 min–hours) | State board: **access-required in pilot** — still manual, but clearly flagged |
| Results assembled manually: ~90 min per case | Results delivered: **~7–15 seconds** |
| No shared audit trail | Shared passport link with timestamped source evidence |

---

## What Got Faster

**Immediate lookup phase:** 90 minutes → 15 seconds (for NPPES + OIG + PECOS)

The state board gap is documented and honest. VitalCV does not claim to replace state board verification in this pilot. It eliminates the federal source lookup phase — the bottleneck that delays the *start* of credentialing review.

---

## What Blocker Disappeared

**The "I need to look all of this up" blocker.**

Before: Your credentialing team opens 3–4 government portals, enters the NPI manually in each one, screenshots or copies the results, then assembles a picture.

After: One NPI input at vitalcv.com delivers a pre-assembled, timestamped, source-attributed readiness snapshot in seconds. The employer team can review and act without any data assembly.

---

## Measurable Delta

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Federal source lookup time (NPPES + OIG + PECOS) | ~90 min | ~15 sec | **-99.7%** |
| Sources checked per lookup | 1–3 (manual, sequential) | 3 (automated, parallel) | Coverage maintained |
| Audit trail | None | Timestamped passport with source attribution | ✅ New capability |
| State board | Manual (~30 min–hours) | **Not automated in pilot** — flagged transparently | Honest gap |

**Estimated TTS reduction hypothesis:** If 2–5 of the average 14-day credentialing delay is attributable to the initial federal lookup and assembly phase, VitalCV targets a 2–5 day TTS reduction per case. This will be measured during the pilot.

---

## What the Pilot Measures

We will track these metrics for your cases:

| Metric | Source |
|--------|--------|
| Readiness views | `readiness_revealed` events |
| Passport views | `passport_viewed` events |
| Review requests | `review_requested` events |
| Employer actions | `employer_action_clicked` events |
| Confirmed starts | Manual capture via pilot runbook |
| Time to Start (TTS) | Start date − first readiness check timestamp |

After 3–5 cases, we compare TTS against your current baseline.

---

## How to Start

1. Give us 3–5 real clinician NPIs from your active pipeline
2. We generate readiness passports in < 15 seconds each
3. Your credentialing team reviews via shared link
4. We capture outcomes and measure TTS together

**No integration. No contract. 20 minutes of your team's time.**

Contact: pilots@vitalcv.com | https://vitalcv.com
