# Credential Delegation & Team-Based Identity Engine v1.0

**Status**: Phase 1 Complete, Phase 2 In Progress
**Created**: 2025-01-XX

---

## Overview

A comprehensive delegation and team-based identity system that enables role-based authority delegation, chain-backed supervisory relationships, and team hierarchy visualization for healthcare credentialing.

---

## Phase 1: Team Authority Graph Core ✅

### Completed Tasks

1. ✅ **DelegationEngine Service** (`vitalcv-backend/src/services/delegationEngine.ts`)
   - Core delegation logic
   - Authority level validation
   - Chain anchoring integration
   - Expiration handling

2. ✅ **Prisma Schema Models**
   - `DelegationNode`: Clinician nodes with role, authority level (0-5), department, DID
   - `DelegationEdge`: Delegation relationships with capabilities (grantsAuthority, supervises, signsOff, approvesTraining, validatesProcedure)
   - `DelegationAction`: Audit trail for all delegated actions

3. ✅ **Backend API Endpoints** (`vitalcv-backend/src/routes/delegation.ts`)
   - `GET /api/delegation/graph/fetch` - Fetch delegation graph
   - `POST /api/delegation/assign` - Create delegation
   - `POST /api/delegation/revoke` - Revoke delegation
   - `GET /api/delegation/authority/check` - Check authority
   - `POST /api/delegation/node` - Create/update node
   - `POST /api/delegation/action` - Record delegated action
   - `GET /api/delegation/permissions` - Get role permission matrix

4. ✅ **DID Binding**
   - Nodes support DID field for supervisor/approver identity
   - Chain anchoring uses DID when available

5. ✅ **Chain Anchoring**
   - `AuthorityGranted` events anchored via `anchorAuthorityGrantedOnChain()`
   - All delegations get on-chain hash
   - Delegated actions also anchored

6. ✅ **Authority Expiration**
   - Time-limited delegations supported
   - Expiration checked in all queries
   - Automatic filtering of expired delegations

7. ✅ **Deep Link Support** (`lib/delegation/deepLink.ts`)
   - `vitalcv://delegation` URL scheme
   - Supports assign, view, revoke actions
   - Parameter parsing and generation

---

## Phase 2: Role-Based Delegation Flows 🚧

### Completed

8. ✅ **DelegationAssignmentView** (`app/(wallet)/delegation/assign/page.tsx`)
   - Full form for creating delegations
   - All delegation types supported
   - Expiration options (24h, 1 week, 1 month, custom date)
   - Capability checkboxes

9. ✅ **Delegation Types**
   - Procedure Approval
   - Credential Verification
   - Skill Attestation
   - Shift Readiness
   - Training Sign-Off

10. ✅ **Permission Matrix**
    - Attending > Resident > Intern/Student
    - Charge RN > Staff RN
    - Department Chief > All within dept
    - Implemented in `getRolePermissionMatrix()`

11. ✅ **Temporary Delegation**
    - Expiration support (24h, 1 week, 1 month, custom)
    - Automatic filtering of expired delegations

12. ✅ **Revocation Flow** (`app/(wallet)/delegation/revoke/page.tsx`)
    - Revocation endpoint
    - Confirmation UI
    - Audit trail

### In Progress / Pending

13. ⏳ **Request Delegated Authority Workflow**
    - Clinician-initiated requests
    - Approval workflow
    - Notification system

14. ⏳ **Chain Receipts**
    - Display chain hashes in UI
    - Verification links
    - Receipt download

15. ⏳ **AI Suggestions**
    - "You need authority level 3 to approve this skill"
    - Context-aware recommendations
    - Authority gap analysis

---

## Phase 3: Team-Based Identity UI 📋

### Pending

16. ⏳ **TeamIdentityView Component**
    - Hierarchy visualization
    - Tree/orbit map
    - Interactive exploration

17. ⏳ **Hierarchy Visualization**
    - D3.js or React Flow integration
    - Tree layout
    - Orbit/force-directed graph option

18. ⏳ **Trust Glow**
    - Visual highlighting of supervisory relationships
    - Trust score visualization
    - Relationship strength indicators

19. ⏳ **Delegate Badges**
    - Badge component for clinician profiles
    - Authority level indicators
    - Delegation count badges

20. ⏳ **Approver Privileges Tab**
    - What they can authorize
    - Active delegations list
    - Authority scope visualization

21. ⏳ **Role Mode Switching**
    - Faculty / Clinician / Evaluator modes
    - Context-aware UI
    - Mode-specific actions

22. ⏳ **Tap-to-Expand Trees**
    - Expandable subordinate trees
    - Lazy loading
    - Smooth animations

23. ⏳ **AI Team Health Analysis**
    - Coverage analysis
    - Risk assessment
    - Compliance checking
    - Recommendations

---

## Phase 4: Delegated Actions & Workflows 📋

### Pending

24. ⏳ **Delegated Attestation Workflow**
    - Skill verification
    - Training evaluation
    - Credential approval (within bounds)

25. ⏳ **Delegated Privileging Checks**
    - Authority validation
    - Scope verification
    - Audit logging

