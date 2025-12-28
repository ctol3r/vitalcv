# Pilot Narrative

## What this demo proves

- **Verifiable credentials lifecycle**: issuance, verification, revocation, and match telemetry captured as `MetricEvent` records with audit hashes.  
- **Role-scoped access**: issuer-only issuance/revocation, verifier-only verification/match logging, clinician-scoped credential views.  
- **Pilot safety mode**: copy/banners switch to “Pilot Health System” / “Pilot Clinician” with an explicit synthetic-data banner.  
- **Operational insight**: `/api/metrics/summary` and `/metrics` surface counts, latency (avg/p95), and completion % for pilot storytelling.  
- **Invite-driven onboarding**: invite acceptance creates org bindings and returns a signed token; early-access requests capture interest without passwords.  

## What it does **not** claim yet

- **No production PHI**: flows use synthetic/demo data only; no protected health information is stored or transmitted.  
- **No on-chain anchoring** (yet): audit hashes are local; ledger anchoring and key rotation policies are still in the backlog.  
- **No external identity proofing**: World ID is optional and disabled by default; no NPPES/NPI live corroboration in this flow.  
- **No SLA/HA guarantees**: demo services run in single-region mode without HA or disaster-recovery posture.  

## Where blockchain anchoring fits later

- Anchor Merkle roots of audit events (issuance/verify/revoke/match) to a ledger as append-only integrity proofs.  
- Use **StatusList2021** or equivalent for revocation status distribution; publish list hashes on-chain while keeping data off-chain.  
- Rotate DID keys (e.g., `did:web`, `did:key`) with KMS-managed signing and periodic on-chain attestations of key validity.  

## Metrics that matter in a real pilot

- **Speed**: time-to-verify (avg/p95) per role and per org; end-to-end time from invite acceptance to first verification.  
- **Completeness**: average completion % per match, and drop-off points in clinician onboarding.  
- **Trust**: verification success vs. revocation hits; audit coverage (events with hashes/anchors).  
- **Adoption**: invite accept rate, early-access request volume, and active org counts.  

## Usage

- Enable pilot mode with `?pilot=true` or `NEXT_PUBLIC_PILOT_MODE=true` to switch labels/banners.  
- Pull live numbers from `/api/metrics/summary` or the `/metrics` page for screenshots.  
- Use invite tokens via `/api/invite/accept` to generate issuer/verifier access without passwords.  
