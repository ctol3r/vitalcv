# VitalCV Canon

Recognition -> Acceptance -> Start

## Frozen Doctrine

1. Recognition must be anchored by at least one valid PSV receipt.
2. Acceptance must reference an existing valid Recognition.
3. Start must reference an existing Acceptance and CRS >= 80.
4. Any missing, expired, or revoked receipt fails closed.

## Receipt-First Rule

- Every trust decision must derive from immutable receipts.
- No trust computation is allowed without receipt validation.
- Receipt freshness (TTL) and revocation are enforced before readiness.

## Revocation-First Rule

- Revocation always overrides prior positive state.
- If any receipt is revoked or expired, trust-state is RED and start is blocked.

## CRS Determinism

- CRS is computed from canonical inputs only:
  - receipt validity
  - acceptance presence
  - threshold rules
- CRS has no mutable side effects, no hidden state, and no imperative overrides.
- Employers consume trust-state derived from CRS as the single decision surface.

## Canonical SDK

- Domain primitives are consumed from `@vitalcv/shared`.
- Applications must not redefine canonical domain types.

## Substrate Mapping

- `credential` -> Recognition root anchor
- `status-list-bitstring` -> revocation/freshness receipt anchors
- `delegated-issuance` -> federated issuance receipt anchors
- `identity-binding` -> holder binding receipt anchors
