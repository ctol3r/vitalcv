# VitalCV 30-Day PSV Readiness Pilot

## The Buyer Problem
Healthcare staffing and credentialing leaders lose revenue, candidates, and operational capacity while applications wait in a black box. Today, an application sits for 10-40 days before missing information is identified, causing delayed start dates, lost placements, and burned-out credentialing coordinators.

## The Pilot Promise
Measure your true "time-to-action" baseline. VitalCV runs alongside your existing workflow to capture NPI identity from NPPES, federal exclusion posture from OIG LEIE, Medicare FFS public enrollment posture from PECOS, and one configured state licensure lane. We package the result into a deterministic proof pack with an audit event per export, so you can see — against your own baseline — how much "days at risk" time gets surfaced before your credentialing committee opens the file. We do not replace PSV; we show you what is decision-grade, what is partial, and what still needs PSV on day zero.

## Pilot Scope
* **Target Volume:** 10–30 clinician applications.
* **Duration:** 30 days.
* **Cost:** Small no-charge structured pilot. No invoice during the 30-day window. Commercial terms are only discussed after the KPI wrap-up, and only if both sides want to continue.

## Included Sources (What is Live)
* **Identity spine:** NPPES confirms NPI identity and public registry fields (name, specialty taxonomy, enumeration date). NPPES does **not** validate license status; licensure remains a state-board lane.
* **Federal exclusions:** OIG LEIE federal exclusion check against the latest available source release. Not a real-time OIG feed — we record the source-release date used for each check.
* **Public Medicare posture:** PECOS public enrollment posture / Medicare FFS public enrollment data. Not the real-time PECOS portal — we record the public-release date.
* **Authority:** One selected state licensure lane where institutional access or a public board API is available.

## Excluded / Partial Areas (What is Not Live)
* We **do not** replace Primary Source Verification (PSV).
* We **do not** replace your credentialing committee's final privileging decision.
* **SAM.gov is not integrated yet; OIG LEIE is included.** We also do **not** check NPDB, DEA registration, ABMS board certification, or CAQH.
* **NPDB self-query evidence expires after 45 days** and is a future lane — it is not covered by the current pilot scope.
* We **do not** claim real-time Nursys or FSMB access without an explicit institutional agreement.
* We **do not** issue production DIDs or Verifiable Credentials (the trust container operates in Mock/Dev mode for this pilot).

## Success Metrics
* **Time to First Signal:** From NPI submission to the first source-backed readiness signal.
* **Automated Source Lanes Hit:** Number of configured lanes (NPPES / OIG LEIE / PECOS public / selected state board) that returned a check state during the window.
* **Proof-Pack Export Coverage:** Share of in-scope clinicians for whom a proof pack (JSON / ZIP / PDF) was generated.
* **Days-at-Risk Surfaced:** Time between "file entered VitalCV" and "packet ready for reviewer" measured against the buyer's own baseline. Reported as a delta, never as a guaranteed saving.

## Timeline (30 days)
| Phase | Days | Who leads | Outputs |
| :--- | :--- | :--- | :--- |
| **Kickoff & scope sign-off** | Day 0 – Day 2 | VitalCV Solutions | Signed scope doc, named review operator, baseline captured (or honest "not tracked") |
| **NPI intake & ingest** | Day 2 – Day 5 | VitalCV + Buyer | 10–30 NPIs loaded, source lanes running (NPPES / OIG LEIE / PECOS / selected state board) |
| **Review window** | Day 5 – Day 25 | Buyer review operator | Employer review decisions recorded against each packet; proof-packs exported as needed |
| **KPI report + wrap-up call** | Day 26 – Day 30 | VitalCV | Startability timeline deltas, refresh-request counts, proof-tier distribution, limitations log, 30-minute review call |

No measurement starts before the scope document is signed. Pilot can be paused by either party at any phase.

## Buyer Responsibilities
1. Provide a roster of 10–30 real clinician NPIs (no other PII required).
2. Designate one hiring/credentialing team member to act as the primary review operator.
3. Provide your current baseline numbers (time-to-start days, applications per month) or acknowledge they are not tracked.
4. Conduct one 30-minute review call at the end of the pilot to walk through the KPI report.

## VitalCV Responsibilities
1. Run NPI-linked readiness checks.
2. Assemble the current passport packet.
3. Open employer review actions with an immutable audit context.
4. Generate a verifiable JSON/ZIP/PDF Proof-Pack with explicit mock/dev trust-container tracking.
5. Provide a Startability/KPI report comparing pilot performance to your baseline.

## Expected Outputs
* **Employer Review Surface:** A per-clinician view of lane states (Identity, Safety, Authority, Enrollment) with freshness and limitation notes; refreshed on each source check, not a live feed.
* **Proof Packs:** JSON, ZIP, and PDF packets containing source-backed evidence, limitation notes, and deterministic artifact / audit hashes. An ARTIFACT_EXPORTED audit event is written before each packet leaves the platform.
* **KPI Report:** Startability timeline deltas, refresh-request counts with owner attribution, and proof-tier distribution — reported against the buyer's own baseline, never against a generic industry figure.

## Disqualifying Conditions
* The buyer expects VitalCV to fully automate the final credentialing committee decision.
* The buyer requires full integration with legacy on-premise ATS/HRIS systems during the 30-day pilot.
* The buyer is unwilling to share 10–30 clinician NPIs for measurement.
