# VitalCV PSV Adapter Framework Design

## Objective
Wave 242 readiness depends on a single interoperability substrate that turns upstream verification sources into canonical credential facts with provenance. This wave introduces `packages/psv-adapters` as the authority for source adapters, provenance enforcement, disclosure control, monitoring normalization, and trust-event emission. The backend remains the persistence bridge only; no Prisma schema change is introduced.

## Architecture
The runtime flow is:

`Sources -> PSV Adapter Framework -> Canonical Credential Fact Store -> Trust Policy Engine -> Credential Issuance -> Verifier Gateway`

Each adapter produces a `CredentialFactBatch` with:

- Canonical facts
- Source provenance
- Evidence artifact metadata
- Deterministic idempotency key
- Typed downstream events

The initial canonical fact model covers:

- `IdentityClaim`
- `License`
- `Certification`
- `Sanction`
- `EnrollmentPrivilege`
- `Education`
- `EmploymentAffiliation`
- `EvidenceArtifact`
- `SourceProvenance`
- `MonitoringSubscription`

Every fact batch carries required provenance fields:

- `source`
- `retrieval_time`
- `retrieval_method`
- `evidence_pointer`
- `raw_response_hash`

The adapter runtime enforces HTTPS-only endpoints, exponential backoff, 429 `Retry-After` handling, in-memory circuit breaking, dead-letter capture, and deterministic hashing. OpenTelemetry spans are emitted for transport execution, and sensitive inputs are hashed before they enter attributes or logs.

## Reference Adapters
### NPI Registry
`NpiRegistryAdapter` is the clinician identity bootstrap path. It calls the CMS NPI Registry through `lookupByNpi(npi)` and `lookupByNameState(name, state)`, validates NPIs using `@vitalcv/ingest`, and emits only:

- `IdentityClaim`
- `EvidenceArtifact`
- `SourceProvenance`

NPPES taxonomy and address data are treated as identity context only. They do not become authoritative `License` facts.

Example mapping:

- Source payload: NPPES record for NPI `1234567893`
- Canonical facts:
  - `IdentityClaim` with `fullName=JANE DOE`, `enumerationType=NPI-1`, `practiceStates=['CA','NV']`
  - `EvidenceArtifact` pointing to `evidence://npi-registry/.../<hash>.json`
  - `SourceProvenance` with CMS endpoint and retrieval method `api`
- Emitted events:
  - `CredentialFactIngested`
  - `TrustSignalRaised(signal=identity_bootstrapped)`

Fixture: [`packages/psv-adapters/fixtures/npiRegistry.lookupByNpi.json`](/Users/christoler/vitalcv/packages/psv-adapters/fixtures/npiRegistry.lookupByNpi.json)

### Nursys e-Notify
`NursysENotifyAdapter` is the continuous nurse licensure monitoring path. It supports:

- institutional enrollment configuration
- polling ingestion
- webhook ingestion
- replay suppression
- cursor advancement

It normalizes incoming deltas into:

- `License`
- `MonitoringSubscription`
- `EvidenceArtifact`
- `SourceProvenance`

It emits:

- `LicenseUpdated`
- `LicenseExpired`
- `DisciplineAdded`
- `MonitoringSubscriptionChanged`
- `TrustSignalRaised`

Example mapping:

- Source payload: Nursys webhook event with `eventType=DISCIPLINE_ADDED`, license `RN987654`, state `CA`
- Canonical facts:
  - `License` with `licenseNumberLast4=7654`, `jurisdiction=CA`, `status=ACTIVE`, `discipline=['Probation']`
  - `MonitoringSubscription` for the subscribed NPI
  - `EvidenceArtifact`
  - `SourceProvenance`
- Emitted events:
  - `CredentialFactIngested`
  - `LicenseUpdated`
  - `DisciplineAdded`
  - `TrustSignalRaised(signal=license_updated)`

Fixture: [`packages/psv-adapters/fixtures/nursys.webhook.discipline.json`](/Users/christoler/vitalcv/packages/psv-adapters/fixtures/nursys.webhook.discipline.json)

## Backend Bridge
`apps/api/backend/src/services/psvInterop/canonicalFactStore.ts` implements `CanonicalCredentialFactStore` against existing tables only:

- `VerificationArtifact`
- `AuditEvent`
- `MonitoringEvent`
- `NursysEvent`

Behavior:

- idempotency checks use `subjectId + source + rawResponseHash`
- normalized fact batches and retention windows are stored in `VerificationArtifact.rawPayload`
- query and disclosure activity are written to `AuditEvent`
- Nursys deltas are written to `NursysEvent`
- status transitions are written to `MonitoringEvent`
- trust state is computed from existing backend logic without schema changes

The existing `/api/psv/*` routes remain stable and now execute through `PsvInteropService`, which orchestrates adapters and persistence.

## Policy and Disclosure Controls
`SourcePolicy` defines allowed fact types, consumer audiences, eligibility gates, retention windows, and required provenance fields for each source. `DisclosurePolicy` projects batches to the minimum necessary fields and omits fact types that are not approved for that audience unless explicitly requested, in which case it fails closed.

`RetentionPolicy` computes independent expiry windows for:

- raw payload retention
- evidence pointer retention
- normalized fact retention

## Integration Dependency Checklist
### Public source
- CMS NPI Registry
- No contract required
- HTTPS access only
- No secret required
- Audit obligation: immutable query log with hashed request identity
- Retention: 30 days raw payload, 365 days evidence pointer and facts

### Licensed source
- Nursys e-Notify
- Contract and institutional enrollment required
- Secret inputs: `NURSYS_API_KEY`, `NURSYS_INSTITUTION_ID`
- Optional webhook configuration: `NURSYS_WEBHOOK_URL`
- Polling and webhook traffic must use TLS
- Audit obligation: immutable query log, immutable disclosure log, inbound delta capture, monitoring status transition log
- Retention: 7 days raw payload, 365 days evidence pointer and facts

## Test Coverage
- Contract tests for NPI lookup, not-found, malformed payload, and 429 retry handling
- Contract tests for Nursys enrollment, polling, webhook ingestion, replay suppression, and expired-license handling
- Property tests for canonical hashing and deterministic idempotency
- Disclosure tests for minimum necessary field projection
- Backend bridge tests for `VerificationArtifact`, `AuditEvent`, `MonitoringEvent`, and `NursysEvent` persistence