26. ⏳ **Delegated Shift-Readiness Signoff**
    - Charge nurse approval
    - Chief resident approval
    - Shift assignment workflow

27. ⏳ **Delegated Telemedicine Eligibility**
    - Proxy approval
    - Prescriptive authority delegation
    - State-specific rules

28. ⏳ **Delegated Recommendations**
    - Endorsement approvals
    - Reference validation
    - Chain of trust

29. ⏳ **Delegated Risk Mitigation**
    - AI override requirements
    - Authority verification
    - Risk escalation

30. ⏳ **Delegated Facility Onboarding**
    - Approval workflow
    - Credential verification
    - Fast-track for delegated approvers

31. ⏳ **Chain Logging**
    - Every action anchored
    - Immutable audit trail
    - Verification links

---

## Phase 5: Integration Across Ecosystem 📋

### Pending

32. ⏳ **Delegation→Growth Mapping**
    - "To gain this authority, complete X"
    - Career path visualization
    - Skill requirements

33. ⏳ **Recruiter View**
    - "This clinician can approve Y-level tasks"
    - Authority summary
    - Delegation history

34. ⏳ **Safety Engine Integration**
    - Delegated authority influences riskScore
    - Authority-based risk adjustments
    - Safety compliance checks

35. ⏳ **Scheduling Engine Integration**
    - Delegations influence shift structure
    - Authority-based scheduling
    - Coverage optimization

36. ⏳ **Skills Engine Integration**
    - Delegated supervisors required for certain skill levels
    - Authority validation
    - Skill approval workflow

37. ⏳ **Telemedicine Engine Integration**
    - Delegated prescriptive authority logic
    - State-specific rules
    - Eligibility checks

38. ⏳ **Facility Passport Integration**
    - Delegated authority speeds onboarding
    - Fast-track approval
    - Credential verification

39. ⏳ **v1.0 Snapshot**
    - Final documentation
    - Integration checklist
    - Deployment guide

---

## Database Schema

```prisma
model DelegationNode {
  id            String   @id @default(cuid())
  clinicianId   String   @unique
  role          String
  authorityLevel Int      // 0-5
  department    String?
  did           String?
  // ... relations
}

model DelegationEdge {
  id                String   @id @default(cuid())
  delegatorNodeId   String
  delegateeNodeId   String
  grantsAuthority   Boolean
  supervises        Boolean
  signsOff          Boolean
  approvesTraining  Boolean
  validatesProcedure Boolean
  delegationType    String?
  expiresAt          DateTime?
  revokedAt          DateTime?
  onChainHash        String?
  // ... relations
}

model DelegationAction {
  id          String   @id @default(cuid())
  edgeId      String
  actionType  String
  performedBy String
  targetId    String?
  targetType  String?
  metadata    Json?
  onChainHash String?
  // ... relations
}
```

---

## API Reference

### GET /api/delegation/graph/fetch
Fetch delegation graph for a clinician or department.

**Query Params:**
- `clinicianId` (optional): Filter by clinician
- `department` (optional): Filter by department

**Response:**
```json
{
  "nodes": [...],
  "edges": [...]
}
```

### POST /api/delegation/assign
Create a new delegation.

**Body:**
```json
{
  "delegatorClinicianId": "string",
  "delegateeClinicianId": "string",
  "delegationType": "Procedure Approval",
  "grantsAuthority": boolean,
  "supervises": boolean,
  "signsOff": boolean,
  "approvesTraining": boolean,
  "validatesProcedure": boolean,
  "expiresAt": "ISO date string (optional)"
}
```

### POST /api/delegation/revoke
Revoke a delegation.

**Body:**
```json
{
  "edgeId": "string",
  "revokedBy": "string"
}
```

---

## Next Steps

1. **Complete Phase 2**: Request workflow, chain receipts, AI suggestions
2. **Build Phase 3**: TeamIdentityView with hierarchy visualization
3. **Implement Phase 4**: Delegated action workflows
4. **Integrate Phase 5**: Cross-system integrations
5. **Testing & Documentation**: Comprehensive test suite and user guides

---

## Files Created

### Backend
- `vitalcv-backend/prisma/schema.prisma` - Added delegation models
- `vitalcv-backend/src/services/delegationEngine.ts` - Core engine
- `vitalcv-backend/src/routes/delegation.ts` - API routes
- `vitalcv-backend/src/services/substrate.ts` - Added `anchorAuthorityGrantedOnChain()`

### Frontend
- `v0-vital-cv-frontend-mvp/lib/delegation/deepLink.ts` - Deep link utilities
- `v0-vital-cv-frontend-mvp/apps/web/src/app/(wallet)/delegation/assign/page.tsx` - Assignment UI
- `v0-vital-cv-frontend-mvp/apps/web/src/app/(wallet)/delegation/revoke/page.tsx` - Revocation UI

---

## Migration Required

Run Prisma migration to add delegation models:

```bash
cd vitalcv-backend
npx prisma migrate dev --name add_delegation_engine
npx prisma generate
```

---

**Built with ❤️ for healthcare credentialing teams**

