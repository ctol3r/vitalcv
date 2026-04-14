# Learning Outcome Resolution

To create a closed-loop learning system, every employer action must be tracked to its final real-world outcome. The `decisionSignalService` captures the initial decision (PENDING). This document defines how that record is resolved.

## 1. State Transitions
A LearningEvent (tracking an employer decision) begins in a `PENDING` state regarding its real-world outcome. It transitions to a terminal state based on downstream events.

### Valid Transitions
- `PENDING` → `START_ACTIVATED` (The clinician successfully began work)
- `PENDING` → `DRIFT_OCCURRED` (A severe anomaly was detected before or after start)
- `PENDING` → `START_FAILED` (The candidate failed downstream manual checks and was rejected post-acceptance)

## 2. Trigger Points

### Trigger: Start Activation
- **Source**: `OmegaOrchestrator` (or downstream HRIS sync) creating a `StartActivation` node with state `ACTIVE` or `READY_TO_START`.
- **Action**: Locate the most recent `EMPLOYER_ACCEPTED` learning record for this NPI/Employer pair and update its outcome metadata to `START_ACTIVATED`.

### Trigger: Hard Drift
- **Source**: `DriftReactionHandler` processing a `HARD_DRIFT` event.
- **Action**: Locate the most recent `EMPLOYER_ACCEPTED` learning record for this NPI and update its outcome metadata to `DRIFT_OCCURRED`. Also logs the source of the drift (e.g., `OIG_LEIE`).

## 3. Update Rules
To maintain data integrity in `prismaEventStore`:
1. **Single Resolution**: A learning record's outcome must be updated exactly ONCE. Once terminal (`START_ACTIVATED`, `DRIFT_OCCURRED`), it cannot revert to `PENDING`.
2. **Immutability of Base Event**: The core event (`eventType`, `occurredAt`, `decision`) is never overwritten. Only the `metadata.outcome` field is updated.
3. **No Duplication**: Do not create a *new* learning record to represent the outcome. Update the existing decision record so the full cycle (System Recommendation → Human Action → Real Outcome) exists in a single row for analytics.