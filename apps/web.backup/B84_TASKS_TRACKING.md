# B84 Tasks Tracking - Batch 84

**Created**: 2025-11-07
**Total Tasks**: 150
**Status**: Planning Phase

---

## 📊 Overview by Agent

### Frontend Tasks (CLAUDE|FRONTEND|v0-vital-cv-frontend-mvp)
**Count**: 10 tasks

| ID | Title | Path | Labels | Dependencies |
|----|-------|------|--------|--------------|
| B84-FE-033 | Purpose-of-Use banner + attribute redaction diffs | apps/web/ | ux | - |
| B84-FE-041 | FHIR R6 PractitionerRole → VC mapping + conformance | apps/web/ | ux | - |
| B84-FE-046 | Enforce allowed_sinks at producer and consumer | apps/web/ | ux | - |
| B84-FE-067 | Release runbook + go/no-go generator | apps/web/ | ux | - |
| B84-FE-082 | Vault transit HSM-backed issuer key rotation | apps/web/ | ux | - |
| B84-FE-100 | OIDC4VCI: issuer metadata + ETag + integrity anchor | apps/web/ | ux | - |
| B84-FE-111 | Selective disclosure presets (Treatment vs Non-Treatment) | apps/web/ | ux | - |
| B84-FE-114 | Privileging: temporary ≤120d with NPDB/OIG triggers | apps/web/ | ux | - |
| B84-FE-140 | CI gate: green E2E + chaos + policy tests | apps/web/ | ux | - |
| B84-FE-146 | NPPES weekly ingest + FOIA-field canonicalize + hash | apps/web/ | ux | - |

### Backend Tasks (CODEX|BACKEND|chai-vc-platform)
**Count**: 140 tasks

#### By Component

**SIM (services/agents/sim/)**: 8 tasks
- B84-SIM-001, B84-SIM-008, B84-SIM-018, B84-SIM-026, B84-SIM-032, B84-SIM-043, B84-SIM-101, B84-SIM-119

**AGENT (packages/agent-core/)**: 10 tasks
- B84-AGENT-002, B84-AGENT-024, B84-AGENT-027, B84-AGENT-029, B84-AGENT-030, B84-AGENT-044, B84-AGENT-054, B84-AGENT-076, B84-AGENT-087, B84-AGENT-104, B84-AGENT-106

**PRIV (apps/privileges-api/)**: 8 tasks
- B84-PRIV-003, B84-PRIV-023, B84-PRIV-047, B84-PRIV-070, B84-PRIV-083, B84-PRIV-097, B84-PRIV-112, B84-PRIV-128, B84-PRIV-141

**VP (apps/verifier-api/src/oidc4vp/)**: 5 tasks
- B84-VP-004, B84-VP-009, B84-VP-053, B84-VP-068, B84-VP-132, B84-VP-145, B84-VP-147

**OIDC (apps/issuer-api/src/oidc4vci/)**: 9 tasks
- B84-OIDC-005, B84-OIDC-012, B84-OIDC-019, B84-OIDC-020, B84-OIDC-045, B84-OIDC-050, B84-OIDC-055, B84-OIDC-065, B84-OIDC-110, B84-OIDC-113, B84-OIDC-143

**PSV (services/psv/)**: 9 tasks
- B84-PSV-007, B84-PSV-013, B84-PSV-017, B84-PSV-061, B84-PSV-071, B84-PSV-072, B84-PSV-073, B84-PSV-081, B84-PSV-108, B84-PSV-133, B84-PSV-148

**SINK (services/router/)**: 6 tasks
- B84-SINK-006, B84-SINK-010, B84-SINK-038, B84-SINK-091, B84-SINK-092, B84-SINK-131

**FHIR (services/fhir/)**: 5 tasks
- B84-FHIR-011, B84-FHIR-031, B84-FHIR-042, B84-FHIR-094, B84-FHIR-096, B84-FHIR-107, B84-FHIR-122, B84-FHIR-142

**NPI (services/npi/)**: 7 tasks
- B84-NPI-022, B84-NPI-035, B84-NPI-039, B84-NPI-063, B84-NPI-077, B84-NPI-078, B84-NPI-090, B84-NPI-105, B84-NPI-139

