# PR-B Crypto Receipt Verifier Superseded Note

Status: PR-B not rescued.

Reason: PR-B is superseded by merged PR #203 and PR #204. VitalCV now uses the ES256 asymmetric issuer/JWKS path plus the ES256 verifier flow on `origin/main`.

Rejected paths:
- HS256/shared-secret receipt verification is weaker than the merged ES256 asymmetric path and should not be rescued.
- Stub JWKS implementations are not production verifier evidence and should not be used to move completion-board scores.

Score impact: no board score movement.

