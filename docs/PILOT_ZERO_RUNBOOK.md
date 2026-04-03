# PILOT ZERO RUNBOOK
**Purpose:** Execute the first real pilot. One clinician. One packet. One employer decision. One measurable TTS reduction.
**Last updated:** 2026-04-03

---

## Prerequisites

- [ ] Railway backend is live and warm (hit `/health` first)
- [ ] vitalcv.com loads (Vercel frontend)
- [ ] You have a real NPI number from a real clinician
- [ ] You have an employer contact willing to make an Accept/Reject decision

---

## Step 1: Collect the NPI

**Who provides it:** The clinician, the employer, or you (public data — NPIs are not PHI).

**How to find one:**
- Ask the employer: "Give me one NPI you're currently credentialing."
- Or look up by name: https://npiregistry.cms.hhs.gov/search

**Validation:** Must be a 10-digit number. Verify it returns data:
```
curl https://delightful-essence-production.up.railway.app/api/identity/{NPI} \
  -H "x-organization-context: direct-share"
```

**Expected:** 200 with `firstName`, `lastName`, `credential`, `specialties`, `practiceStates`.

**If 502:** Service is cold-starting. Hit `/health` first, wait 15 seconds, retry.

---

## Step 2: Trigger Backend Ingest

**What this does:** Queries NPPES, OIG/LEIE, PECOS, SAM.gov, OpenAlex, State Board (gated), Nursys (gated) for this NPI. Writes claims to the database. Computes trust state.

```
curl -X POST https://delightful-essence-production.up.railway.app/api/ingest/{NPI} \
  -H "x-organization-context: direct-share" \
  -H "Content-Type: application/json"
```

**Expected:** 202 with `{ runId, npi, status: "running" }`.

**If 502:** The ingest orchestrator may exceed Railway's request timeout on cold start. Workaround:
1. Hit `/health` and wait 15 seconds for warmup
2. Retry the POST
3. If still 502, the trust-state engine will compute from existing artifacts (identity + previous claims)

**SSE stream (optional):** After getting a `runId`, you can stream progress:
```
curl https://delightful-essence-production.up.railway.app/api/ingest/{runId}/stream \
  -H "Accept: text/event-stream"
```

---

## Step 3: Verify the Passport

```
curl https://delightful-essence-production.up.railway.app/api/passport/{NPI} \
  -H "x-organization-context: direct-share"
```

**Expected fields:**
- `public.name` — Real clinician name from NPPES (e.g., "ARDALAN ENKESHAFI, M.D.")
- `public.trustBand` — L0/L1/L2/L3 or GREEN/YELLOW/RED
- `public.readinessScore` — 0–100
- `public.shareUrl` — e.g., `https://app.vitalcv.com/p/{NPI}`
- `credentials[]` — Array of verified credentials
- `sanctions.status` — CLEAR / POSSIBLE_MATCH / EXCLUDED

**Minimum for pilot:** Name is correct, trustBand is not L0, sanctions status is present.

---

## Step 4: Generate the Employer Review URL

The employer review surface is at:
```
https://vitalcv.com/review/{NPI}
```

This page loads the passport data and presents a binary decision card:
- **Trust band** (HIGH / MEDIUM / BLOCKED)
- **3 bullets** (Identity, License, Safety)
- **Actions:** Accept / Reject / Request Refresh

**Alternative — shareable public profile:**
```
https://app.vitalcv.com/p/{NPI}
```

**Embeddable badge (SVG):**
```
https://delightful-essence-production.up.railway.app/api/passport/{NPI}/embed.svg
```

---

## Step 5: Send to Employer + Get Decision

### Email Script

Subject: **VitalCV Pilot — Clinician Readiness Check**

```
Hi [Name],

We ran a credential readiness check on [Clinician Name] (NPI: [NPI]).

Here's their live credential passport:
[Review URL]

You'll see their trust score, source coverage, and sanctions status — all pulled from federal databases (NPPES, OIG, PECOS) as of today.

Two questions:
1. Based on this, would you Accept or Reject this clinician for your open role?
2. How long does your current credentialing process take for someone like this?

That's it. Takes 30 seconds.

— Chris
pilots@vitalcv.com
```

### What We're Measuring

| Metric | How | Target |
|---|---|---|
| **Time to employer decision** | Timestamp: email sent → Accept/Reject received | < 24 hours |
| **Current TTS baseline** | Ask employer: "How long does your current process take?" | Capture their answer |
| **TTS with VitalCV** | Time from NPI entry to employer Accept | < 15 minutes (our side) |
| **TTS reduction** | Baseline minus VitalCV time | ≥ 3 days |

---

## Step 6: Record the Outcome

After the employer responds, log the result:

```markdown
## Pilot Zero — [Date]

- **NPI:** [NPI]
- **Clinician:** [Name, Credential]
- **Employer:** [Org name, contact name]
- **Trust Band:** [L0/L1/L2/L3]
- **Trust Score:** [0-100]
- **Sanctions:** [CLEAR/POSSIBLE_MATCH/EXCLUDED]
- **Source Coverage:** [X/Y sources checked]
- **Employer Decision:** [Accept/Reject/Needs More Info]
- **Time to Decision:** [X hours/days]
- **Employer's Current TTS Baseline:** [X days]
- **TTS Reduction:** [X days]
- **Notes:** [Any feedback, issues, surprises]
```

Save to: `docs/PILOT_ZERO_RESULTS.md`

---

## Known Issues & Workarounds

| Issue | Impact | Workaround |
|---|---|---|
| Railway cold start (502s) | First request after idle fails | Hit `/health`, wait 15s, retry |
| Ingest 502 on cold start | POST /api/ingest times out | Warm service first; trust-state still computes from existing artifacts |
| Passport shows seed name ("Dr. Sarah Chen") | Wrong name on passport | Fix deployed to main (commit 80fc2f4d); awaiting Railway redeploy. Verify with `/api/identity/{NPI}` which returns real NPPES name |
| State board = GATED | Licensure not real-time verified | Expected — no state board API agreements yet. Trust score capped at L1. Document this for employer |
| Nursys = GATED | Nursing license not verified | Expected — Nursys requires access agreement |

---

## Abort Criteria

Stop the pilot and fix first if:
- [ ] `/api/identity/{NPI}` returns 500 (backend crash)
- [ ] `/api/passport/{NPI}` returns no data (empty response)
- [ ] `/review/{NPI}` returns blank page (frontend crash)
- [ ] Trust score is 0 for a known-active clinician (scoring engine broken)

---

## Post-Pilot

If Pilot Zero succeeds:
1. Write up `PILOT_ZERO_RESULTS.md` with exact metrics
2. Use the result as the proof story for the next 3-5 pilots
3. The employer's Accept + TTS baseline becomes our first real data point
4. Everything else (pricing, roadmap, features) follows from this one result
