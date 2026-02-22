# VitalCV YC Demo Guide

## 2-Minute Demo Script

### Setup
No setup required. Demo endpoints are public and rate-limited. No API key needed.

### Step 1: Check service status (10s)
```bash
curl https://YOUR_DOMAIN/demo/status | jq
```
Shows: version, uptime, git SHA, environment.

### Step 2: Browse sample providers (10s)
```bash
curl https://YOUR_DOMAIN/demo/sample-npis | jq
```
Returns 3 known-good NPIs with names and specialties.

### Step 3: Issue a credential (30s)
Pick an NPI from step 2 and issue a Verifiable Credential:
```bash
curl -X POST https://YOUR_DOMAIN/demo/issue \
  -H 'Content-Type: application/json' \
  -d '{"npi": "1003000126"}' | jq
```
Returns a W3C Verifiable Credential (VC Data Model 2.0) with:
- `credentialSubject`: provider identity (NPI, name, specialty, status)
- `credentialStatus`: revocation status reference
- `proof`: demo proof (production uses ES256 JWS)

### Step 4: Verify a provider (30s)
Run the full verification pipeline — fetches live data from CMS NPPES:
```bash
curl -X POST https://YOUR_DOMAIN/demo/verify \
  -H 'Content-Type: application/json' \
  -d '{"npi": "1003000126"}' | jq
```
Returns: signed identity artifact with SHA-256 hash chain.

### Step 5: Look up a provider (20s)
```bash
curl "https://YOUR_DOMAIN/demo/provider?npi=1003000126" | jq
```
Live NPPES lookup with automatic fallback to cached data if CMS is unreachable.

## Endpoints Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /demo/status | None | Service version, uptime, git SHA |
| GET | /demo/sample-npis | None | List of sample NPIs for demo |
| POST | /demo/issue | None | Issue mock W3C Verifiable Credential |
| POST | /demo/verify | None | Full NPI verification + signed artifact |
| GET | /demo/provider?npi=X | None | NPPES provider lookup |
| GET | /health | None | Healthcheck (always fast, no DB) |

## Sample NPIs

| NPI | Name | Specialty |
|-----|------|-----------|
| 1003000126 | Robert Smith | Internal Medicine |
| 1497758544 | Mary Johnson | Family Medicine |
| 1588667638 | James Williams | Nurse Practitioner |

## Expected Responses

### /demo/status
```json
{
  "service": "vitalcv-api",
  "version": "1.0.0",
  "git_sha": "abc123...",
  "uptime_seconds": 3600,
  "uptime_human": "1h 0m",
  "node_env": "production",
  "demo_mode": false
}
```

### /demo/issue
```json
{
  "success": true,
  "credential": {
    "@context": ["https://www.w3.org/ns/credentials/v2", "..."],
    "type": ["VerifiableCredential", "HealthcareProviderCredential"],
    "issuer": { "id": "did:web:vitalcv.com" },
    "credentialSubject": {
      "npi": "1003000126",
      "name": "ROBERT SMITH",
      "specialty": "Internal Medicine",
      "status": "active"
    }
  }
}
```

### /demo/verify
```json
{
  "success": true,
  "artifact": { "...identity artifact..." },
  "artifact_hash": "sha256:...",
  "signature": "base64...",
  "signing_available": true,
  "source": "live"
}
```

## How to Reset Demo State

Demo endpoints are stateless. Each call fetches fresh data from CMS NPPES (or falls back to cached data). No reset needed.

To test with different providers, use any valid 10-digit NPI from https://npiregistry.cms.hhs.gov.
