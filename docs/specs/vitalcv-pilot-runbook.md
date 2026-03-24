# VitalCV Pilot Runbook

**MISSION:** Execute the first live pilot without widening scope or reintroducing demonstration theater. This runbook defines the exact operational boundaries, internal routes, and fallback behaviors for the pilot.

---

## 1. The Pilot Constraint Model

If a request falls outside these four parameters, it is not part of the pilot and must be rejected.

- **One Buyer:** Healthcare Facility Credentialing / Onboarding Operator.
- **One Workflow:** The Post-Hire Credentialing Sprint (from offer signature to fully cleared to start).
- **One KPI:** Interview-to-Start Velocity (Median days from first employer review to clinical start).
- **One Proof Story:** Instant, audit-ready verification cuts credentialing time by 40%, generating revenue earlier.

---

## 2. Required Environment Configuration

The live pilot requires a deterministic environment. Do not turn on features unless legal/business agreements are finalized.

- `REAL_NURSYS_ENABLED=false` (Set `true` only when institutional E-Notify is active)
- `FSMB_ENABLED=false` (Set `true` only when institutional agreement is signed)
- `OIG_LEIE_ENABLED=true` (Must be active for safety checks)
- `PECOS_ENABLED=true` (Must be active for billing eligibility)
- `MONITORING_SECRET="<secure-random-string>"` (Required for pilot-ops dashboard)
- `SEAL_TRAINING_EXPORT_ENABLED=false` (Not required for credentialing workflow)

---

## 3. Required Internal Routes

Operators must use these canonical routes during the pilot:

1. **Intake:** `/onboarding` (NPI-driven lookup)
2. **Passport Review & Readiness:** `/passport/[id]` (Internal/clinician view of readiness score & blockers)
3. **Employer Decision:** `/review/[entityId]` (The exact surface the buyer uses to securely review and accept)
4. **Ops Tracking:** `/pilot-ops?secret=XYX` (The internal dashboard tracking funnel and start velocity. *Do not share externally.*)

---

## 4. Fallback Behavior (Source Unavailable or Gated)

Operational reality dictates that sources fail or remain gated. When a primary source is unreachable:

- **Do Not Hallucinate:** The UI must natively reflect the failure.
- **Status Display:** The component must read `Gated`, `Unavailable`, or `Unchecked`.
- **Decision Grade Impact:** The lack of verification prevents a clean L3 Readiness Score until manually resolved or acknowledging by the employer.
- **Action:** The employer is prompted to "Upload Manual Resource" or "Accept with Exception" depending on their internal policy. The system must not automatically clear them without valid `sourceCoverage`.

---

## 5. KPI Definitions

Our single KPI is **Interview-to-Start Velocity**, broken down internally into funnel steps to track friction:

- **Packets Shared:** Count of distinct `/passport/[id]` URLs generated and sent to employers.
- **Reviews Opened:** Count of distinct employer views at `/review/[entityId]`.
- **Decisions Made:** Count of terminal employer actions (`Accept as Head Start`, `Reject`, `Hold`, `Route to Review`).
- **Median Days, Review to Decision:** Time between initial employer open and their recorded decision event.
- **Median Days, Review to Start:** (The Core KPI) Total elapsed time from first employer review to the recorded Start Outcome event.
- **Blocker Resolution Time:** Mean/median time to resolve explicitly raised credentialing blockers (`NPI_MISMATCH`, `NOT_FOUND`, etc.).

---

## 6. Demo Script (Grounded in Live Routes)

**WARNING:** Do not use `demo/command-center` or any legacy fake mock-ups. Use only the live canonical routes.

**Step 1. The Intake (30 seconds)**
* "The clinician has accepted the offer. We start credentialing instantly."
* Navigate to `/onboarding`. Enter a real NPI (or known dev NPI). Click submit.
* *Talking Point:* "The system is querying CMS, OIG, and state boards right now. No data entry required."

**Step 2. The Internal Readiness View (20 seconds)**
* Land on `/passport/[id]`.
* *Talking Point:* "We immediately see a Readiness Score and any active blockers. If there's an issue, we resolve it now, before the facility ever sees it."

**Step 3. The Employer Review (45 seconds)**
* Navigate to `/review/[entityId]`. 
* *Talking Point:* "This is what you, the credentialing operator, receive. A secure, trust-stacked packet."
* Scroll through the `FreshnessPanel`. Point out the timestamps and cryptographic certainty.
* *Talking Point:* "You don't need to re-verify this. It's primary-source verified and completely auditable."
* Click `Accept as head start`. 
* *Talking Point:* "Your decision is legally logged, and the clinician progresses instantly toward their start date."

---

*See `vitalcv-launch-gate.md` for pre-flight constraints. Never reintroduce demonstration theater.*
