# B84 Frontend Tasks - Implementation Guide

**Created**: 2025-11-07
**Frontend Tasks**: 10
**Project**: v0-vital-cv-frontend-mvp (Next.js App Router)

---

## 📋 Task Overview

All frontend tasks are located in `apps/web/` according to the task definitions, which maps to the root `app/` directory in this Next.js project.

---

## 🎯 Task Breakdown & Implementation Plan

### 1. B84-FE-033: Purpose-of-Use banner + attribute redaction diffs

**Path**: `apps/web/` → `app/components/` or `app/compliance/`
**Labels**: ux
**Priority**: High (Security/Privacy)

**Acceptance Criteria**:
- ✅ API returns 403 on violation; audit hash recorded
- ✅ Unit tests prove purpose-of-use banner + attribute redaction diffs enforcement
- ✅ Round-trip interop passes; unknown fields ignored

**Implementation Notes**:
- Create a Purpose-of-Use banner component showing why data is being accessed
- Implement attribute redaction visualization (show diffs of what was redacted)
- Integrate with compliance/compliance page
- Add audit logging for redaction events

**Suggested Files**:
- `app/components/PurposeOfUseBanner.tsx` (new)
- `app/components/AttributeRedactionDiff.tsx` (new)
- `app/compliance/page.tsx` (update)

---

### 2. B84-FE-041: FHIR R6 PractitionerRole → VC mapping + conformance

**Path**: `apps/web/` → `app/verifier/` or `app/components/`
**Labels**: ux
**Priority**: High (Interoperability)

**Acceptance Criteria**:
- ✅ API returns 403 on violation; audit hash recorded
- ✅ Evidence ZIP contains policy, logs, hashes, attestation
- ✅ Grafana panel exposes fhir r6 practitionerrole → vc mapping + conformance with alerts

**Implementation Notes**:
- Create FHIR R6 PractitionerRole to VC mapping visualization
- Show conformance checking UI
- Display mapping rules and validation results
- Integrate with verifier flow

**Suggested Files**:
- `app/verifier/fhir/page.tsx` (update or create)
- `app/components/FhirVcMapping.tsx` (new)
- `app/components/ConformanceChecker.tsx` (new)

---

### 3. B84-FE-046: Enforce allowed_sinks at producer and consumer

**Path**: `apps/web/` → `app/components/` or `app/admin/`
**Labels**: ux
**Priority**: High (Security)

**Acceptance Criteria**:
- ✅ Anchor posted before 200; DLQ receipt on failure
- ✅ Round-trip interop passes; unknown fields ignored
- ✅ Playwright E2E covers enforce allowed_sinks at producer and consumer

**Implementation Notes**:
- Create UI for configuring allowed_sinks
- Show enforcement status at producer/consumer levels
- Display violations and DLQ status
- Add admin controls for sink management

**Suggested Files**:
- `app/admin/sinks/page.tsx` (new)
- `app/components/SinkEnforcement.tsx` (new)
- `app/components/DLQStatus.tsx` (new)

---

### 4. B84-FE-067: Release runbook + go/no-go generator

**Path**: `apps/web/` → `app/admin/` or `app/dev/`
**Labels**: ux
**Priority**: Medium (DevOps)

**Acceptance Criteria**:
- ✅ Round-trip interop passes; unknown fields ignored
- ✅ Playwright E2E covers release runbook + go/no-go generator
- ✅ API returns 403 on violation; audit hash recorded

**Implementation Notes**:
- Create release runbook generator UI
- Build go/no-go checklist interface
- Integrate with CI/CD status
- Show release readiness metrics

**Suggested Files**:
- `app/admin/release/page.tsx` (new)
- `app/components/ReleaseRunbook.tsx` (new)
- `app/components/GoNoGoChecklist.tsx` (new)

---

### 5. B84-FE-082: Vault transit HSM-backed issuer key rotation

**Path**: `apps/web/` → `app/admin/crypto/`
**Labels**: ux
**Priority**: High (Security)

**Acceptance Criteria**:
- ✅ Evidence ZIP contains policy, logs, hashes, attestation
- ✅ Unit tests prove vault transit hsm-backed issuer key rotation enforcement
- ✅ Playwright E2E covers vault transit hsm-backed issuer key rotation

