# FINAL SYSTEM CLOSURE & PILOT EXECUTION PLAN

This plan merges the dual directives received: **SYSTEM CLOSURE** (100% End-to-End Functional Reliability) and **PILOT EXECUTION** (Real-World Usage & Dashboards). 

This is the final stabilization wave. No new features. No speculative UI. Pure execution of the existing loops to production readiness.

## PART 1: SYSTEM CLOSURE (The "No Dead Ends" Mandate)
1. **Core Loop Hardening:** Ensure `Homepage → NPI → Passport → Decision → Review → Action` executes flawlessly. If an NPI is invalid or missing, it must return a clean, explainable error UI (no 500s).
2. **Claim & Blocker Coverage:** Audit the `DecisionEngine` to ensure every claim type (Identity, License, Sanctions, Enrollment) maps to a strictly typed, severity-ranked Blocker with a clear resolution path. No empty arrays or generic "Missing Data" errors.
3. **State Consistency & Explainability:** Ensure the `TrustGraph` matches the `DecisionSnapshot` exactly. The "Why this score" UI must perfectly reflect the backend graph traversal.
4. **Performance & Security:** NPI lookup < 5s. Graph < 1s. Ensure zero PHI leakage and strict auth enforcement on all mutating endpoints.

## PART 2: PILOT EXECUTION ENGINE
1. **Pilot Entry Flows:** Scaffold the clean entry points for the upcoming pilot cohort: `/pilot/employer` and `/pilot/clinician/onboarding`.
2. **Employer Pilot Dashboard (`/pilot/employer/dashboard`):** Build the operational control plane showing submitted providers, decisions, blockers, and statuses.
3. **Closing the Apply Flow:** The "Apply with Passport" button must actually generate the `ProviderPacket` (Decision, Blockers, Evidence, Sources) and notify the employer. No fake apply loops.
4. **Employer Action System & Feedback:** Employers must be able to explicitly Accept, Request Update, or Flag an issue. This action must persist and feed back into the system's learning loop.

## PART 3: THE GREAT PURGE
1. Delete all remaining placeholder UI, unused components, dead endpoints, and partial flows. If it doesn't work, it doesn't exist.

---
*Execution will occur in an isolated worktree to ensure a pristine final state before merging to main.*
