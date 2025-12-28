# Runbook: Delegated Credential Attestations

## Scope

Operational guidance for the delegated attestation flow exposed by the API:

- `POST /credential/attest`
- `GET /attestations?status=pending`
- `POST /attestations/:id/approve`
- `POST /attestations/:id/reject`

## Preconditions

- API service is running with database access.
- Audit log storage is healthy (AuditEvent table).

## Submission Flow

1. Call `POST /credential/attest` with the required payload.
2. Confirm response includes `attestationId` and `status=ATTESTED`.
3. Verify audit event `AUDIT_ATTESTATION_SUBMITTED` exists.

## Review Flow

1. Call `GET /attestations?status=pending` to list pending items.
2. Approve:
   - `POST /attestations/:id/approve`
   - Expect status `VERIFIED`
   - Confirm audit event `AUDIT_ATTESTATION_APPROVED`
3. Reject:
   - `POST /attestations/:id/reject` with `{ "reason": "..." }`
   - Expect status `REJECTED`
   - Confirm audit event `AUDIT_ATTESTATION_REJECTED`

## Failure Modes & Mitigations

- **Invalid status filter** → 400 error. Confirm `status` is `pending|attested|verified|rejected`.
- **Non-existent attestation** → 404 error. Confirm `attestationId`.
- **Already reviewed** → 409 error. Do not re-review the same attestation.

## Monitoring Hooks

Track audit events:

- `AUDIT_ATTESTATION_SUBMITTED`
- `AUDIT_ATTESTATION_APPROVED`
- `AUDIT_ATTESTATION_REJECTED`

Alert if submission volume spikes or approvals stall.

## Rollback

If approvals were incorrect:

1. Create a replacement attestation.
2. Reject the erroneous record with reason.
3. Notify affected parties.