**Implementation Notes**:
- Create key rotation UI in admin/crypto
- Show HSM-backed key status
- Display rotation schedule and history
- Add evidence export functionality

**Suggested Files**:
- `app/admin/crypto/page.tsx` (update)
- `app/components/KeyRotation.tsx` (new)
- `app/components/HSMStatus.tsx` (new)

---

### 6. B84-FE-100: OIDC4VCI: issuer metadata + ETag + integrity anchor

**Path**: `apps/web/` → `app/issuer/` or `app/components/`
**Labels**: ux
**Priority**: High (OIDC/VC)

**Acceptance Criteria**:
- ✅ Anchor posted before 200; DLQ receipt on failure
- ✅ Playwright E2E covers oidc4vci
- ✅ Evidence ZIP contains policy, logs, hashes, attestation

**Implementation Notes**:
- Create issuer metadata display
- Show ETag and cache status
- Display integrity anchor information
- Integrate with issuer flow

**Suggested Files**:
- `app/issuer/page.tsx` (update)
- `app/components/OidcIssuerMetadata.tsx` (new)
- `app/components/IntegrityAnchor.tsx` (new)

---

### 7. B84-FE-111: Selective disclosure presets (Treatment vs Non-Treatment)

**Path**: `apps/web/` → `app/components/` or `app/wallet/`
**Labels**: ux
**Priority**: High (Privacy)

**Acceptance Criteria**:
- ✅ API returns 403 on violation; audit hash recorded
- ✅ Evidence ZIP contains policy, logs, hashes, attestation
- ✅ Round-trip interop passes; unknown fields ignored

**Implementation Notes**:
- Create selective disclosure preset selector
- Show Treatment vs Non-Treatment presets
- Display what attributes are disclosed per preset
- Integrate with wallet presentation flow

**Suggested Files**:
- `app/components/SelectiveDisclosureCard.tsx` (update - already exists!)
- `app/components/DisclosurePresets.tsx` (new)
- `app/wallet/present/page.tsx` (update)

---

### 8. B84-FE-114: Privileging: temporary ≤120d with NPDB/OIG triggers

**Path**: `apps/web/` → `app/compliance/` or `app/admin/`
**Labels**: ux
**Priority**: High (Compliance)

**Acceptance Criteria**:
- ✅ Evidence ZIP contains policy, logs, hashes, attestation
- ✅ Playwright E2E covers privileging
- ✅ API returns 403 on violation; audit hash recorded

**Implementation Notes**:
- Create temporary privileging UI (≤120 days)
- Show NPDB/OIG trigger status
- Display privilege expiration and renewal
- Add compliance evidence export

**Suggested Files**:
- `app/admin/privileges/page.tsx` (new)
- `app/components/TemporaryPrivilege.tsx` (new)
- `app/components/NPDBOIGTriggers.tsx` (new)

---

### 9. B84-FE-140: CI gate: green E2E + chaos + policy tests

**Path**: `apps/web/` → `app/dev/` or `app/admin/`
**Labels**: ux
**Priority**: Medium (DevOps)

**Acceptance Criteria**:
- ✅ Grafana panel exposes ci gate with alerts
- ✅ Unit tests prove ci gate enforcement
- ✅ Anchor posted before 200; DLQ receipt on failure

**Implementation Notes**:
- Create CI gate status dashboard
- Show E2E test results
- Display chaos test results
- Show policy test compliance

**Suggested Files**:
- `app/dev/gates/page.tsx` (update - already exists!)
- `app/components/CIGateStatus.tsx` (new)
- `app/components/TestResults.tsx` (new)

---

### 10. B84-FE-146: NPPES weekly ingest + FOIA-field canonicalize + hash

**Path**: `apps/web/` → `app/admin/` or `app/npi/`
**Labels**: ux
**Priority**: Medium (Data Management)

**Acceptance Criteria**:
- ✅ Anchor posted before 200; DLQ receipt on failure
- ✅ Unit tests prove nppes weekly ingest + foia-field canonicalize + hash enforcement
- ✅ API returns 403 on violation; audit hash recorded

**Implementation Notes**:
- Create NPPES ingest status dashboard
- Show weekly ingest schedule and status
- Display FOIA field canonicalization
- Show hash verification status

**Suggested Files**:
- `app/admin/nppes/page.tsx` (new)
- `app/components/NPPESIngest.tsx` (new)
- `app/components/FOIACanonicalize.tsx` (new)

