# VitalCV Pilot Demo Script

> **The live walkthrough below is deferred.** There is currently no subject we are
> permitted to demo. Steps 1–3 require looking up a specific clinician, and we do not
> have an explicitly consented, founder-controlled clinician fixture. Until we do, use
> the founder-only video and the honest product narrative in
> [DEMO_SCRIPT_2026.md](DEMO_SCRIPT_2026.md).
>
> The step-by-step content is retained as the specification of what the walkthrough
> covers once a consented subject exists.

## Demo subjects — the rule

**There is no list of demo NPIs, by design.**

Every number in the NPI registry belongs to a real registrant. A demo may only look up a
clinician who has **explicitly consented** to their own record being shown — in practice,
a founder-controlled fixture or a pilot organization's own clinician who has agreed.

Two things that are never acceptable, both of which this document previously did:

- **Real NPIs presented as demo characters.** `1003000126` was listed as "Sarah Chen MD —
  READY (L3)". It is ARDALAN ENKESHAFI, M.D., a real physician who never consented. Nine
  other real NPIs were seeded the same way. Two of them (`1003000209`, `1003000217`) are
  Type-2 *organization* NPIs that had fabricated person profiles attached — an
  organization NPI is not a clinician identity at all.
- **Fabricated NPIs presented as real lookups.** `1942788324` ("Marcus Williams DO"),
  `1841498016` ("Priya Nair MD") and `1558395519` do not exist in NPPES. A live lookup of
  any of them resolves to nothing.

The seeded profiles have been removed from production and the seed script now refuses to
run against a non-local database.

---

## Step 1 — Enter NPI

> Requires a consented subject. Do not perform this step against an arbitrary real NPI.

**URL:** https://vitalcv.com

**What to say:** "Let's look up a clinician. I'll enter their NPI — this is the only input needed."

**What to do:** Enter the consented subject's NPI in the lookup field and submit.

**What this proves:** A single identifier triggers resolution against multiple federal sources — no manual data entry, no forms to fill.

**Expected state:** Loading indicator while NPPES, OIG/LEIE, and PECOS are queried (~10–15 seconds).

---

## Step 2 — Readiness Reveals

**URL:** Same page — results appear inline after lookup completes.

**What to say:** "Here's what we found. Each row is a primary source — NPPES for identity, OIG for sanctions, PECOS for Medicare enrollment. You can see exactly what resolved and what's still pending."

**What to do:** Walk through each source lane:
- **NPPES:** CHECKED — clinician identity confirmed (name, taxonomy, address)
- **OIG/LEIE:** CHECKED — no exclusion found
- **PECOS:** CHECKED or PENDING — Medicare enrollment status (quarterly refresh)
- **State Board:** ACCESS-REQUIRED — not yet available in pilot

**What this proves:** Source-backed verification, not self-reported data. Every lane shows its status honestly.

**Expected state:** Readiness summary with per-source status indicators. Overall state: READY / PARTIAL / BLOCKED.

---

## Step 3 — View Passport

**URL:** `/passport?npi=[NPI]` (or click "View Passport" from readiness results)

**What to say:** "This is the clinician's portable passport — a snapshot of everything we verified, organized by identity, sanctions, and enrollment. This is what your credentialing team would review."

**What to do:** Scroll through the passport sections:
- **Identity:** NPPES-sourced name, NPI, taxonomy, practice address
- **Sanctions:** OIG/LEIE check result and date
- **Enrollment:** PECOS status and last-checked timestamp

**What this proves:** A single, portable artifact replaces scattered lookups across multiple portals. Every field traces back to a source.

**Expected state:** Structured passport page with source attribution on each section.

---

## Step 4 — Request Employer Review

**URL:** `/review/request`

**What to say:** "Now I'll show you what happens when an employer needs to review this clinician. We create a review request with the NPI and context about why the review is needed."

**What to do:**
1. Click "Request employer review" or navigate to `/review/request`
2. Fill in: clinician NPI, employer context, purpose of review
3. Submit the form

**What this proves:** The employer review workflow starts from the same source data — no re-keying, no separate intake process.

**Expected state:** Confirmation screen with a `contextId` — this is the unique reference for this review request.

---

## Step 5 — Employer Review Surface

**URL:** `/review/[entityId]` (linked from the review request confirmation)

**What to say:** "This is what your credentialing director sees. Same source-backed data, but now with action buttons. They can proceed, request a data refresh, or route to a deeper review — all in one place."

**What to do:** Walk through the employer review page:
- Readiness snapshot (same source lanes from Step 2)
- Action buttons: **Proceed** / **Request Refresh** / **Route to Review**

**What this proves:** The employer makes a decision on verified data, not on a phone call or email chain. The action is recorded and timestamped.

**Expected state:** Review page showing readiness + source lanes + action buttons. If any source is PENDING or ACCESS-REQUIRED, it's visible here.

---

## Step 6 — Employer Action

**URL:** Same review page — action buttons trigger state capture.

**What to say:** "When the employer clicks an action, we record it — what they decided, when, and the readiness state at the time of that decision. This is how we measure whether better data leads to faster decisions."

**What to do:** Click one of the action buttons (for demo, use "Proceed").

**What this proves:** Every employer decision is captured with full context — readiness score, active blockers, timestamp. This feeds the Time to Start metric.

**Expected state:** Action confirmation. The decision event is captured in the pilot KPI pipeline.

---

## Step 7 — Start Outcome (Operator)

**URL:** POST `/api/internal/pilot/start-outcome` (API call, not a UI step)

**What to say:** "Once the clinician actually starts, we record the real start date. This closes the loop — now we can measure Time to Start: how many days from first readiness check to actual start."

**What to do:** (Operator performs this after the call, when a real start date is confirmed)

```bash
curl -X POST https://delightful-essence-production.up.railway.app/api/internal/pilot/start-outcome \
  -H "Content-Type: application/json" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" \
  -d '{
    "entityId": "[ENTITY_ID]",
    "startedAt": "[ISO_DATE]",
    "note": "Started after pilot review"
  }'
```

**What this proves:** End-to-end measurement from NPI lookup to start. The system automatically derives `daysFromFirstReview`, `daysFromShare`, and `daysFromReady` from prior events.

**Expected state:** 202 Accepted. Start outcome appears in `/pilot-ops` dashboard and KPI exports.

---

## Post-Demo: KPI Dashboard (Internal)

**URL:** `/pilot-ops` (internal, monitoring-secret required)

**What to say:** (Not for buyer — operator reference only) "All events from the demo are captured here. We can export KPI snapshots as JSON or CSV at any time."

**Available exports:**
- `GET /api/internal/pilot/kpis?days=30` — JSON snapshot
- `GET /api/internal/pilot/kpis/export` — CSV export
- `GET /api/internal/pilot/roi-report` — ROI executive summary

---

## Messaging Guardrails

| Say | Don't Say |
|---|---|
| "Verified from federal primary sources" | "AI-powered" |
| "Source-backed readiness snapshot" | "Fully automated credentialing" |
| "Head start on your credentialing process" | "Replaces your credentialing team" |
| "Transparent — you see exactly what resolved" | "Board certification verified" (state board is access-required) |
| "Measures Time to Start" | "Guarantees faster starts" |
| "This clinician consented to being shown" | "Here's a demo clinician" (while showing a real, non-consenting registrant) |
