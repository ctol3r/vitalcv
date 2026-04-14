# REAL USAGE ACTIVATION PLAN (PILOT)

This plan executes the explicit mandate to activate real-world usage, stripping away anonymous/hypothetical flows in favor of strictly tracked `PilotUser` sessions and `FrictionLog` signals.

## PART 1: HARDEN PILOT ENTRY & SESSION CAPTURE
1. **Pilot Entry Points:** Harden `/pilot/employer` and `/pilot/clinician`. Ensure they load instantly with "Start pilot in 30 seconds" framing.
2. **Contact Capture:** Both flows must now capture Name, Email, and Org/Role. Anonymous pilots are disabled; users are persisted to a `PilotUser` table.
3. **Session Tracking:** Auto-create a `PilotSession` `{ userId, npi, type: clinician | employer, createdAt }` the moment an NPI is entered or an employer request is made.

## PART 2: FORCE LOOP COMPLETION & DECISION LOGGING
1. **Flow Completion Tracking:** Track the funnel: NPI entered → Passport viewed → Decision seen → Action taken. If incomplete, prompt the user. No silent drop-offs.
2. **Decision Logging:** Every decision must be stored: `{ npi, decision, blockers, timestamp, userId }`.
3. **Employer Actions:** Track and store `EmployerAction`s (accepted, rejected, requested refresh, flagged issue).

## PART 3: CAPTURE FRICTION & SIGNAL
1. **Friction Points:** Add simple inline feedback components ("What’s missing?", "What confused you?", "Why didn’t you proceed?") and store them in a `FrictionLog` table.
2. **"What to Fix" Signal:** For every blocked provider, return the top 3 fixes and the fastest path to ready. Log which fixes users actually attempt.
3. **Usage Metrics Engine:** Track total NPIs processed, decision distributions, completion rates, time to decision, and drop-off points. Expose this internally at `/pilot/metrics`.

## PART 4: PURGE & VERIFY
1. **Remove Non-Pilot Paths:** Disable or hide incomplete flows, unused routes, and confusing entry points. Focus exclusively on the pilot flows.
2. **Simulation:** Simulate 10 real NPIs and 3 employer users to ensure the full loop completes without dead ends or confusion.

---
*Execution will run in isolation to prevent colliding with the ongoing System Closure coding agent.*
