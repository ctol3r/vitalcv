# Universal PSV Artifact Engine — Design Document

**Date:** 2026-02-17
**Branch:** `feat/runtime-policy-strict-mode`
**Status:** Approved

## Overview

Implement the Universal PSV Artifact Engine: a cryptographically signed, deterministically hashed artifact system for Primary Source Verification of healthcare credentials. The engine produces verifiable artifacts with ES256 signatures, NCQA-compliant decision windows, delta monitoring, and a public Trust-State UI.

## Strategy: Evolve-in-Place

Refactor existing codebase services rather than creating parallel systems. Follow codebase conventions (`src/services/`, `src/types/`, `src/utils/`).

## Type Schema

### `src/types/psv.ts` — New File

```
PsvArtifact
├── artifactId: string (UUID v4)
├── schemaVersion: "1.0"
├── provider: Provider
│   ├── npi: string
│   ├── firstName: string
│   ├── lastName: string
│   └── credentialType: string
├── credential: Credential
│   ├── type: string
│   ├── status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED"
│   ├── jurisdiction: string
│   ├── expirationDate: string | null
│   ├── identifier: string | null
│   └── issuingBody: string
├── primarySource: PrimarySource
│   ├── authority: string
│   ├── method: string
│   └── sourceUrl: string
├── retrievalEvent: RetrievalEvent
│   ├── retrievedAt: string (ISO 8601)
│   ├── rawPayloadHash: string (SHA-256)
│   └── ttlSeconds: number
├── evidenceIntegrity: EvidenceIntegrity
│   ├── artifactHash: string (SHA-256)
│   ├── signature: string (ES256 JWS compact)
│   ├── kid: string
│   └── jwksUrl: string
├── decisionWindow: DecisionWindow
│   ├── windowStart: string (ISO 8601)
│   ├── windowDeadline: string (ISO 8601)
│   ├── compliant: boolean | null
│   ├── daysRemaining: number
│   └── mode: "ncqa" | "expedited"
├── monitoring: Monitoring
│   ├── enabled: boolean
│   ├── lastCheckedAt: string (ISO 8601)
│   └── nextCheckDue: string (ISO 8601)
├── deltaLog: DeltaLogEntry[]
│   └── Each entry:
│       ├── field: string
│       ├── previousValue: string
│       ├── newValue: string
│       ├── detectedAt: string (ISO 8601)
│       └── deltaHash: string (SHA-256)
└── enrollmentContext: EnrollmentContext
    ├── pecosEnrolled: boolean | null
    └── enrollmentType: string | null
```

### Normalized Credential Payload

```
NormalizedCredentialPayload
├── npi: string
├── provider: { firstName, lastName, credentialType }
├── credential: { type, status, jurisdiction, expirationDate, identifier }
├── source: { authority, method, sourceUrl }
├── retrievedAt: string (ISO 8601)
└── rawPayload: unknown
```

## Prisma Schema Evolution

Add to existing `VerificationArtifact` model:

```prisma
artifactJson   Json?    @db.JsonB   // Full PsvArtifact document
artifactHash   String?              // SHA-256 of canonicalized artifact
signature      String?              // ES256 JWS compact serialization
signingKeyId   String?              // kid used for signing
deltaLog       Json?    @db.JsonB   // Array of DeltaLogEntry
```

## Adapter Layer

### Evolve `nursysAdapter.ts`

Add `normalizeToPayload(npi: string): Promise<NormalizedCredentialPayload>`

- Call NPPES API for provider demographics (name, type)
- Call existing Nursys stub for license status
- Combine into NormalizedCredentialPayload
- Return rawPayload untouched
- NO hashing, NO window calculation, NO signing

### NPPES Integration

- Endpoint: `GET https://npiregistry.cms.hhs.gov/api/?number={npi}&version=2.1`
- Free, public, rate-limited ~5 req/sec
- Returns: provider name, type, taxonomy, address

## Canonicalization (Existing — No Changes)

`canonicalizeJson.ts` already implements:
- Recursive key sorting
- Deterministic JSON stringification
- Date→ISO string, null handling, array preservation

`deterministic.ts` already provides:
- `sha256Hex(value)`, `sha256ForPayload(payload)`

**Action:** Add unit tests confirming stable output.

## Signing Service — New File

### `src/services/signingService.ts`

```
ES256 signing via jose library (already installed v6.1.0)

initSigningKeys():
  - Load PSV_SIGNING_KEY from env (base64-encoded PKCS8 PEM)
  - If not set + NODE_ENV !== "production": generate ephemeral P-256 keypair
  - If not set + NODE_ENV === "production": throw

signArtifact(canonicalPayload: string): Promise<string>
  - Returns JWS compact serialization (ES256)

getPublicKeyJwk(): Promise<JWK>
  - Export public key in JWK format

getKeyId(): Promise<string>
  - SHA-256 thumbprint of public key
```

### JWKS Endpoint

`GET /.well-known/jwks.json` in app.ts → returns `{ keys: [publicKeyJwk] }`

## Artifact Builder — New File

### `src/services/psvArtifactBuilder.ts`

