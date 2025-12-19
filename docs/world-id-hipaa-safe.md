# World ID (Phase 1) — HIPAA-Safe Usage (Authn-Only)

## Scope (Phase 1)

World ID is used **only** as an **optional Proof-of-Personhood / anti-bot factor**. It is **not** used for:

- clinical identity proof
- credential issuance authority
- payments / chat / chain migration
- linking to protected health information (PHI)

Users can proceed without World ID.

## Data Handling Guarantees

### What VitalCV does NOT store

- **No biometrics** (iris images / codes)
- **No raw World ID proof payloads** persisted in DB (no ZK proof, no raw nullifier, no raw merkle root)
- **No PHI** as part of World ID verification

### What VitalCV DOES store (hash-only audit)

On successful or failed verification, VitalCV writes an **`AuditEvent`** that includes:

- **event type**: `WORLD_ID_VERIFIED` / `WORLD_ID_VERIFY_FAILED` (and `WORLD_ID_VERIFY_ATTEMPT` when not configured)
- **hash-only digests**:
  - `nullifierHashHash = sha256(nullifier_hash + ":" + WORLD_ID_AUDIT_PEPPER)`
- **non-sensitive metadata**: `action`, `verificationLevel`, `consent` (boolean)

This digest is designed to be **non-reversible** and **non-correlatable across systems** when a secret pepper is used.

## Consent Requirements

World ID verification must be **explicitly opt-in**:

- The user must acknowledge that verification is optional
- The user must consent before submitting a proof
- The UI must never imply this is a licensed clinician credential

## Backend Endpoint

VitalCV exposes:

- `POST /worldid/verify`
- `GET /worldid/status`

This endpoint:

- validates the request body
- calls the World ID verification API (configured by env)
- records a hash-only audit event
- returns `{ verified: true/false, auditRef }`

## Environment Variables

Set these on the backend deployment:

- `WORLD_ID_APP_ID`: World ID app identifier (used to build default verify URL)
- `WORLD_ID_VERIFY_URL` (optional): override verify URL; default is `https://developer.worldcoin.org/api/v1/verify/{WORLD_ID_APP_ID}`
- `WORLD_ID_AUDIT_PEPPER` (recommended): secret pepper for hashing digests (prevents cross-system correlation)

If `WORLD_ID_APP_ID` is missing, the endpoint returns **501 Not Implemented** (no bypasses / no mocks).

## Security Notes

- Never log the raw proof payload.
- Treat `WORLD_ID_AUDIT_PEPPER` as a secret (Vault / KMS / platform secrets).
- Do not include PHI in `signal`. Prefer an **unlinked** signal (or omit it).


