# VitalCV Demo Script

**MISSION:** Show one believable buyer story on the canonical wedge with no demo theater.

**Last updated:** 2026-03-30 (Wave 5)

## Demo Promise

This demo proves one thing: a credentialing / onboarding operator can move from NPI intake to a persisted employer action without restarting the review from scratch.

## Pre-Demo Checklist

- [ ] Use the live wedge only: `/onboarding` -> `/passport/[id]` -> `/review/[entityId]`.
- [ ] Select the NPI per [`vitalcv-pilot-runbook.md` §4.1](./vitalcv-pilot-runbook.md). For simulation use a check-digit-invalid fixture (`1558395519`, `1942788324`, `1841498016`); for a live pilot use the NPI the customer provides. Never a real NPI that is not the customer's own.
- [ ] Have a stopwatch ready for first-value and packet-to-decision timing.
- [ ] Confirm backend is reachable: `GET https://delightful-essence-production.up.railway.app/api/health`
- [ ] Confirm packet export is available from the live review surface.
- [ ] Confirm the review surface exposes the audit confirmation state before the session starts.

## Demo Rules

- Do not use archived `/demo/*` routes.
- Do not claim any source is live unless the UI shows it as checked.
- If a source is gated, pending, stale, unavailable, access-required, review-required, not decision-grade, or preview-only, say that plainly.
- Do not narrate roadmap. Narrate only what the product is showing now.

## Time Box

| Step | Duration | Running Total |
| --- | --- | --- |
| Opening | 20s | 0:20 |
| NPI in | 45s | 1:05 |
| Readiness appears | 60s | 2:05 |
| Packet inspected | 75s | 3:20 |
| Employer acts | 45s | 4:05 |
| Audit confirmed | 35s | 4:40 |
| Close + ask | 20s | 5:00 |

Total target: about 5 minutes.

---

## Opening

Say:

> VitalCV is not trying to replace your entire credentialing stack. It gives your onboarding operator one truthful packet and one auditable decision path so you can move a start decision forward faster.

---

## Step 1 — NPI In

**URL:** `https://vitalcv.com/onboarding`

