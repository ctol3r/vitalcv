# Trust State Engine

Wave 253 adds a deterministic trust-state service layer that evaluates holder readiness without changing existing routes.

## Evaluation Model

- Each required artifact is evaluated independently into `L0`-`L3`.
- `L0` means missing, unmapped, or blocked by revoked or suspended evidence.
- `L1` means only self-asserted evidence exists (`CandidateCredential` only).
- `L2` means primary-source evidence exists but is stale, PSV-window non-compliant, issuer-trust capped, or otherwise incomplete.
- `L3` means primary-source evidence is current, non-revoked, and trust-acceptable.

## Scores And Status

- Artifact score mapping:
  - `L0 = 0`
  - `L1 = 40`
  - `L2 = 75`
  - `L3 = 100`
  - revoked or suspended evidence forces `0`
- Requirement weights reuse employer requirement levels:
  - `L1 -> 1`
  - `L2 -> 2`
  - `L3 -> 3`
- Aggregate score is `sum(weight * artifactScore) / sum(weight)`, rounded to the nearest integer.
- Aggregate status:
  - `READY` when all required artifacts are `L3`
  - `CONDITIONALLY_READY` when no requirement is `L0`, but at least one is `L1` or `L2`
  - `NOT_READY` when any required artifact is `L0` or revoked

## Freshness Rules

- `identity_binding` and `npi_verification` rely on binding status only.
- `state_license` uses a 180-day freshness window.
- `board_certification` uses 365 days.
- `dea_registration`, `malpractice_insurance`, `malpractice_history`, `privileging_file`, and `bls_acls` use 90 days.
- `sanctions_clear`, `npdb_clear`, `background_check`, and `telehealth_agreement` use 30 days.
- Any `expiresAt` in the past marks evidence as expired.
- PSV non-compliance or elapsed PSV deadlines downgrade evidence to stale.

## Revocation And Fail-Closed Behavior

- Revoked or suspended verification artifacts always downgrade the matched requirement to `L0`.
- Missing, contested, or inactive DID bindings do not throw. The service persists a deterministic `NOT_READY` snapshot with identity-anchor warnings.
- Unmapped organization requirements also fail closed as `L0`.

## Compatibility Storage

- Snapshots persist through `VerificationArtifact` for this wave because no dedicated `trust_state_snapshots` table exists in the live Prisma schema.
- Synthetic snapshot rows use:
  - `source = TRUST_STATE_ENGINE_V2`
  - `status = readinessStatus`
  - `trustState = readinessLevel`
  - `rawPayload = full snapshot`
  - `checksum = deterministic hash of the snapshot payload`
- Legacy trust-state routes remain unchanged and do not read this new source.
