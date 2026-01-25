# Compliance Scaffolding

**Status**: Scaffolding only - no automation claims

---

## AuditScrapbook Schema

### Event Structure

```typescript
interface AuditEvent {
  event_id: string;           // UUID
  timestamp: Date;            // ISO 8601
  actor_id: string;           // DID or user ID
  action: string;             // "issue" | "verify" | "revoke" | "share" | "decide"
  resource_type: string;      // "credential" | "token" | "decision"
  resource_id: string;        // Credential ID, token ID, etc.
  context: {
    purpose?: string;         // Why this action occurred
    scope?: string[];         // What data was accessed
    audience?: string;        // Who requested/received
  };
  outcome: "success" | "failure" | "blocked";
  reason?: string;           // If blocked or failed
  evidence_hash?: string;    // SHA-256 of supporting data
  retention_policy: string;  // "7y" | "10y" | "indefinite"
}
```

### Storage Requirements

- **Retention**: Minimum 7 years (configurable per jurisdiction)
- **Immutability**: Append-only log, no deletions except per GDPR erasure
- **Encryption**: At-rest AES-256, in-transit TLS 1.3
- **Access Control**: Role-based, audited access to audit logs

---

## Evidence Retention Markers

### Credential Issuance

```typescript
// EVIDENCE_RETENTION: 10 years (medical credential issuance)
// RETENTION_START: credential.issued_at
// GDPR_ERASURE: Allow after retention period, subject consent withdrawal
function issueCredential(input: IssueCredentialInput): Credential {
  // Record audit event with retention marker
  auditScrapbook.record({
    action: "issue",
    resource_type: "credential",
    retention_policy: "10y",
    context: {
      purpose: input.purpose,
      scope: ["npi", "license_number", "specialty"],
    },
  });
  // ... issue logic
}
```

### Verification Decisions

```typescript
// EVIDENCE_RETENTION: 7 years (employment decision audit trail)
// RETENTION_START: decision.decision_at
// GDPR_ERASURE: Not allowed (employment compliance requirement)
function makeDecision(input: MakeDecisionInput): DecisionReceipt {
  // Record audit event with retention marker
  auditScrapbook.record({
    action: "decide",
    resource_type: "decision",
    retention_policy: "7y",
    context: {
      purpose: "employment_verification",
      audience: input.verifier_id,
    },
  });
  // ... decision logic
}
```

---

## Consent + Purpose Binding

### Holder Consent (ShareToken Creation)

```typescript
// CONSENT_REQUIRED: Yes (holder-first presentation)
// PURPOSE_BINDING: Yes (scope and purpose must match consent)
// AUDIT_EVENT: "share_token_created"
function createShareToken(input: CreateShareTokenInput): ShareToken {
  // Verify holder consent
  if (!input.holder_consent_signature) {
    throw new Error("Holder consent required for share token creation");
  }

  // Record consent in audit log
  auditScrapbook.record({
    action: "share",
    resource_type: "token",
    actor_id: input.holder_id,
    context: {
      purpose: input.purpose,          // e.g., "employment_verification"
      scope: input.scope,              // e.g., ["credentials", "readiness_status"]
      audience: input.verifier_id,     // e.g., "employer:12345"
      consent_signature: input.holder_consent_signature,
    },
    retention_policy: "7y",
  });

  // Generate token with purpose binding
  return {
    token_id: generateTokenId(),
    holder_id: input.holder_id,
    purpose: input.purpose,            // Purpose binding
    scope: input.scope,                // Scope limitation
    issued_at: new Date(),
    expires_at: new Date(Date.now() + input.ttl_seconds * 1000),
  };
}
```

### Verifier Access (Token Verification)

```typescript
// CONSENT_ENFORCEMENT: Verify token purpose matches verifier intent
// PURPOSE_CHECK: Reject if verifier purpose != token.purpose
// AUDIT_EVENT: "token_verified"
function verifyForEmployer(input: VerifyForEmployerInput): VerificationSummary {
  const token = resolveToken(input.token_id);

  // Enforce purpose binding
  if (input.verifier_intent !== token.purpose) {
    auditScrapbook.record({
      action: "verify",
      outcome: "blocked",
      reason: "Purpose mismatch: verifier intent does not match holder consent",
      context: {
        token_purpose: token.purpose,
        verifier_intent: input.verifier_intent,
      },
    });
    throw new PurposeMismatchError("Verifier purpose does not match holder consent");
  }

  // Record successful verification
  auditScrapbook.record({
    action: "verify",
    resource_type: "token",
    outcome: "success",
    context: {
      purpose: token.purpose,
      scope: token.scope,
      audience: input.verifier_id,
    },
    retention_policy: "7y",
  });

  // ... verification logic
}
```

---

## GDPR Right-to-Erasure

### Holder Data Deletion

```typescript
// GDPR_ERASURE: Partial (audit logs retained per legal obligation)
// ERASURE_SCOPE: PII only (credentials, tokens), audit logs pseudonymized
function requestDataDeletion(holder_id: string): DeletionReceipt {
  // 1. Delete credentials
  await credentialStore.delete({ holder_id });

  // 2. Delete share tokens
  await shareTokenStore.delete({ holder_id });

  // 3. Pseudonymize audit logs (retain structure, remove PII)
  await auditScrapbook.pseudonymize({
    actor_id: holder_id,
    replacement: `<deleted-user-${crypto.randomUUID()}>`,
  });

  // 4. Record deletion event
  auditScrapbook.record({
    action: "delete_personal_data",
    actor_id: holder_id,
    outcome: "success",
    retention_policy: "indefinite",  // Deletion record itself must be retained
  });

  return {
    deletion_id: crypto.randomUUID(),
    deleted_at: new Date(),
    scope: ["credentials", "tokens"],
    audit_logs: "pseudonymized",
  };
}
```

---

## Implementation Notes

### No Automation Claims

- **Scaffolding Only**: This document defines schema and markers, not implementation
- **Manual Processes**: Actual audit logging requires manual integration at each decision point
- **Review Required**: Legal/compliance review needed before production deployment

### Next Steps

1. **@compliance-owner**: Review schema with legal counsel
2. **@backend-integration**: Implement AuditScrapbook storage layer
3. **@security-owner**: Configure encryption and access controls
4. **@standards-owner**: Map to SOC2/HIPAA control requirements

---

**Last Updated**: 2026-01-25  
**Status**: Scaffolding (not implemented)
