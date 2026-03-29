# VitalCV Pilot Pack — Index
**Last updated:** 2026-03-28
**Status:** Pilot-ready — all data from live system, no simulation

---

## What This Pack Is

Three documents for running a real pilot and talking to buyers. All grounded in the actual shipped wedge and real system outputs. No invented examples.

**One buyer.** Healthcare employer — credentialing director, staffing ops lead, or physician recruitment.  
**One workflow.** NPI → readiness snapshot → passport → employer review → start outcome.  
**One KPI.** Time to Start (TTS) — days from first readiness check to confirmed clinician start date.

---

## The Three Documents

### 1. `PILOT_PROOF_PACK.md` — Send to Buyers After a Demo
What it is: One-page proof pack showing real system output + before/after comparison.  
When to use: After a demo call. Send as a follow-up or leave-behind.  
Key claim: Federal source lookup phase: 90 min manual → 15 seconds automated. (Real data, NPI 1003000126, 2026-03-28.)  
What it honestly admits: State board not automated in pilot. TTS reduction is a hypothesis until measured.

### 2. `PILOT_ROI_NARRATIVE.md` — Use on Demo Calls
What it is: TTS cost model + real system evidence + proof story template + honest limitations.  
When to use: During a demo call to quantify the problem and anchor the conversation in numbers.  
Key numbers: $144k–$2.52M annual avoidable delay cost (conservative–high scenarios). All labeled as estimates.  
What it honestly admits: TTS reduction not proven until pilot completes. Cost model requires buyer's own baseline.

### 3. `PILOT_OUTREACH_SEQUENCE.md` — Drive Outreach to 10 Operators
What it is: 3-touch email/LinkedIn sequence + 10 target personas + 15-minute demo script.  
When to use: Before first contact. Drives the initial conversation.  
Key proof: NPI 1003000126 real output embedded in Touch 2. Real timestamps. Honest about state board gap.  
What it honestly admits: Tracking table is a template — fill in real contact data before use.

---

## Supporting Files (Also in This Branch)

| File | Purpose |
|------|---------|
| `PILOT_DEMO_SCRIPT.md` | Step-by-step demo script with 4 demo NPIs |
| `PILOT_BUYER_BRIEF.md` | One-page summary for cold intros |
| `PILOT_METRIC_DEFINITIONS.md` | Every KPI metric defined, real vs. placeholder noted |
| `REAL_PILOT_RUNBOOK.md` | Operator runbook for running a real pilot case |
| `REAL_PILOT_CHECKLIST.md` | Pre-flight checklist for day of pilot |
| `REAL_PILOT_EVIDENCE_TEMPLATE.md` | Evidence capture template per case |
| `scripts/pilot-kpi-snapshot.sh` | Pull KPI JSON from live system |
| `scripts/pilot-kpi-report.sh` | Human-readable KPI summary for buyer conversations |

---

## What's Missing Before Production Use

| Gap | Severity | Notes |
|-----|----------|-------|
| Real TTS data | HIGH | Proof pack has estimates only — fill in after first real pilot case |
| Confirmed buyer org name | MEDIUM | PILOT_PROOF_PACK.md header has placeholder |
| State board automation | LOW | Documented as coming — per-state access agreements pending |
| Post-pilot case study | MEDIUM | PILOT_PROOF_STORY.md template is ready; needs real data |

---

## Quick Start

1. Run `scripts/pilot-kpi-snapshot.sh <MONITORING_SECRET>` to get current KPI counts
2. Use `PILOT_OUTREACH_SEQUENCE.md` Touch 1 to contact first operator
3. Demo with `PILOT_DEMO_SCRIPT.md` (NPI: 1003000126 for clean path)
4. Send `PILOT_PROOF_PACK.md` as follow-up
5. After pilot case completes: fill in `REAL_PILOT_EVIDENCE_TEMPLATE.md` and update proof pack metrics
