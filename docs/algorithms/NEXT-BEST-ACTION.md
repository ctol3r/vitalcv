# Next Best Action (The Guidance Layer)

VitalCV uses the Next Best Action (NBA) engine to recommend the optimal path forward for an employer based on the real-time state of the credential network, historical learning signals, and drift events. 

## 1. Action Space
The system condenses all complexity into one of five mutually exclusive actions:
- `PROCEED`: Clear to hire / activate.
- `REQUEST_DATA`: Safe to evaluate, but missing critical verification. Ask candidate for more info.
- `REVERIFY`: Data is stale or Soft Drift detected. Run a fresh sync before acting.
- `ESCALATE`: Hard Drift or critical anomaly detected. Requires human compliance officer review.
- `HOLD`: Still processing or un-actionable state. Wait.

## 2. State Inputs
The recommendation is a pure function of:
- **Decision State**: The objective Recognition state (`DECISION_GRADE`, `PARTIAL`, `BLOCKED`, `CHECKING`).
- **Activation State**: Where the clinician is in the Start lifecycle (`NOT_STARTABLE`, `READY_TO_START`, `ACTIVE`).
- **Drift State**: Active entropy events (`SOFT_DRIFT`, `HARD_DRIFT`).
- **Learning History**: Context from the Feedback Engine (e.g., does this employer historically ignore `PARTIAL` warnings?).

## 3. Decision Rules
1. **The Entropy Rule**: Drift supersedes all other states.
   - `HARD_DRIFT` → `ESCALATE`
   - `SOFT_DRIFT` → `REVERIFY`
2. **The Blocking Rule**: If no drift, but the posture is `BLOCKED`.
   - `BLOCKED` → `ESCALATE` (if ACTIVE) or `HOLD` (if evaluating).
3. **The Data Gap Rule**:
   - `PARTIAL` → `REQUEST_DATA`
4. **The Activation Rule**:
   - `DECISION_GRADE` & `NOT_STARTABLE` → `PROCEED` (Clear to Accept)
   - `DECISION_GRADE` & `READY_TO_START` → `PROCEED` (Clear to Activate)
5. **The Async Rule**:
   - `CHECKING` → `HOLD`

## 5. Empirical Learning (Data-Driven Guidance)
While deterministic rules govern hard blockers, fuzzy decisions (like proceeding on a `PARTIAL` passport) are governed by empirical learning.

Before falling back to static rules, the NBA Engine queries `prismaEventStore` for historical outcomes of identical credential profiles.

### Data-Driven Overrides
- **High Historic Drift Risk:** If similar profiles resulted in `DRIFT_OCCURRED` > 15% of the time, the engine suppresses the `PROCEED` recommendation and downgrades to `REQUEST_DATA`, adjusting the confidence score dynamically.
- **Empirically Safe Gaps:** If a `PARTIAL` passport has historically resulted in `START_ACTIVATED` > 85% of the time without downstream issues, the engine overrides the static gap rule and recommends `PROCEED`.

Every NBA payload strictly indicates whether the recommendation was derived from deterministic logic or historical learning signals via the `derivedFromLearning` boolean.