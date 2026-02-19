# Verifier Integration Guide (Wave 8/9)

## Base URL

All endpoints are served by the VitalCV backend:

`/api`

## Cross-check Endpoint

### `GET /api/verify/:shareId`

Use this endpoint when a verifier opens a shared artifact link.

Response:

```json
{
  "source": "NPI:1234567890",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "status": "VERIFIED",
  "monitoring": "pending verifier confirmation",
  "signature": "rev-9f1ab2d3cd",
  "hash": "f8c2..."
}
```

Notes:
- This endpoint is read-only for verifier consumption.
- It records the first-view timestamp for each share and increments view-derived metrics.
- `status` and `monitoring` represent the verifier-facing decision surface for the snapshot.

## Verifier Acceptance Endpoint

### `POST /api/verifier/accept`

Posts a verifier acceptance marker from employer-side review.

Request body:

```json
{
  "organization": "Regional Health Center",
  "acceptedAt": "2026-01-01T12:00:00.000Z" // optional
}
```

Response:

```json
{
  "id": "a4f9...",
  "organization": "Regional Health Center",
  "acceptedAt": "2026-01-01T12:00:00.000Z"
}
```

## YC Metrics Endpoint

### `GET /api/metrics/yc`

Returns aggregate production-readiness metrics:

```json
{
  "totalNPIs": 12,
  "shareLinks": 30,
  "verifierViews": 14,
  "exports": 0,
  "avgTimeToView": 42.8,
  "verifierAcceptances": 5,
  "estimatedStartDateAccelerationDays": 0
}
```

## Pilot Report Endpoint

### `GET /api/pilot/report`

Returns the same aggregate payload used for reporting and dashboarding.

## Cross-check interpretation (NCQA-aligned)

- `source` shows the practitioner source identifier for auditability.
- `status` and `monitoring` map to verifier decision evidence, not final hiring decisions.
- `signature` and `hash` are deterministic integrity fingerprints for replay-safe traceability.
- The flow is recognition-centric and designed for credentialing teams verifying licensing and trust continuity.

## Safety and operations

- `/api/verify/:shareId` and `/api/verifier/accept` are intentionally API-path-light and remain deterministic.
- All reads are synthetic-safe for pilot deployment where data persistence is expected to drive real-time reporting.
