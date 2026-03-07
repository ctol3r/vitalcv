# ADR-0005: Audit Ledger Event Taxonomy

**Date:** 2026-02-15  
**Status:** Accepted  
**Deciders:** VitalCV Engineering  
**Tags:** backend, audit, security, compliance

---

## Context

VitalCV's audit system must satisfy two requirements simultaneously:
1. **Compliance** — HIPAA requires audit trails for all access to PHI-adjacent data
2. **Operations** — engineering needs structured events for anomaly detection and debugging

Early audit logging was ad-hoc: some routes used `console.log`, others called `auditLedger`
with inconsistent event type strings. This made automated analysis and compliance reporting
unreliable.

We needed a defined taxonomy: a closed set of event types with consistent field semantics.

## Decision

Define a **closed event taxonomy** for `auditLedger`. All audit events must use a type
from the approved list. The Prisma `AuditEvent` model enforces this at the schema level.

### Taxonomy (as of Wave 121)

| Category | Event Types |
|----------|-------------|
| **Ingest** | `NPI_INGESTED`, `NPI_VALIDATION_FAILED`, `DOCUMENT_INGESTED` |
| **Credential** | `CREDENTIAL_ISSUED`, `CREDENTIAL_VERIFIED`, `CREDENTIAL_REVOKED`, `CREDENTIAL_PRESENTED` |
| **Auth** | `AUTH_SUCCESS`, `AUTH_FAILURE`, `API_KEY_CREATED`, `SESSION_CREATED` |
| **Trust** | `TRUST_STATE_CHANGED`, `TRUST_ALERT_EMITTED`, `TRUST_ALERT_ACKNOWLEDGED` |
| **Federation** | `FEDERATION_REGISTERED`, `TRUST_CHAIN_VALIDATED` |
| **Audit** | `AUDIT_RECEIPT_GENERATED`, `ANOMALY_DETECTED`, `BASELINE_CALIBRATED` |
| **System** | `SYSTEM_SWEEP_RUN`, `SYSTEM_INTEGRITY_CHECK` |

### Field Schema

All events share a base schema:
```
type: EventType (from taxonomy)
clinicianId?: string   (NPI or internal ID)
referenceId?: string   (credential ID, artifact ID, etc.)
actor?: string         (user ID, service name, or "system")
metadata?: Json        (event-specific payload)
createdAt: DateTime
```

Note: `AuditEvent` does NOT have `description`, `npi`, or `eventType` fields.

## Alternatives Considered

| Option | Description | Why Rejected |
|--------|-------------|--------------|
| Free-form strings | No constraint on event type | Unqueryable; compliance risk |
| OpenTelemetry spans | Standards-based observability | Overkill for compliance audit; different purpose |
| Separate compliance log | Parallel log stream | Duplication; sync issues |

## Consequences

### Positive
- Audit events are machine-queryable by type
- `auditBaseline` anomaly detector can analyze event distributions
- Compliance reports can be generated from structured data

### Negative / Trade-offs
- Adding new event types requires schema review (intentional friction)
- Historical events pre-taxonomy require migration

### Neutral / Notes
- `auditLedger.emit(type, payload)` is the only sanctioned write path
- `receiptGenerator` wraps audit receipts in signed bundles for evidentiary use

## References

- `apps/api/backend/src/services/audit/`
- Wave 121: Structured logging standardization
- Wave 122: Audit OS + anomaly baseline
