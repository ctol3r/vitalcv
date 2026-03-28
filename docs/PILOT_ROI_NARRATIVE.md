# VitalCV Pilot — ROI Narrative

> Use this in pilot conversations to quantify the problem and frame the value.
> The "real system output" section is drawn from live vitalcv.com data (2026-03-28).
> Cost figures are conservative estimates — adjust with actual buyer data.

---

## The TTS Cost Model

### Why Time to Start Matters

Every day a credentialed clinician cannot start represents:
- A shift that is unstaffed or covered by locum/overtime at premium cost
- A recruiting investment that has not yet yielded return
- A patient-access gap at high-census periods

For a 300-bed hospital system running 10 new clinician starts per month, credentialing delay is a recurring, measurable, and preventable cost.

### Conservative Cost Estimates

| Variable | Conservative | Moderate | High |
|---------|-------------|----------|------|
| Avg TTS delay attributable to lookup phase | 2 days | 5 days | 7 days |
| Monthly credentialing volume | 5 | 10 | 15 |
| Physician daily opportunity cost | $1,200 | $1,500 | $2,000 |
| **Annual avoidable delay cost** | **$144,000** | **$900,000** | **$2,520,000** |

> "Delay attributable to lookup phase" is the time between a hiring decision and completing the initial federal source verification (NPPES, OIG, PECOS). VitalCV targets this specific window — not the full credentialing lifecycle.

---

## What the Real System Shows (Live Data: 2026-03-28)

### Clinician: ARDALAN ENKESHAFI — NPI 1003000126

Pulled from: `GET /api/trust-state/1003000126` at 22:29 UTC, 2026-03-28

**Result in under 15 seconds:**

| Source | Status | Time |
|--------|--------|------|
| NPPES Identity | ✅ Checked — identity confirmed | ~3 sec |
| OIG/LEIE Sanctions | ✅ Clear — no exclusion record | ~4 sec (parallel) |
| PECOS Enrollment | ✅ Checked — enrolled (quarterly) | ~1 sec |
| State Board Licensure | ⚡ Stale — requires refresh | (expected in pilot) |

**Trust Band:** L2 (Credentialed) · **Trust Score:** 67/100 · **Blockers:** None

**What this replaces manually:**
- NPPES portal lookup: ~20 minutes
- OIG/LEIE portal lookup: ~20 minutes
- PECOS portal lookup: ~30 minutes
- Assembly + documentation: ~20 minutes

**Manual total:** ~90 minutes → **VitalCV:** ~7–15 seconds

---

## The Proof Story (Template — Fill In After Real Pilot Run)

> Replace all [PLACEHOLDER] fields with real data after running pilot cases.

**[Org Name]** needed to credential **[INSERT ROLE]** for **[INSERT CONTEXT]**.

Their existing process: manual lookups across NPPES, OIG/LEIE, and PECOS portals, followed by manual documentation assembly. Estimated time for this phase alone: **[INSERT_MANUAL_HOURS] hours per case**.

With VitalCV: entered the NPI, received a source-backed readiness snapshot in **[INSERT_SECONDS] seconds**. All three federal sources resolved in parallel. The result was shared via a passport link with the credentialing team.

**Employer action taken:** [Proceed / Request Refresh / Route to Review]  
**Start date confirmed:** [YES / NO / PENDING]  
**TTS — before:** [INSERT_DAYS] days (estimated, employer baseline)  
**TTS — after:** [INSERT_DAYS] days (measured, first readiness check to start)  
**TTS delta:** [INSERT_DAYS] days faster ([INSERT_%] reduction)

---

## ROI at Scale (Illustrative Projections)

> These are models, not guarantees. The pilot exists to replace these estimates with real data.

### Scenario 1: Small Credentialing Team (5 starts/month)

- TTS reduction: 2 days/case
- Annual cases: 60
- Opportunity cost per day: $1,200
- **Annual value: ~$144,000**
- Annual VitalCV cost at scale: TBD (pilot is free)

### Scenario 2: Mid-size Health System (10 starts/month)

- TTS reduction: 5 days/case
- Annual cases: 120
- Opportunity cost per day: $1,500
- **Annual value: ~$900,000**

### Scenario 3: Large System / Staffing Agency (15 starts/month)

- TTS reduction: 7 days/case
- Annual cases: 180
- Opportunity cost per day: $2,000
- **Annual value: ~$2,520,000**

---

## What We Honestly Do NOT Claim

| Claim | Reality |
|-------|---------|
| State board verification is automated | **No.** Access-required in pilot. Clearly labeled. |
| Full credentialing lifecycle is replaced | **No.** VitalCV targets the initial federal lookup phase only. |
| TTS is guaranteed to drop | **Not yet.** The pilot measures this — we start with a hypothesis. |
| PECOS is always real-time | **No.** PECOS refreshes quarterly. May show PENDING between cycles — this is expected and documented. |

Honest limitations are documented in the passport UI. We do not hide gaps.

---

## Competitive Positioning

| | VitalCV | Manual Process | Medallion / VerifyMD |
|---|---------|---------------|---------------------|
| Federal source lookup time | **15 sec** | 60–90 min | Hours to days |
| Sources covered (pilot) | NPPES, OIG/LEIE, PECOS | Separate portals | Varies |
| State board (pilot) | Access-required — clearly labeled | Manual | Varies |
| Portable result | Yes — shareable passport | No | Sometimes |
| Integration required | **No** | N/A | Yes |
| Audit trail | Yes — timestamped source evidence | No | Sometimes |
| Pricing model | TBD (pilot is free) | Staff time only | Contract-first |

> The state board gap is real and acknowledged. Do not compete on it. It will be closed in post-pilot with per-state access agreements.

---

## The Pilot Ask

"Give us your current TTS estimate — how many days does your initial verification phase typically take? We will run 3–5 real NPIs, generate passports, walk your team through the review, and measure TTS against that baseline. If the delta is zero, you have lost 20 minutes of your team's time. If it is what we expect, you have a data-backed case for expanding the workflow."

**Pilot terms:**
- No contract required
- No integration required
- Free for the pilot period
- 3–5 cases, 2–4 week window
- TTS measured from first readiness check to confirmed start

Contact: pilots@vitalcv.com | https://vitalcv.com