**AUDIT (services/audit/)**: 6 tasks
- B84-AUDIT-036, B84-AUDIT-062, B84-AUDIT-066, B84-AUDIT-117, B84-AUDIT-120, B84-AUDIT-130, B84-AUDIT-138, B84-AUDIT-144

**TBIND (apps/authz/)**: 7 tasks
- B84-TBIND-025, B84-TBIND-051, B84-TBIND-059, B84-TBIND-060, B84-TBIND-064, B84-TBIND-069, B84-TBIND-093, B84-TBIND-121, B84-TBIND-126

**CI (.github/workflows/)**: 6 tasks
- B84-CI-016, B84-CI-048, B84-CI-049, B84-CI-058, B84-CI-074, B84-CI-123, B84-CI-125

**POLICY (docs/policy/)**: 7 tasks
- B84-POLICY-021, B84-POLICY-056, B84-POLICY-085, B84-POLICY-086, B84-POLICY-088, B84-POLICY-089, B84-POLICY-095, B84-POLICY-116, B84-POLICY-127, B84-POLICY-129

**ADR (docs/adr/)**: 6 tasks
- B84-ADR-014, B84-ADR-052, B84-ADR-080, B84-ADR-084, B84-ADR-098, B84-ADR-099, B84-ADR-102, B84-ADR-109, B84-ADR-118, B84-ADR-124

**OBS (infra/observability/)**: 3 tasks
- B84-OBS-015, B84-OBS-037, B84-OBS-079, B84-OBS-103

**OPS (infra/)**: 2 tasks
- B84-OPS-040, B84-OPS-057

**SEC (packages/messaging-guard/)**: 5 tasks
- B84-SEC-028, B84-SEC-075, B84-SEC-134, B84-SEC-135, B84-SEC-137, B84-SEC-149, B84-SEC-150

**EUDI (services/eudi/)**: 2 tasks
- B84-EUDI-034, B84-EUDI-115, B84-EUDI-136

---

## 🎯 Frontend Tasks - Detailed Breakdown

### B84-FE-033: Purpose-of-Use banner + attribute redaction diffs
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- API returns 403 on violation; audit hash recorded
- Unit tests prove purpose-of-use banner + attribute redaction diffs enforcement
- Round-trip interop passes; unknown fields ignored

### B84-FE-041: FHIR R6 PractitionerRole → VC mapping + conformance
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- API returns 403 on violation; audit hash recorded
- Evidence ZIP contains policy, logs, hashes, attestation
- Grafana panel exposes fhir r6 practitionerrole → vc mapping + conformance with alerts

### B84-FE-046: Enforce allowed_sinks at producer and consumer
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Anchor posted before 200; DLQ receipt on failure
- Round-trip interop passes; unknown fields ignored
- Playwright E2E covers enforce allowed_sinks at producer and consumer

### B84-FE-067: Release runbook + go/no-go generator
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Round-trip interop passes; unknown fields ignored
- Playwright E2E covers release runbook + go/no-go generator
- API returns 403 on violation; audit hash recorded

### B84-FE-082: Vault transit HSM-backed issuer key rotation
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Evidence ZIP contains policy, logs, hashes, attestation
- Unit tests prove vault transit hsm-backed issuer key rotation enforcement
- Playwright E2E covers vault transit hsm-backed issuer key rotation

### B84-FE-100: OIDC4VCI: issuer metadata + ETag + integrity anchor
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Anchor posted before 200; DLQ receipt on failure
- Playwright E2E covers oidc4vci
- Evidence ZIP contains policy, logs, hashes, attestation

### B84-FE-111: Selective disclosure presets (Treatment vs Non-Treatment)
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- API returns 403 on violation; audit hash recorded
- Evidence ZIP contains policy, logs, hashes, attestation
- Round-trip interop passes; unknown fields ignored

### B84-FE-114: Privileging: temporary ≤120d with NPDB/OIG triggers
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Evidence ZIP contains policy, logs, hashes, attestation
- Playwright E2E covers privileging
- API returns 403 on violation; audit hash recorded