```
buildPsvArtifact(payload: NormalizedCredentialPayload): Promise<PsvArtifact>

Pipeline:
1. canonicalize(rawPayload) → sha256 → rawPayloadHash
2. Generate artifactId (UUID v4)
3. Calculate DecisionWindow (120-day NCQA default from now)
4. Construct artifact without evidenceIntegrity
5. canonicalize(artifact) → sha256 → artifactHash
6. signingService.signArtifact(artifactHash) → signature
7. Attach EvidenceIntegrity { artifactHash, signature, kid, jwksUrl }
8. Return PsvArtifact
```

## Monitoring + Delta Engine

### Evolve `credentialMonitoringEngine.ts`

Add:

```
detectMaterialChange(
  oldCredential: Credential,
  newCredential: Credential
): DeltaLogEntry | null
  - Compare: status, expirationDate, jurisdiction, identifier, issuingBody
  - Return structured delta entry with hash, or null if no change

runMonitoringCheck(
  existingArtifact: PsvArtifact,
  newPayload: NormalizedCredentialPayload
): Promise<PsvArtifact>
  - Call detectMaterialChange()
  - If changed: create delta entry, append to deltaLog, re-sign artifact
  - If unchanged: update monitoring.lastCheckedAt, re-sign
  - Return updated artifact
```

Existing `runMonitoringSweep` stays for background periodic checks.

## Routes

### POST `/verify`

```
Request:  { npi: string }
Auth:     publicSafety middleware (rate limiting, optional API key)

Flow:
1. Validate NPI (10 digits)
2. getLatestArtifact(npi)
3. If exists AND < 24h old:
   - Run monitoring check against fresh adapter data
   - Return updated artifact
4. If not exists OR stale:
   - Run adapter.normalizeToPayload(npi)
   - Build new artifact via psvArtifactBuilder
   - Persist to VerificationArtifact
5. Return PsvArtifact JSON

Response: PsvArtifact
```

### GET `/api/download/:artifactId`

```
Auth: publicSafety middleware

Flow:
1. Fetch artifact from DB
2. Generate zip:
   - artifact.json (canonicalized PsvArtifact)
   - raw_payload.json (source response)
   - integrity.txt (hash + signature + kid + jwksUrl)
   - README.txt (verification instructions)
3. Return Content-Type: application/zip

Dependency: archiver package
```

### GET `/.well-known/jwks.json`

```
Auth: None (public)
Response: { keys: [JWK] }
```

## Trust-State UI

### `apps/web/app/verify/[npi]/page.tsx`

Server component, no Clerk auth gating. Public page.

Components in `apps/web/app/verify/[npi]/components/`:

| Component | Purpose |
|-----------|---------|
| TrustStateCard | Hero card: trust status badge, NPI, provider name |
| CredentialPanel | License type, status, jurisdiction, expiration |
| MonitoringPanel | Monitoring status, last checked, next check due |
| DecisionWindowPanel | PSV window visualization, deadline, compliance |
| IntegrityPanel | Artifact hash, signature, JWKS URL, verification |
| DownloadBundleButton | Download zip bundle link |
| RoiPanel | Time/cost savings vs manual PSV |

Uses shadcn/ui + Tailwind with clean minimal aesthetic.

## New Dependencies

- `archiver` + `@types/archiver` — zip generation

## New Environment Variables

- `PSV_SIGNING_KEY` — base64-encoded PKCS8 ES256 private key (optional in dev)
- `PSV_JWKS_URL` — public JWKS URL (defaults to `/.well-known/jwks.json`)

## Files Changed

### New:
1. `apps/api/backend/src/types/psv.ts`
2. `apps/api/backend/src/services/psvArtifactBuilder.ts`
3. `apps/api/backend/src/services/signingService.ts`
4. `apps/web/app/verify/[npi]/page.tsx`
5. `apps/web/app/verify/[npi]/components/TrustStateCard.tsx`
6. `apps/web/app/verify/[npi]/components/CredentialPanel.tsx`
7. `apps/web/app/verify/[npi]/components/MonitoringPanel.tsx`
8. `apps/web/app/verify/[npi]/components/DecisionWindowPanel.tsx`
9. `apps/web/app/verify/[npi]/components/IntegrityPanel.tsx`
10. `apps/web/app/verify/[npi]/components/DownloadBundleButton.tsx`
11. `apps/web/app/verify/[npi]/components/RoiPanel.tsx`
12. `apps/api/backend/__tests__/canonicalize.test.ts`

### Evolved:
13. `apps/api/backend/src/services/nursysAdapter.ts`
14. `apps/api/backend/src/services/credentialMonitoringEngine.ts`
15. `apps/api/backend/src/app.ts`
16. `apps/api/backend/prisma/schema.prisma`
17. `apps/api/backend/package.json`

## Acceptance Criteria

1. Visit `/verify/{npi}` → artifact generated and Trust-State screen renders
2. Download bundle works (zip with artifact.json, raw_payload.json, integrity.txt, README.txt)
3. Signature verifies against JWKS (`/.well-known/jwks.json`)
4. Monitoring detects status change (delta log entry created)
5. Artifact hash remains stable across builds (canonicalization deterministic)
6. `pnpm build` succeeds with no type errors
