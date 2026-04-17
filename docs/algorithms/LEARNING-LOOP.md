# Learning Loop (The Feedback Engine)

VitalCV is not a static rules engine. To become intelligent, it must capture the delta between what it recommended (Recognition), what the human operator did (Acceptance), and what ultimately happened (Outcome).

## 1. Inputs (System Recommendation)
At the moment an employer evaluates a Passport, the system provides a snapshot:
- `decisionState`: The synthesized posture (e.g., `CHECKING`, `PARTIAL`, `DECISION_GRADE`, `BLOCKED`).
- `trustSignals`: The array of verified/missing sources.
- `sourceCoverage`: The specific registries hit and their response confidence.

## 2. Human Response (Operator Decision)
The human subjective action taken in response to the system recommendation:
- `ACCEPTED`: Human chose to hire.
- `FLAGGED`: Human rejected or escalated due to risk.
- `REQUESTED_DATA`: Human refused to decide until more coverage was provided.

## 3. Real-World Outcome
The ultimate downstream reality of that hiring decision:
- `START_ACTIVATED`: The clinician successfully began work with no issues.
- `START_FAILED`: The clinician failed to start (e.g., failed a manual downstream check).
- `DRIFT_OCCURRED`: The clinician started, but experienced a severe drift event (e.g., OIG hit) shortly after.

## 4. The Learning Signal (Mismatch Detection)
The delta between system recommendation, human action, and outcome generates the learning signal.

### Positive Alignment (✔)
- System: `DECISION_GRADE` → Human: `ACCEPTED` → Outcome: `START_ACTIVATED`
- System: `BLOCKED` → Human: `FLAGGED` → Outcome: `START_FAILED`

### Negative Mismatch (❌ - Learning Opportunity)
- **False Positive**: System: `DECISION_GRADE` → Human: `ACCEPTED` → Outcome: `START_FAILED` or `DRIFT_OCCURRED` *(System was too confident)*
- **False Negative**: System: `PARTIAL` → Human: `ACCEPTED` → Outcome: `START_ACTIVATED` *(System was too cautious)*
- **Human Override**: System: `DECISION_GRADE` → Human: `FLAGGED` *(Human saw risk the system missed)*

## 5. Storage: DecisionLearningEvent
Every decision path is persisted as a structured learning record.

```json
{
  "clinicianNpi": "1487664858",
  "recognitionState": "DECISION_GRADE",
  "humanAction": "ACCEPTED",
  "outcome": "START_ACTIVATED",
  "mismatchDetected": false,
  "mismatchReason": null,
  "timestamp": "2026-04-14T18:00:00Z"
}
```
