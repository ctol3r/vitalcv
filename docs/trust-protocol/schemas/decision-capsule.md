# Decision Capsule Schema

**Version:** `decision_capsule.v262`  
**Status:** Stable  

---

## Overview

A Decision Capsule is an immutable, cryptographically-anchored record of a credentialing decision. It answers:

> "At time T, with credentials C, verifier V decided D for clinician S."

Decision Capsules are:
- **Immutable after creation** — no updates, only status changes (VALID → AT_RISK → INVALID)
- **Replay-verifiable** — the `artifactHash` can be recomputed from stored payload to detect tampering
- **Audit-grade** — accepted as evidence for Joint Commission, CMS, and malpractice proceedings

---

## Schema

```typescript
interface DecisionCapsule {
  // Identity
  id:                 string;    // UUID v4
  subjectNpi:         string;    // 10-digit NPI of the clinician
  subjectDid:         string;    // did:vitalcv:<npi> — DID of the clinician

  // Decision
  decisionType:       "HIRING" | "PRIVILEGING" | "DEPLOYMENT" | "RENEWAL";
  decisionAction:     "APPROVE" | "REJECT" | "CONDITIONAL" | "DEFER";
  decisionTimestamp:  string;    // ISO 8601 — immutable

  // Evidence
  credentialIds:      string[];  // VerificationArtifact IDs that supported this decision
  issuerIds:          string[];  // trusted issuer IDs involved
  artifactHash:       string;    // SHA-256 of the canonical credential bundle at decision time
  trustStateHash:     string;    // SHA-256 of the TrustState at decision time

  // Methodology
  methodology:        string;    // e.g. "decision_capsule.v262"

  // Lifecycle
  status:             "VALID" | "AT_RISK" | "INVALID";

  // Verifier
  verifierOrgId:      string | null;  // UUID of the employer/hospital
  verifierClerkUserId: string | null; // identity of the person who made the decision

  // Timestamps
  createdAt:          string;    // ISO 8601
  updatedAt:          string;    // ISO 8601

  // Metadata (extensible)
  metadata: {
    decision_capsule_payload:  object;   // full payload used to compute artifactHash (for replay)
    employerId?:               string;
    deploymentRef?:            string;
    jobId?:                    string;
    notes?:                    string;
  };
}
```

---

## Decision Types

| Type | Meaning | Typical Trigger |
|---|---|---|
| `HIRING` | Employment decision | Application ACCEPTED |
| `PRIVILEGING` | Clinical privileges granted | Hospital privileging workflow |
| `DEPLOYMENT` | Assignment to a specific role/unit | Staffing agency placement |
| `RENEWAL` | Credential or privilege renewal | Annual re-credentialing |

---

## Decision Actions

| Action | Meaning |
|---|---|
| `APPROVE` | Decision is positive; clinician may proceed |
| `REJECT` | Decision is negative; clinician may not proceed |
| `CONDITIONAL` | Approved with conditions (tracked in `metadata.notes`) |
| `DEFER` | Decision held pending additional verification |

---

## Status Lifecycle

```
VALID ──(credential revoked)──→ AT_RISK ──(confirmed)──→ INVALID
  │                                                          │
  └──────────────────────────(re-verified)──────────────────┘
```

Status changes are triggered by:
- Revocation cascade when a supporting credential is revoked
- Trust state dropping below L2 after a capsule was created at L3
- Manual review by a verifier

---

## Artifact Hash

`artifactHash` is a SHA-256 hash of the canonical credential bundle at decision time:

```typescript
const artifactHash = sha256(
  JSON.stringify({
    subjectNpi,
    credentialIds: [...credentialIds].sort(),
    issuerIds: [...issuerIds].sort(),
    decisionType,
    decisionTimestamp,
    trustStateHash,
    // methodology + other stable fields
  })
);
```

The `metadata.decision_capsule_payload` stores the exact input to this hash, enabling replay.

---

## Replay Verification

```bash
GET /api/decisions/:capsuleId/replay
```

```json
{
  "capsuleId": "019ced42-e541-7d81-b933-753ffa1f6021",
  "valid": true,
  "expectedArtifactHash": "a3f8d2...",
  "actualArtifactHash": "a3f8d2...",
  "verifiedAt": "2026-03-14T09:47:00Z",
  "message": "Capsule is cryptographically intact and reproducible."
}
```

A `valid: false` response indicates hash mismatch — potential data corruption or unauthorized modification.

---

## Audit Bundle Export

```bash
GET /api/decisions/export/:npi
GET /api/decisions/export/:npi?format=ndjson
```

Returns a `DecisionCapsuleBundle`:

```json
{
  "@context": "https://vitalcv.com/schema/decision-capsule-bundle/v1",
  "@type": "DecisionCapsuleBundle",
  "subject": { "npi": "1234567890" },
  "exportedAt": "2026-03-14T09:47:00Z",
  "capsuleCount": 3,
  "bundleHash": "sha256:b4f2a1...",
  "issuer": "VitalCV",
  "methodology": "decision_capsule.v262",
  "capsules": [ /* array of DecisionCapsule */ ]
}
```

The `bundleHash` covers `npi`, `capsuleCount`, and sorted `capsuleIds` — verifiable without downloading the full bundle.

---

## Authority Graph Integration

Every Decision Capsule is automatically wired into the VitalCV Authority Graph at creation:
- A `DECISION_CAPSULE` KnowledgeNode is created for the capsule
- `DEPENDS_ON` edges link the capsule to each `VerificationArtifact` in `credentialIds`
- A `VERIFIER_ORG` node is linked if `verifierOrgId` is present

This makes capsule impact queryable: "which capsules are affected if credential X is revoked?"

---

## Conformance

An implementation is Decision Capsule conformant if it:
1. Creates capsules at `APPROVE`, `REJECT`, `CONDITIONAL`, or `DEFER` decision points
2. Computes and stores `artifactHash` using the canonical payload structure above
3. Stores `trustStateHash` from the trust state at decision time
4. Supports status transitions `VALID → AT_RISK → INVALID`
5. Returns `GET /:capsuleId/replay` with a verifiable hash comparison