### B84-FE-140: CI gate: green E2E + chaos + policy tests
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Grafana panel exposes ci gate with alerts
- Unit tests prove ci gate enforcement
- Anchor posted before 200; DLQ receipt on failure

### B84-FE-146: NPPES weekly ingest + FOIA-field canonicalize + hash
**Path**: `apps/web/`
**Labels**: ux
**Acceptance Criteria**:
- Anchor posted before 200; DLQ receipt on failure
- Unit tests prove nppes weekly ingest + foia-field canonicalize + hash enforcement
- API returns 403 on violation; audit hash recorded

---

## 🔗 Dependencies

### Tasks with Dependencies

**B84-PSV-007** (depends_on: B84-AUDIT-001)
- Audit: evidence-before-200 gating with DLQ fallback

**B84-PRIV-023** (depends_on: B84-TBIND-001)
- DPoP proof validator (alg allowlist, jkt, skew±60s, c_nonce)

**B84-SIM-032** (depends_on: B84-TBIND-001)
- Security.md update (DPoP default; mTLS enterprise; sinks)

**B84-CI-049** (depends_on: B84-TBIND-001)
- Security.md update (DPoP default; mTLS enterprise; sinks)

**B84-OBS-079** (depends_on: B84-TBIND-001)
- DPoP proof validator (alg allowlist, jkt, skew±60s, c_nonce)

**B84-POLICY-095** (depends_on: B84-TBIND-001)
- DPoP proof validator (alg allowlist, jkt, skew±60s, c_nonce)

**B84-NPI-105** (depends_on: B84-TBIND-001)
- DPoP proof validator (alg allowlist, jkt, skew±60s, c_nonce)

**B84-TBIND-059** (depends_on: B84-TBIND-001)
- DPoP proof validator (alg allowlist, jkt, skew±60s, c_nonce)

**B84-OIDC-143** (depends_on: B84-TBIND-001)
- DPoP proof validator (alg allowlist, jkt, skew±60s, c_nonce)

**B84-SIM-043** (depends_on: B84-AUDIT-001)
- Audit: evidence-before-200 gating with DLQ fallback

**B84-AGENT-044** (depends_on: B84-AUDIT-001)
- Audit: evidence-before-200 gating with DLQ fallback

**B84-POLICY-116** (depends_on: B84-AUDIT-001)
- Audit: evidence-before-200 gating with DLQ fallback

**Note**: Missing prerequisite tasks (B84-AUDIT-001, B84-TBIND-001) need to be identified or created.

---

## 📋 Acceptance Criteria Patterns

### Common Acceptance Criteria Types

1. **Anchor/DLQ**: "Anchor posted before 200; DLQ receipt on failure" (appears 47 times)
2. **Interop**: "Round-trip interop passes; unknown fields ignored" (appears 45 times)
3. **Evidence**: "Evidence ZIP contains policy, logs, hashes, attestation" (appears 40 times)
4. **Unit Tests**: "Unit tests prove [feature] enforcement" (appears 38 times)
5. **E2E**: "Playwright E2E covers [feature]" (appears 35 times)
6. **Grafana**: "Grafana panel exposes [feature] with alerts" (appears 32 times)
7. **API Security**: "API returns 403 on violation; audit hash recorded" (appears 31 times)

---

## 🚀 Next Steps

1. **Review Frontend Tasks**: Prioritize the 10 frontend tasks based on current roadmap
2. **Identify Missing Prerequisites**: Locate or create B84-AUDIT-001 and B84-TBIND-001
3. **Create Implementation Plan**: Break down frontend tasks into actionable items
4. **Set Up Tracking**: Create GitHub issues or project board items for each task
5. **Dependency Resolution**: Ensure prerequisite tasks are completed first

---

## 📝 Notes

- All tasks follow a consistent format with ID, title, path, labels, acceptance criteria
- Frontend tasks are UX-focused and likely require UI/UX implementation
- Many tasks have security, compliance, and observability requirements
- Testing requirements are comprehensive (unit, E2E, interop)
- Evidence and audit requirements suggest compliance focus (NCQA, healthcare)

