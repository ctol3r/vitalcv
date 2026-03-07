# ADR-0003: OpenID Federation for Cross-Network Trust

**Date:** 2026-02-01  
**Status:** Accepted  
**Deciders:** VitalCV Engineering  
**Tags:** protocol, federation, security

---

## Context

VitalCV's trust network must interoperate with external credentialing authorities
(Nursys for nursing licenses, CAQH for provider credentialing, state medical boards).
We needed a federation model that:

1. Allows VitalCV to assert trust in external issuers without requiring bilateral agreements
2. Supports trust chain verification across organizational boundaries
3. Aligns with emerging healthcare identity standards

Two primary models were evaluated:
- **DID-based federation** — decentralized, but ecosystem fragmented; poor tooling
- **OpenID Federation** — standards-based, REST-friendly, supported by HAIP

## Decision

Adopt **OpenID Federation 1.0** as the federation protocol for cross-network trust.

VitalCV acts as a Trust Anchor for its own issuer network. External networks (Nursys, CAQH)
are registered as federated entities with:
- `federationEntityId` — their entity identifier URI
- `federationTrustChain` — chain of signed entity statements
- `federatedAt` — timestamp of trust establishment

The `federationService` manages entity registration, metadata resolution, and trust chain
validation. The Global Trust Map differentiates federated nodes visually.

## Alternatives Considered

| Option | Description | Why Rejected |
|--------|-------------|--------------|
| Bilateral API agreements | Custom per-partner integrations | Unscalable; no standard |
| DID Federation | Decentralized trust via DID documents | Fragmented tooling; poor HAIP alignment |
| SMART on FHIR | Healthcare-specific but authorization-focused | Not a credentialing federation model |

## Consequences

### Positive
- Standard protocol reduces custom integration per partner
- Trust chain model enables transitive trust (VitalCV trusts Nursys → clinician trusts Nursys-attested credential)
- HAIP compliance (Wave 112) builds on this foundation

### Negative / Trade-offs
- OpenID Federation spec is complex; limited library support
- Requires metadata endpoint hosting per federated entity
- Trust chain validation adds latency

### Neutral / Notes
- Wave 113 implements federation metadata endpoints
- `federationService.ts` seeds Nursys and CAQH on startup

## References

- [OpenID Federation 1.0 spec](https://openid.net/specs/openid-federation-1_0.html)
- `apps/api/backend/src/services/network/`
- Wave 102: Network Federation, Wave 113: Federation Metadata
