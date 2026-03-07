# ADR-0002: SD-JWT Verifiable Credentials over JWT-VC

**Date:** 2026-01-22  
**Status:** Accepted  
**Deciders:** VitalCV Engineering  
**Tags:** protocol, security, credentials

---

## Context

VitalCV issues healthcare credentials (medical licenses, board certifications, NPI attestations)
that must support selective disclosure — a clinician should be able to prove board certification
without revealing DEA schedule or home address.

We evaluated three VC formats:
1. W3C JSON-LD VCs — expressive but verbose; poor interop with mobile wallets
2. JWT-VCs — compact but no native selective disclosure
3. SD-JWT VCs — compact, selective disclosure built-in, HAIP-aligned

The OpenID4VP/VCI ecosystem has converged on SD-JWT VC as the preferred format for
high-assurance healthcare use cases.

## Decision

Use **SD-JWT VC** (`vc+sd-jwt`) as the primary credential format for VitalCV-issued credentials.

Selective disclosure is implemented via:
- Salted SHA-256 commitments for each claim field
- `_sd` array in the JWT payload containing disclosure digests
- Per-claim disclosure objects shared with the verifier at presentation time

Signing uses **ES256** (P-256) via the `jose` library. Credential verification checks
signature, expiry, revocation status, and disclosed claim integrity.

## Alternatives Considered

| Option | Description | Why Rejected |
|--------|-------------|--------------|
| W3C JSON-LD VC | RDF-linked; strong semantics | Poor wallet support; complex for mobile |
| Plain JWT-VC | Simple; widely supported | No selective disclosure; exposes all claims |
| AnonCreds (Hyperledger) | ZK-based selective disclosure | Complex deployment; limited ecosystem |

## Consequences

### Positive
- Native selective disclosure without complex ZK machinery
- HAIP (Healthcare Authorization Interop Profile) compliant
- Compatible with OID4VCI issuance and OID4VP presentation flows
- Compact wire format suitable for Apple/Google Wallet

### Negative / Trade-offs
- Less expressive semantics than JSON-LD (no RDF reasoning)
- SD-JWT spec still maturing (draft status as of implementation)
- Requires custom disclosure logic vs. library support

### Neutral / Notes
- `generateSelectiveDisclosure()` and `verifyCommitment()` are the primary entry points
- Disclosure salts are ephemeral — not stored server-side

## References

- [SD-JWT VC draft spec](https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-01.txt)
- `apps/api/backend/src/services/credentials/`
- Wave 103: Selective Disclosure implementation
