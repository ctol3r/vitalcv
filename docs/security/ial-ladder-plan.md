# IAL Ladder Plan

Status: foundation plan only. VitalCV does not currently assert IAL2 or IAL3.

## Current Foundation State

| Level | VitalCV State | Evidence |
|---|---|---|
| No IAL claim | Current state | NPI lookup and self-attested identity inputs exist, but neither binds a real person to the identifier. |
| IAL2 candidate | Future state | Requires procured vendor, government ID proofing, liveness or equivalent binding, consent, retention policy, manual review fallback, and audit-safe receipt evidence. |
| IAL3 candidate | Future state | Requires a substantially higher assurance process that is outside this foundation and likely outside the first procurement wave. |

## Ladder

1. Keep mock vendor as the only application-visible provider until procurement closes.
2. Select vendor through security, privacy, legal, and product review.
3. Define minimum data collection, retention, deletion, and redaction rules.
4. Integrate government ID and liveness flow behind a non-production feature flag.
5. Add audit-safe proofing receipt shape with no raw ID image, selfie, biometric template, or secret.
6. Add manual review fallback and failure-state copy.
7. Run a formal assurance review before any IAL2 claim.

## Hard Stops

- No IAL2 / IAL3 claim before vendor procurement closes.
- No production proofing status from the mock vendor.
- No raw government ID image, selfie, biometric template, or vendor secret in logs, receipts, or operator surfaces.
- No board movement past the foundation tier from engineering-only scaffolding.

## Board Ceiling

These rows stay at approximately 30% until vendor procurement closes. This is a procurement decision, not engineering.