---

## 🗂️ File Structure Mapping

```
app/
├── admin/                          # Admin interfaces
│   ├── crypto/page.tsx            # B84-FE-082 (update)
│   ├── release/page.tsx           # B84-FE-067 (new)
│   ├── sinks/page.tsx            # B84-FE-046 (new)
│   ├── privileges/page.tsx       # B84-FE-114 (new)
│   └── nppes/page.tsx             # B84-FE-146 (new)
├── components/
│   ├── PurposeOfUseBanner.tsx     # B84-FE-033 (new)
│   ├── AttributeRedactionDiff.tsx # B84-FE-033 (new)
│   ├── FhirVcMapping.tsx          # B84-FE-041 (new)
│   ├── ConformanceChecker.tsx     # B84-FE-041 (new)
│   ├── SinkEnforcement.tsx        # B84-FE-046 (new)
│   ├── DLQStatus.tsx              # B84-FE-046 (new)
│   ├── ReleaseRunbook.tsx         # B84-FE-067 (new)
│   ├── GoNoGoChecklist.tsx        # B84-FE-067 (new)
│   ├── KeyRotation.tsx            # B84-FE-082 (new)
│   ├── HSMStatus.tsx              # B84-FE-082 (new)
│   ├── OidcIssuerMetadata.tsx    # B84-FE-100 (new)
│   ├── IntegrityAnchor.tsx        # B84-FE-100 (new)
│   ├── DisclosurePresets.tsx     # B84-FE-111 (new)
│   ├── TemporaryPrivilege.tsx    # B84-FE-114 (new)
│   ├── NPDBOIGTriggers.tsx       # B84-FE-114 (new)
│   ├── CIGateStatus.tsx           # B84-FE-140 (new)
│   ├── TestResults.tsx            # B84-FE-140 (new)
│   ├── NPPESIngest.tsx           # B84-FE-146 (new)
│   └── FOIACanonicalize.tsx       # B84-FE-146 (new)
├── compliance/
│   └── page.tsx                   # B84-FE-033 (update)
├── verifier/
│   └── fhir/page.tsx              # B84-FE-041 (update/create)
├── issuer/
│   └── page.tsx                   # B84-FE-100 (update)
├── wallet/
│   └── present/page.tsx          # B84-FE-111 (update)
└── dev/
    └── gates/page.tsx            # B84-FE-140 (update)
```

---

## 🚀 Implementation Priority

### Phase 1: Security & Compliance (Weeks 1-2)
1. **B84-FE-033**: Purpose-of-Use banner + attribute redaction diffs
2. **B84-FE-046**: Enforce allowed_sinks at producer and consumer
3. **B84-FE-114**: Privileging: temporary ≤120d with NPDB/OIG triggers

### Phase 2: Core Features (Weeks 3-4)
4. **B84-FE-041**: FHIR R6 PractitionerRole → VC mapping + conformance
5. **B84-FE-100**: OIDC4VCI: issuer metadata + ETag + integrity anchor
6. **B84-FE-111**: Selective disclosure presets (Treatment vs Non-Treatment)

### Phase 3: Operations & Infrastructure (Weeks 5-6)
7. **B84-FE-082**: Vault transit HSM-backed issuer key rotation
8. **B84-FE-140**: CI gate: green E2E + chaos + policy tests
9. **B84-FE-146**: NPPES weekly ingest + FOIA-field canonicalize + hash
10. **B84-FE-067**: Release runbook + go/no-go generator

---

## ✅ Testing Requirements

Each task requires:
1. **Unit Tests**: Jest tests for component logic
2. **E2E Tests**: Playwright tests for user flows
3. **Integration Tests**: API integration tests
4. **Accessibility**: WCAG 2.1 AA compliance

---

## 📝 Notes

- All components should follow existing patterns in the codebase
- Use shadcn/ui components where possible
- Follow TypeScript strict mode
- Implement proper error handling and loading states
- Add proper accessibility attributes (ARIA labels, keyboard navigation)
- Ensure mobile responsiveness

---

## 🔗 Related Backend Tasks

These frontend tasks depend on backend implementation:
- Backend APIs for each feature
- Audit logging endpoints
- Evidence ZIP generation
- Grafana integration
- DLQ monitoring

