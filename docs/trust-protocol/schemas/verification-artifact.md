# Verification Artifact Format

**Version:** 1.0.0  
**Status:** Stable  

---

## Overview

A Verification Artifact is the atomic unit of credential evidence in the VitalCV Trust Protocol. Every fact that contributes to a Trust Band is backed by one or more Verification Artifacts.

Artifacts are:
- **Immutable** — once created, the payload and hash are never modified
- **Source-attributed** — every artifact identifies its primary source
- **Merkle-validated** — each artifact carries a `merkleRoot` for integrity verification
- **Composable** — multiple artifacts combine into an audit bundle

---

## Schema

```typescript
interface VerificationArtifact {
  // Identity
  id:           string;   // UUID v4
  npi:          string;   // 10-digit NPI

  // Source
  source:       string;   // "NPPES" | "OIG_LEIE" | "STATE_BOARD_CA" | "NURSYS" | ...
  sourceType:   string;   // "PrimarySource" | "ContractedAgent" | "SelfAttestation"

  // Credential
  credentialType: string; // "NPI_ENROLLMENT" | "STATE_LICENSE" | "OIG_EXCLUSION" | "DEA" | ...
  status:         string; // "VERIFIED" | "FAILED" | "PENDING" | "EXPIRED"
  trustState:     string; // "verified" | "unverified" | "disputed"

  // Integrity
  checksum:     string;   // SHA-256 of rawPayload
  merkleRoot:   string;   // Merkle root of the artifact set at time of creation
  rawPayload:   object;   // Source-specific raw data (varies by source)

  // Timing
  verifiedAt:   string;   // ISO 8601 — when the source was queried
  expiresAt:    string | null;  // ISO 8601 — credential expiry if known
  createdAt:    string;   // ISO 8601 — when the artifact was stored

  // Optional
  licenseNumber: string | null;
  organizationId: string | null;
}
```

---

## Credential Types

| `credentialType` | Source | Notes |
|---|---|---|
| `NPI_ENROLLMENT` | NPPES | Confirms NPI is active and Type 1 (individual) |
| `STATE_LICENSE` | State medical boards | One artifact per state |
| `BOARD_CERTIFICATION` | ABIM, ABFM, ABP, etc. | Via federation or direct API |
| `OIG_EXCLUSION` | OIG LEIE | `status: "VERIFIED"` = CLEAR |
| `DEA` | DEA via NPPES identifiers | Registration number |
| `COMPACT_PRIVILEGE` | Nursys / NLC | Nurse Licensure Compact |
| `TRUST_STATE_ENGINE` | VitalCV internal | Snapshot of computed trust state |

---

## Source Types

| `sourceType` | Meaning |
|---|---|
| `PrimarySource` | Data obtained directly from the issuing authority (e.g. NPPES, state board) |
| `ContractedAgent` | Data obtained from a contracted verification service |
| `SelfAttestation` | Data provided by the clinician, not yet primary-source verified |

---

## Integrity Model

### Checksum

`checksum = sha256(JSON.stringify(rawPayload))` where `rawPayload` is the
canonical, deterministic serialization of the source response.

### Merkle Root

The `merkleRoot` covers all artifacts for an NPI at a point in time:

```typescript
function computeMerkleRoot(artifacts: VerificationArtifact[]): string {
  const leaves = artifacts
    .map(a => sha256(a.checksum + a.npi + a.source + a.verifiedAt))
    .sort();
  // Binary Merkle tree reduction
  return merkleReduce(leaves);
}
```

### Audit Bundle

A full audit bundle (`GET /api/trust-proof/:npi`) contains:
- All artifacts for the NPI
- The bundle-level Merkle root
- A SHA-256 hash of the bundle itself
- A timestamp anchor (RFC 3161 planned for v1.1)

---

## Raw Payload Examples

### NPPES Artifact

```json
{
  "credentialType": "NPI_ENROLLMENT",
  "source": "NPPES",
  "rawPayload": {
    "npi": "1234567890",
    "enumeration_type": "NPI-1",
    "basic": {
      "first_name": "Jane",
      "last_name": "Smith",
      "credential": "NP",
      "status": "A"
    },
    "taxonomies": [{ "code": "363L00000X", "desc": "Nurse Practitioner", "primary": true }]
  }
}
```

### OIG/LEIE Artifact

```json
{
  "credentialType": "OIG_EXCLUSION",
  "source": "OIG_LEIE",
  "status": "VERIFIED",
  "rawPayload": {
    "matchType": "NONE",
    "exclusionClear": true,
    "checkedAt": "2026-03-14T09:00:00Z",
    "mode": "live"
  }
}
```

### State License Artifact

```json
{
  "credentialType": "STATE_LICENSE",
  "source": "STATE_BOARD_NJ",
  "status": "VERIFIED",
  "licenseNumber": "NJ-1039485",
  "rawPayload": {
    "licenseStatus": "ACTIVE",
    "licenseNumber": "NJ-1039485",
    "expirationDate": "2027-05-01",
    "boardName": "New Jersey Division of Consumer Affairs"
  }
}
```

---

## Conformance

An implementation is Verification Artifact conformant if it:
1. Identifies every artifact with `npi`, `source`, `credentialType`, `status`
2. Stores a `checksum` that is `sha256(canonical(rawPayload))`
3. Treats `sourceType: "SelfAttestation"` as insufficient for `L3`
4. Never modifies a stored artifact (immutability constraint)
5. Propagates artifact expiry to trust state recomputation
