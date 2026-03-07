# ADR-0001: Trust Substrate as Single Source of Truth

**Date:** 2026-01-15  
**Status:** Accepted  
**Deciders:** VitalCV Engineering  
**Tags:** backend, security, architecture

---

## Context

VitalCV needs a unified runtime representation of a clinician's verifiable trust state.
Early designs scattered state across multiple services (registry, audit, credential wallet),
leading to inconsistent reads and race conditions during cascading revocations.

We needed a single service that:
- Maintains the authoritative in-memory + persisted trust state per clinician
- Emits change events consumed by graph, alerts, and UI
- Can be queried synchronously without joining across multiple services

## Decision

Introduce `trustSubstrate` as the canonical trust state service. All writes to a clinician's
verifiable status flow through it. Other services (revocationCascade, auditLedger, globalGraph)
subscribe to substrate events rather than writing state directly.

The substrate exposes:
- `getSubstrateState(npi)` — synchronous read
- `updateTrustState(npi, patch)` — atomic write + event emit
- `watchSubstrate(npi, cb)` — reactive subscription

## Alternatives Considered

| Option | Description | Why Rejected |
|--------|-------------|--------------|
| Distributed state | Each service owns its piece of state | Too many joins, inconsistent reads |
| Database-only | Query Prisma directly on every request | Too slow for real-time trust graph; no event model |
| Redux-style store | Global client-side state manager | Backend-only requirement; not applicable |

## Consequences

### Positive
- Single read path for trust state eliminates inconsistencies
- Event-driven architecture enables real-time graph and alert propagation
- Easier to audit: all mutations logged via substrate

### Negative / Trade-offs
- In-memory component requires persistence strategy for restarts (Wave 126 migration plan)
- Single service is a potential bottleneck at high issuer volume

### Neutral / Notes
- `trustSubstrate` is backend-only; frontend reads via `/api/trust-state/:artifactId`

## References

- [Wave 126 DB Migration Plan](../MIGRATION_PLAN.md)
- `apps/api/backend/src/services/trust/trustSubstrate.ts`