**What operator does:**
1. Navigate to `/onboarding`.
2. Enter the NPI selected in the pre-demo checklist (a check-digit-invalid fixture for simulation, or the customer's own NPI for a live pilot).
3. Submit and start the stopwatch.

**Say:**

> We start with one NPI. VitalCV resolves identity and begins the launch-spine checks — NPPES for identity, OIG/LEIE for sanctions, PECOS for Medicare enrollment. If a source is not available, it stays visibly limited instead of getting papered over.

**What happens on screen:**
- NPI input accepted.
- Loading state while NPPES, OIG/LEIE, and PECOS are queried (~10-15 seconds).
- Transition into the passport flow.

**Proof point:** This starts the first-value timer. Target: useful readiness snapshot in under 30 seconds.

---

## Step 2 — Readiness Appears

**URL:** `https://vitalcv.com/passport/[id]` (auto-navigated from onboarding, or click "View Passport")

**What operator does:**
1. Stop the first-value timer.
2. Walk through each source lane.

**Say:**

> This is the first value moment. The operator can already see who the clinician is, what is checked, what is still blocked, and what needs more work.

**Walk through each source lane:**

| Source | Expected State | What to Say |
| --- | --- | --- |
| NPPES | CHECKED — identity confirmed | "Name, taxonomy, practice address — sourced directly from CMS" |
| OIG/LEIE | CHECKED — no exclusion found | "Checked against the federal exclusion list — this clinician is clear" |
| PECOS | CHECKED or PENDING | "Medicare enrollment status. If it shows PENDING, that's the quarterly refresh cadence — honest, not a bug" |
| State Board | ACCESS_REQUIRED | "State licensure requires per-state agreements we don't have yet for this pilot. It says so plainly" |

**What the employer sees:**
- Clinician identity (name, NPI, taxonomy, address).
- Readiness score and level (L1/L2/L3).
- Blocker list with explicit reasons.
- Source coverage states with timestamps.

**Proof point:** The product is useful before everything is perfect because it makes uncertainty explicit.

---

## Step 3 — Packet Inspected

**URL:** `https://vitalcv.com/review/[entityId]` (from employer review link or "Request employer review")

**What operator does:**
1. Open the employer review surface.
2. Walk through identity, safety, authority, eligibility, freshness sections.
3. Click `Export packet` to download the evidence packet.

**Say:**

> The employer is not getting a sales summary. They are getting the same source-backed readiness picture, plus the ability to export the packet they are relying on. The packet contains the exact same source states as this screen — if something shows as pending here, it shows as pending in the export.

**What the employer sees:**
- Readiness summary with overall score.
- FreshnessPanel showing 4-layer freshness.
- Source coverage with per-source status.
- Packet export button (JSON or ZIP format).

**Proof point:** Packet truth must match review truth. If the packet says more than the screen, the demo is invalid.

**API evidence:** `GET /api/employer-review/:entityId/packet` returns the same `sourceCoverage` object visible in the review UI.

---

## Step 4 — Employer Acts

**URL:** `https://vitalcv.com/review/[entityId]` (same review page)

**What operator does:**
1. For a clean demo NPI: click `Accept as head start`.
2. For a partial NPI: click `Request refresh` (honest next move when data is stale/missing).
3. For a blocked NPI: click `Route to review` (honest next move when human review is needed).

**Say:**

> The buyer has three honest choices: accept as head start, ask for refresh, or route to review. The value is that they can act from a truthful packet instead of restarting the whole verification process.

**What happens:**
- `POST /api/employer-review/:entityId/accept` (or `/request-refresh` or `/route-to-review`).
- `EmployerDecisionEvent` + `AuditEvent` written atomically before 2xx returned.
- Success confirmation appears on screen.

**Proof point:** Packet-to-decision target is under 5 minutes for a trained operator.

---

## Step 5 — Audit Confirmed

**URL:** Same review surface after action completes.

**What operator does:**
1. Wait for the success state.
2. Point directly at the visible audit record.

**Say:**

> The action is not considered real until the audit record is written. VitalCV shows the audit event ID and the trust snapshot that existed at the moment of decision. This is the receipt your compliance team needs.

**What the employer sees:**
- Success state with `Audit trail recorded`.
- `auditEventId` visible.
- Trust snapshot at time of decision.

**Proof point:** This is the launch-safe close. The buyer acted, and the system can prove who did what and when.

---

## Close + Pilot Ask

**Say:**

> That is the whole pilot: NPI in, readiness appears, packet inspected, employer acts, audit confirmed. If we then record starts against this same scoped cohort, we can measure whether Interview-to-Start Velocity actually improved.

**Pilot ask:**

> The pilot ask is simple: give us one credentialing lead, one scoped NPI cohort, one operator lane, and start-outcome capture for that same cohort. We will prove whether this wedge moves review-to-start faster.

---

## Expected Questions and Answers

| Question | Answer |
| --- | --- |
| "What sources do you check?" | "Three live federal sources today: NPPES for identity, OIG/LEIE for exclusions, and PECOS for Medicare enrollment. State licensure requires per-state agreements we're working on. We show what's checked and what isn't." |
| "What about NPDB?" | "NPDB requires an institutional subscription — we can't query it as a platform. It's not part of the current pilot. We're transparent about that in the passport." |
| "What about DEA / board certification?" | "Not integrated today. We won't claim we check something we don't. Those are on our roadmap, but right now the value is in the sources we actually have plus the honest visibility into what's missing." |
| "How current is the data?" | "NPPES and OIG/LEIE are near real-time. PECOS refreshes quarterly, so data can be up to 90 days old — we show the last-checked timestamp so you know exactly how fresh it is." |
| "What if a source is down?" | "It shows as unavailable, not as clear. We never paper over a source failure. You'll see the error state and can decide whether to wait or proceed with what's available." |
| "Can we do all 50 states?" | "Not yet. State board verification requires per-state access agreements. We're starting with specific states and building out. For the pilot, state board shows as access-required — honest about the limitation." |
| "How much does this cost?" | "Clinicians are free. Your organization pays per verified pull — the first access to a credential in a freshness band. Same-band repeat views are free. Government fees pass through at cost with no markup. We'll scope a pilot quote based on your cohort size." |
| "Can this replace our credentialing team?" | "No — and we're not trying to. VitalCV gives your team a head start by resolving what can be checked from primary sources, so they can focus on the parts that actually need human judgment." |
| "Is there a self-serve signup?" | "The pricing tiers are visible on our billing page, but pilot access currently routes through our team. We're not claiming live card checkout until it's actually built." |
| "What happens after the pilot?" | "If TTS improves for the pilot cohort, we expand: more NPIs, more source coverage as agreements come online, and integration with your existing workflow tools. But first we prove the wedge works." |

---

## Demo Failure Rules

Stop and reset the story if any of the following happen:

- The flow requires an archived `/demo/*` route.
- A source is described as verified when the UI does not show a checked result.
- Packet export disagrees with the review screen.
- The employer action succeeds without an audit confirmation.
- The operator needs unsupported narration to explain away a product gap.
- The first-value timer exceeds 60 seconds without visible readiness data.
- Any "imagine if" language is used to describe current functionality.
