# TrustState API Reference

**Version:** 1.0.0  
**Base URL:** `https://api.vitalcv.com`  

---

## GET /api/trust-state/:npi

Returns the current trust state for a clinician identified by NPI.

### Request

```
GET /api/trust-state/1234567890
Authorization: Bearer <api_key>
```

### Response — 200 OK

```json
{
  "npi": "1234567890",
  "readiness_level": "L3",
  "readiness_score": 87,
  "readiness_status": "Credentialing Complete",
  "trustBand": "GREEN",
  "computedAt": "2026-03-14T09:47:00Z",
  "methodology": "243.1",
  "cached": true,
  "gap_summary": [],
  "facts": [
    {
      "factType": "NPIEnrollment",
      "source": "NPPES",
      "status": "VERIFIED",
      "verifiedAt": "2026-03-14T08:00:00Z",
      "expiresAt": null
    },
    {
      "factType": "StateLicense",
      "source": "STATE_BOARD_NJ",
      "status": "VERIFIED",
      "verifiedAt": "2026-03-10T12:00:00Z",
      "expiresAt": "2027-05-01T00:00:00Z"
    },
    {
      "factType": "OIGClear",
      "source": "OIG_LEIE",
      "status": "VERIFIED",
      "verifiedAt": "2026-03-14T09:00:00Z",
      "expiresAt": null
    }
  ]
}
```

### Response — 404 Not Found

Returned when no trust state has been computed for this NPI.  
**Note:** This is not an error. Call `POST /api/clinician/activate` to seed the trust state.

```json
{
  "error": "not_found",
  "message": "No trust state found for NPI 1234567890. Activate the clinician to compute.",
  "activateUrl": "https://api.vitalcv.com/api/clinician/activate"
}
```

---

## GET /api/trust-state/cache/stats

Returns live cache performance metrics.

```json
{
  "memory_hits": 4821,
  "db_hits": 312,
  "misses": 88,
  "overall_hit_ratio": 0.943,
  "memory_hit_ratio": 0.917,
  "db_hit_ratio": 0.059,
  "lru_size": 143,
  "lru_max": 1000,
  "lru_ttl_ms": 60000,
  "latency": {
    "p50": 4,
    "p90": 22,
    "p95": 47,
    "p99": 180
  }
}
```

---

## POST /api/clinician/activate

Bootstraps a clinician's trust state from their NPI. Calls NPPES, creates a PersonProfile,
and runs the first trust state computation. Returns the initial trust band.

### Request

```json
{
  "npi": "1234567890"
}
```

### Response — 200 OK

```json
{
  "readinessScore": 72,
  "readinessLevel": "L2",
  "readinessStatus": "Substantially Verified"
}
```

### Errors

| Code | Meaning |
|---|---|
| 400 | NPI is not 10 digits, or is a Type 2 (organization) NPI |
| 401 | Missing or invalid authentication |
| 409 | NPI is already registered to another account |

---

## POST /api/psv/verify

Runs multi-source primary source verification in parallel. Queries NPPES, OIG/LEIE, Nursys, state boards, and DEA concurrently.

### Request

```json
{
  "npi": "1234567890",
  "credential_type": "License",
  "state": "NJ"
}
```

`credential_type` is optional. Omit to run all sources.  
Values: `License`, `BoardCertification`, `DEA`, `Registration`, `CompactPrivilege`

### Response — 200 OK

```json
{
  "npi": "1234567890",
  "requestId": "019ced42-e541-7d81-b933-753ffa1f6021",
  "completedAt": "2026-03-14T09:47:01.847Z",
  "totalLatencyMs": 412,
  "overallStatus": "PARTIAL",
  "exclusionClear": true,
  "exclusionSource": "live",
  "sources": [
    {
      "source": "NPPES",
      "status": "verified",
      "latencyMs": 183,
      "payload": { "credential": { "status": "Active" }, "provider": { "npi": "1234567890", "fullName": "Jane Smith NP" } }
    },
    {
      "source": "OIG_LEIE",
      "status": "verified",
      "latencyMs": 247,
      "payload": { "credential": { "status": "Active", "credentialIdentifier": "CLEAR" } }
    },
    {
      "source": "NURSYS",
      "status": "stub",
      "latencyMs": 1,
      "payload": { "credential": { "status": "Unknown" } }
    },
    {
      "source": "STATE_BOARD",
      "status": "verified",
      "latencyMs": 198,
      "payload": { "credential": { "status": "Active", "issuingStateOrBody": "NJ" } }
    },
    {
      "source": "DEA",
      "status": "stub",
      "latencyMs": 2,
      "payload": { "credential": { "status": "Unknown" } }
    }
  ]
}
```

### Latency profile

| Path | p50 | p95 |
|---|---|---|
| All sources, warm cache | < 5ms | < 20ms |
| All sources, cache miss (ingested mode) | 200ms | 500ms |
| All sources, cold (legacy mode) | 400ms | 900ms |

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `GET /api/trust-state/:npi` | 60 req/min per IP |
| `POST /api/psv/verify` | 30 req/min per IP |
| `POST /api/clinician/activate` | 10 req/min per IP |
| `GET /api/passport/:npi/embed.svg` | 120 req/min (CDN-cacheable) |

---

## Authentication

All endpoints except public passport routes require `Authorization: Bearer <api_key>`.

API keys are provisioned at `/billing` (STARTER, GROWTH, ENTERPRISE tiers).  
Public endpoints: `GET /api/passport/:npi`, `GET /api/passport/:npi/trust`, `GET /api/passport/:npi/embed.svg`
