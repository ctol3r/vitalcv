# B84 Tasks - Quick Summary

**Created**: 2025-11-07
**Total Tasks**: 150
**Frontend Tasks**: 10
**Backend Tasks**: 140

---

## 📊 Quick Stats

- **Frontend (v0-vital-cv-frontend-mvp)**: 10 tasks
- **Backend (chai-vc-platform)**: 140 tasks
- **Tasks with Dependencies**: 12 tasks
- **Missing Prerequisites**: B84-AUDIT-001, B84-TBIND-001

---

## 🎯 Frontend Tasks (10)

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| B84-FE-033 | Purpose-of-Use banner + attribute redaction diffs | High | 📋 Pending |
| B84-FE-041 | FHIR R6 PractitionerRole → VC mapping + conformance | High | 📋 Pending |
| B84-FE-046 | Enforce allowed_sinks at producer and consumer | High | 📋 Pending |
| B84-FE-067 | Release runbook + go/no-go generator | Medium | 📋 Pending |
| B84-FE-082 | Vault transit HSM-backed issuer key rotation | High | 📋 Pending |
| B84-FE-100 | OIDC4VCI: issuer metadata + ETag + integrity anchor | High | 📋 Pending |
| B84-FE-111 | Selective disclosure presets (Treatment vs Non-Treatment) | High | 📋 Pending |
| B84-FE-114 | Privileging: temporary ≤120d with NPDB/OIG triggers | High | 📋 Pending |
| B84-FE-140 | CI gate: green E2E + chaos + policy tests | Medium | 📋 Pending |
| B84-FE-146 | NPPES weekly ingest + FOIA-field canonicalize + hash | Medium | 📋 Pending |

---

## 📚 Documentation Created

1. **B84_TASKS_TRACKING.md** - Complete task breakdown with all 150 tasks organized by agent/component
2. **B84_FRONTEND_IMPLEMENTATION_GUIDE.md** - Detailed frontend implementation plan with file mappings
3. **B84_TASKS_SUMMARY.md** - This quick reference document

---

## 🔗 Key Dependencies

### Missing Prerequisites
- **B84-AUDIT-001**: Required by B84-PSV-007, B84-SIM-043, B84-AGENT-044, B84-POLICY-116
- **B84-TBIND-001**: Required by B84-PRIV-023, B84-SIM-032, B84-CI-049, B84-OBS-079, B84-POLICY-095, B84-NPI-105, B84-TBIND-059, B84-OIDC-143

---

## 🚀 Next Steps

1. **Review Frontend Tasks**: Prioritize based on current roadmap
2. **Identify Prerequisites**: Locate or create B84-AUDIT-001 and B84-TBIND-001
3. **Start Implementation**: Begin with Phase 1 security & compliance tasks
4. **Set Up Tracking**: Create GitHub issues or project board items

---

## 📋 Common Acceptance Criteria Patterns

- **Anchor/DLQ**: 47 tasks require "Anchor posted before 200; DLQ receipt on failure"
- **Interop**: 45 tasks require "Round-trip interop passes; unknown fields ignored"
- **Evidence**: 40 tasks require "Evidence ZIP contains policy, logs, hashes, attestation"
- **Unit Tests**: 38 tasks require unit test proof
- **E2E**: 35 tasks require Playwright E2E coverage
- **Grafana**: 32 tasks require Grafana panel with alerts
- **API Security**: 31 tasks require "API returns 403 on violation; audit hash recorded"

---

## 🎯 Implementation Phases

### Phase 1: Security & Compliance (Weeks 1-2)
- B84-FE-033, B84-FE-046, B84-FE-114

### Phase 2: Core Features (Weeks 3-4)
- B84-FE-041, B84-FE-100, B84-FE-111

### Phase 3: Operations & Infrastructure (Weeks 5-6)
- B84-FE-082, B84-FE-140, B84-FE-146, B84-FE-067

---

## 📝 Notes

- All tasks follow consistent format with ID, title, path, labels, acceptance criteria
- Frontend tasks are UX-focused and require UI/UX implementation
- Many tasks have security, compliance, and observability requirements
- Testing requirements are comprehensive (unit, E2E, interop)
- Evidence and audit requirements suggest compliance focus (NCQA, healthcare)

