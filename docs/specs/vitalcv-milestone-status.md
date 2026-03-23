# VitalCV Milestone Status

**MISSION:** Provide a strict, honest accounting of what works, what is stubbed, and what is required to cross the launch gate for the pilot demo.

---

## 1. M1: The Core Architecture
**Status:** Closed / Partial with Evidence

**The State of Truth:**
- Sub-components are implemented but must be locked tight.
- We have the base repository structure, authentication scaffolding, and UI framework in place.
- The concept of "Provider Models" and credential structures exist in code.

---

## 2. M2: The Employer Review & Trust Mechanics
**Status:** Closed / Partial with Evidence

**The State of Truth:**
- The Employer Decision Screen and Passport profiles have been drastically refined.
- UI elements now reflect truth-status (e.g., `verified`, `requires_review`, `unresolved_blocker`).
- Jargon has been stripped from the system (e.g., "Trust Layer" removed).
- The `TrustLabel` component is finalized to reflect actual source truth.

---

## 3. M1.5: Remaining Work (Technical Debt & Edge Constraints)
**Objective:** Solidifying M1 and M2 paths before executing new infrastructure.

**Remaining Actions:**
- **Strict Data Purge:** Ensure zero "aspirational" code paths or hard-coded assumptions remain.
- **Source Pipeline Hookup:** Finalize exactly which API routes correctly return the defined states in the Coverage Matrix, even if partial.
- **Error Propagation:** If a source fails or goes offline, the UI must gracefully downgrade to "Unavailable for Sync" rather than crashing or showing false positives.

---

## 4. M3: Remaining Work (The Pilot Launch Execution)
**Objective:** Building only what is strictly required to execute the pilot brief.

**Remaining Actions:**
- **The "NPI → Packet" Workflow Engine:** Implement the automated job that takes an NPI, runs the coverage matrix, and compiles the final printable/exportable packet.
- **Employer Head-Start Dashboard:** Finalize the single view where the buyer (Credentialing Leader) evaluates the synthesized truth packet.
- **Velocity KPI Telemetry:** Implement simple tracking logs (timestamps) from "Candidate Imported" to "Packet Accepted."

---

## 5. Launch Gate Criteria (Pilot Demo Edition)
To pass the gate and show this product to a live buyer, the following must be unequivocally true:

1. **The NPI Input works reliably:** A known, real NPI yields a structurally correct summary page without manual intervention.
2. **The Source Coverage Matrix is enforced:** No source is shown as "VERIFIED" unless it is mechanically verified via a live API or web-scraping script (or explicit demo mock-data flagged tightly).
3. **The Export Packet is generate-able:** The output must be something a staffing coordinator can legally and operationally hand to their compliance team.
4. **No Jargon:** Zero internal language appears on the screen ("AI-driven matching," "Megawave Platform," etc.).
5. **Clear Failure States:** If we cannot verify a state license, the UI calmly presents "Requires Institutional Access/Manual Verification," proving we respect the boundaries of our capabilities.
