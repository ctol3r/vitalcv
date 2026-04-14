# Decision Attestation (The Compliance Anchor)

In healthcare credentialing, verifying a clinician's status is only half the battle. The other half is proving that an explicit hiring or rejection decision was made **based on that verified status at that exact moment in time**. 

A `Decision Attestation` cryptographically binds the system's objective state (Recognition) to the employer's subjective action (Acceptance) into a single, immutable, exportable compliance artifact.

## 1. Attestation Structure
Every time a user clicks a decision button (e.g., "Approve Candidate"), the system must freeze both the action and the evidence into a unified payload:

```json
{
  "schema": "vitalcv.attestation.v1",
  "attestationId": "uuid-v4",
  "clinicianNpi": "1487664858",
  "actionTaken": "APPROVE_CANDIDATE",
  "decisionState": "DECISION_GRADE",
  "decisionTimestamp": "2026-04-14T18:00:00Z",
  "actor": "employer-123",
  "systemSnapshot": {
    "sourceCoverage": {
      "OIG_LEIE": { "state": "checked", "verifiedAt": "2026-04-14T17:55:00Z" },
      "NPPES_API": { "state": "checked", "verifiedAt": "2026-04-14T17:56:00Z" }
    },
    "trustSignals": {
      "missingRequirements": [],
      "readinessScore": 100
    },
    "nbaRecommendation": "PROCEED"
  },
  "cryptographicHash": "sha256-hash-of-payload-for-future-blockchain-anchoring"
}
```

## 2. Binding Rules
To guarantee audit defensibility, a Decision Attestation must adhere to three strict rules:
1. **Created at Action Time:** The attestation is generated at the precise millisecond the `/api/pilot/telemetry` endpoint receives the POST request. It does NOT pull fresh data; it freezes the data the user was looking at.
2. **Immutable:** Once written to the database (or exported), the `systemSnapshot` cannot be updated, even if the underlying `Recognition` state drifts 5 minutes later.
3. **Exportable:** The `ProofCard` download links MUST embed this Attestation payload at the top of the PDF/JSON bundle, proving *why* the employer acted, not just *what* the sources said.

## 4. Cryptographic Hashing Strategy
To ensure an exported attestation is tamper-evident, the system generates a deterministic SHA-256 hash at the moment of creation.

**Algorithm:**
1. The JSON payload (excluding the `cryptographicHash` field) is recursively sorted by key name (Canonical JSON).
2. The canonicalized string is hashed using SHA-256.
3. The resulting hex digest is appended to the root object.

**Verification:**
Any third-party auditor can verify an exported `Decision Attestation` by:
1. Stripping the `cryptographicHash` field.
2. Re-running Canonical JSON serialization.
3. Re-computing SHA-256.
4. Comparing the result to the attached hash. If it matches, the snapshot and the human decision have not been altered since the moment of hiring.