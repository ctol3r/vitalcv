# VitalCV Pilot Brief

**MISSION:** Sell one truthful pilot that the current wedge can run end to end.

## Pilot Lock

| Dimension | Locked Choice | Why It Stays Locked |
| --- | --- | --- |
| Buyer | Northern California credentialing lead responsible for post-offer clinician onboarding | This buyer owns start-delay pain, can sponsor the pilot, and already has authority to move a packet into a real decision lane. |
| Workflow | Post-offer, pre-start clinician credentialing sprint on the canonical wedge | VitalCV is proving readiness for a real start decision, not replacing sourcing, recruiting, or the full credentialing stack. |
| Terrain | Northern California hospitals and multisite clinic groups | Keeps source expectations, compliance language, and launch operations honest. No nationwide implication. |
| KPI | **Interview-to-Start Velocity** = median days from first employer review to recorded start outcome | This is the only KPI that proves the wedge is reducing start delay instead of just producing cleaner dashboards. |
| Proof Story | NPI in, readiness appears, packet inspected, employer acts, audit confirmed | This is the shortest believable story that shows VitalCV removes restart work and leaves behind decision-grade evidence. |

## Buyer Problem

The buyer is not shopping for another broad credentialing platform. The buyer needs one trustworthy way to answer five questions fast:

1. Who is this clinician?
2. What is already proven from primary sources?
3. What is missing, stale, contract-gated, or not decision-grade?
4. Can my team accept, request refresh, or route to review right now?
5. Can I prove later who acted, from what packet, and when?

## Pilot Package

| Package Element | What It Means In Practice |
| --- | --- |
| What the buyer gets | One truthful packet, one canonical employer review route, and one scoped KPI loop tied to start outcomes. |
| What VitalCV runs | `/onboarding` -> `/passport/[id]` -> `/review/[entityId]` -> `/pilot-ops` plus packet export and audit confirmation. |
| What the buyer must bring | One credentialing lead sponsor, one operator lane, an approved pilot NPI cohort, and one owner for start-outcome capture. |
| What proves value | First value under 30 seconds, packet-to-decision under 5 minutes, and improved Interview-to-Start Velocity for the scoped cohort. |

## Pilot Promise

VitalCV gives that buyer one launch-safe operating loop:

1. Enter the clinician's NPI on `/onboarding`.
2. Show a readiness snapshot on `/passport/[id]` with explicit identity, blockers, freshness, and source coverage.
3. Open `/review/[entityId]` to inspect the same truth in employer language and export the packet.
4. Record one employer action: `Accept as head start` in the UI, or the honest fallback `Request refresh` or `Route to review`.
5. Confirm the action produced a visible audit record, then measure whether starts happened faster for the same scoped cohort.

## Why This Pilot Is Sellable

- It gives a credentialing lead usable value in the first session instead of forcing a long services project.
- It does not hide uncertainty; unsupported sources stay visibly `gated`, `pending`, `stale`, `unavailable`, `accessRequired`, `reviewRequired`, `notDecisionGrade`, or `previewOnly`.
- It turns packet review into a persisted employer action instead of another email thread.
- It leaves behind an audit record tied to the trust snapshot that existed at the moment of decision.
- It can be scoped by organization, pilot, workflow lane, and geography without inventing filtered outcomes from unscoped data.

## Proof Story — RN Credentialing for Per-Diem Shift

**Buyer:** Healthcare staffing agency credentialing lead.
**Clinician:** Registered Nurse available for per-diem shifts.
**Workflow:** RN credentialing for per-diem shift assignment.
**Primary KPI:** Time-to-Trusted-Start (TTS) — days from first employer review to confirmed shift start.

### The Before

The credentialing lead receives a per-diem RN candidate. To clear them for a shift, the team manually:
1. Looks up the NPI on the NPPES website to confirm identity and taxonomy.
2. Checks the OIG/LEIE exclusion list to confirm no sanctions.
3. Checks PECOS enrollment status for Medicare eligibility.
4. Calls or emails to verify state licensure status.
5. Assembles findings into an email or spreadsheet for the staffing coordinator.
6. The coordinator makes a start decision based on incomplete, possibly stale information.

This takes 3-10 business days. Every new facility repeats the process from scratch because no facility trusts another's verification.

### The After (Pilot Flow)

1. **NPI in** — Operator enters the RN's NPI at `/onboarding`. VitalCV resolves identity against NPPES, checks OIG/LEIE for sanctions, and queries PECOS for enrollment. State board shows `ACCESS_REQUIRED` (honest).
2. **Readiness appears** — `/passport/[id]` shows: identity VERIFIED (NPPES), sanctions CLEAR (OIG/LEIE), enrollment ENROLLED or NOT_FOUND (PECOS), licensure ACCESS_REQUIRED (state board). All in under 30 seconds.
3. **Packet inspected** — Employer opens `/review/[entityId]`, sees the same source-backed snapshot with freshness timestamps, and exports the evidence packet.
4. **Employer acts** — Credentialing lead clicks `Accept as head start` (or `Request refresh` / `Route to review` if gaps exist). Action is audit-logged with the trust snapshot at time of decision.
5. **Start captured** — When the RN actually starts a shift, operator records the start date via `POST /api/internal/pilot/start-outcome`. System derives TTS automatically.

**Result:** The staffing agency moves from 3-10 day manual lookups to a 30-second readiness snapshot and a 5-minute employer decision, with an auditable record of exactly what was checked and what wasn't.

### General Proof Story

Before VitalCV, the credentialing team restarts the review from scratch every time a clinician enters the queue. They chase source truth manually, reconstruct what is missing from memory, and defend downstream decisions without a clean receipt chain.

With VitalCV, the operator enters one NPI, gets a readiness state in under 30 seconds on the launch wedge, inspects an exportable packet, records an employer action on the same review surface, and leaves behind a visible audit record tied to that decision. When starts are later recorded, the pilot can show whether review-to-start time actually improved.

## Commercial Shape

The organization is buying workflow execution, not identity creation:

- verified pull utility
- monitoring refreshes
- packet / export utility
- integration utility
- pass-through government or registry fees at cost

The organization is not paying for:

- clinician participation
- issuer participation
- same-band repeat access to the same credential view
- marked-up government fees

## Explicit Non-Promises

This pilot brief does **not** imply:

- all-source coverage
- nationwide launch coverage
- NPDB / DEA / ABMS support
- live Nursys or FSMB support unless contract and connector are active
- automated public card checkout while pilot access is still routed through the current request-access flow
- general recruiting marketplace scope
- workflow automation outside the single credentialing wedge

## Pilot Success Standard

The pilot is working only if all of the following are true:

- Interview-to-Start Velocity improves for the scoped pilot cohort.
- First value appears in under 30 seconds for the approved pilot NPI flow.
- A buyer can inspect the packet and record a decision in under 5 minutes on the canonical route.
- Buyer actions are fully audit logged.
- Exported KPI data matches the live pilot scope.
- Operators can explain every unsupported source, pricing limit, and gating rule without ambiguity.

Anything outside this brief is out of scope until the launch gate is updated and re-approved.
