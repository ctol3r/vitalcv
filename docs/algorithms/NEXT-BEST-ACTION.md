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

## 4. Output Structure
Every evaluation returns a standardized payload:
```json
{
  "action": "PROCEED",
  "reason": "Clinician is DECISION_GRADE with no active drift.",
  "confidence": 0.95
}
```
*Confidence* degrades based on data staleness or conflicting historical learning signals.