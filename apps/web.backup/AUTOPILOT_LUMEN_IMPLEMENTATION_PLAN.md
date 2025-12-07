# Autopilot Mode + Lumen Interface Implementation Plan

## Executive Summary

This document outlines the step-by-step implementation plan for integrating **Autopilot Mode** (background credential management engine) and **Lumen Interface** (new UI/UX paradigm) into the VitalCV platform.

**Current State:**
- ✅ Frontend: AutopilotEngine exists but needs backend integration
- ✅ Backend: Placeholder routes exist in `vitalcv-backend/src/routes/autopilot.ts`
- ✅ Chain: Substrate integration exists in `vitalcv-backend/src/services/substrate.ts`
- ⚠️ Trust Score: Calculation exists in `chai-vc-platform` but needs integration
- ⚠️ Tasks: Placeholder implementations need real logic
- ⚠️ UI: Basic autopilot page exists but needs Lumen visuals

**Target State:**
- Fully functional Autopilot Engine with 4 core tasks
- Backend API endpoints for autopilot operations
- Chain re-anchoring logic for credential hashes
- Trust score computation and updates
- One-Page Mode UI with "Fix One Thing" / "You're Ready"
- Lumen Interface visual elements integrated

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AutopilotEngine (lib/autopilot/AutopilotEngine.ts)  │  │
│  │  - Scheduler                                          │  │
│  │  - Task Registry                                      │  │
│  │  - AI Reasoner                                        │  │
│  │  - Chain Bridge                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Lumen Interface (app/(wallet)/autopilot/page.tsx)    │  │
│  │  - Identity Orb                                       │  │
│  │  - One Page Mode                                      │  │
│  │  - "Fix One Thing" UI                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (vitalcv-backend)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes (routes/autopilot.ts)                        │  │
│  │  - GET  /api/autopilot/status                        │  │
│  │  - POST /api/autopilot/run                           │  │
│  │  - GET  /api/autopilot/tasks                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services (services/autopilot.ts)                     │  │
│  │  - VerifyAllCredentialsTask                          │  │
│  │  - RefreshLicensesTask                              │  │
│  │  - RefreshDEATask                                  │  │
│  │  - RecomputeTrustScoreTask                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Chain Integration (services/substrate.ts)           │  │
│  │  - addCredentialRecordOnChain()                     │  │
│  │  - Re-anchoring logic                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Substrate RPC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Substrate Chain                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Credential Registry Pallet                          │  │
│  │  - Stores credential hashes (no PII)                 │  │
│  │  - Receipts for audit trail                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Backend Core Tasks (Steps 1-4)

#### Step 1: Implement VerifyAllCredentialsTask
**File:** `vitalcv-backend/src/services/autopilot.ts`
- Query all credentials for a user (via NPI)
- Check expiration dates
- Verify chain anchors are present
- Return: `{ verified: number, expired: number, expiring: number }`

#### Step 2: Implement RefreshLicensesTask
**File:** `vitalcv-backend/src/services/autopilot.ts`
- Query state board APIs (placeholder for now)
- Compare with local records
- Update expired/expiring licenses
- Return: `{ updated: number, newLicenses: number }`

#### Step 3: Implement RefreshDEATask
**File:** `vitalcv-backend/src/services/autopilot.ts`
- Query DEA registration API (placeholder for now)
- Update DEA status
- Check expiration dates
- Return: `{ updated: boolean, status: string }`

#### Step 4: Implement RecomputeTrustScoreTask
**File:** `vitalcv-backend/src/services/autopilot.ts`
- Query all credentials
- Check expiration status
- Check chain anchor freshness
- Calculate trust score (0-100)
- Update trust score in database
- Return: `{ trustScore: number, factors: string[] }`

**Dependencies:**
- Need to check if trust score is stored in Prisma schema
- May need to integrate with `chai-vc-platform/apps/api/services/trust/trustScoreEngine.ts`

---

### Phase 2: Backend API Routes (Steps 5-7)

#### Step 5: Enhance GET /api/autopilot/status
**File:** `vitalcv-backend/src/routes/autopilot.ts`
- Query actual credentials from database
- Calculate real health metrics
- Get actual trust score
- Return comprehensive status object

#### Step 6: Implement POST /api/autopilot/run
**File:** `vitalcv-backend/src/routes/autopilot.ts`
- Execute all autopilot tasks in priority order
- Track execution results
- Update last run timestamp
- Return execution summary

#### Step 7: Enhance GET /api/autopilot/tasks
**File:** `vitalcv-backend/src/routes/autopilot.ts`
- Return prioritized list of tasks
- Include task metadata (priority, category, estimated duration)
- Filter by user's current state

---

### Phase 3: Chain Integration (Step 8)

#### Step 8: Implement Chain Re-anchoring Logic
**File:** `vitalcv-backend/src/services/autopilot.ts`
- Check if credentials have chain anchors
- Check if anchors are stale (>24 hours old)
- Re-anchor credentials using `addCredentialRecordOnChain()`
- Store transaction hashes in database
- Return: `{ reAnchored: number, failed: number }`

**Integration:**
- Use existing `vitalcv-backend/src/services/substrate.ts`
- Function: `addCredentialRecordOnChain(credHashHex, issuerDid, holderDid)`

---

### Phase 4: Frontend Integration (Steps 9-11)

#### Step 9: Connect Frontend to Backend API
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/lib/autopilot/api.ts`
- Update API client to use correct endpoints
- Handle authentication (if needed)
- Add error handling
- Update types to match backend responses

#### Step 10: Update AutopilotEngine Tasks
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/lib/autopilot/tasks/index.ts`
- Connect tasks to backend API calls
- Implement real task execution
- Add proper error handling
- Update task descriptions

#### Step 11: Integrate Trust Score Updates
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/contexts/AutopilotContext.tsx`
- Fetch trust score from backend
- Update UI when trust score changes
- Display trust score in health summary

---

### Phase 5: One-Page Mode UI (Steps 12-13)

#### Step 12: Enhance "Fix One Thing" UI
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/app/(wallet)/autopilot/page.tsx`
- Connect to real autopilot state
- Display actual most important task
- Implement "Fix This One Thing" button action
- Show real-time status updates

#### Step 13: Implement "You're Ready" State
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/app/(wallet)/autopilot/page.tsx`
- Detect when all tasks are complete
- Show "You're Ready" message
- Display trust score and compliance metrics
- Add celebration animation (optional)

---

### Phase 6: Lumen Interface Integration (Steps 14-16)

#### Step 14: Create Identity Orb Component
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/components/lumen/IdentityOrb.tsx`
- Animated breathing orb
- Color changes based on trust score
- Pulsing animation
- Integration with autopilot status

#### Step 15: Add Compliance Weather System
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/components/lumen/ComplianceWeather.tsx`
- Visual weather indicators (sunny, cloudy, stormy)
- Based on compliance status
- Animated transitions
- Integration with autopilot page

#### Step 16: Integrate Lumen Components
**File:** `v0-vital-cv-frontend-mvp/apps/web/src/app/(wallet)/autopilot/page.tsx`
- Replace placeholder orb with IdentityOrb
- Add ComplianceWeather component
- Update styling to match Lumen design system
- Add orbital layout for credentials

---

### Phase 7: Additional Features (Steps 17-18)

#### Step 17: Add Telemedicine Eligibility Endpoint
**File:** `vitalcv-backend/src/routes/autopilot.ts`
- New endpoint: `GET /api/autopilot/telemedicine-eligibility`
- Check DEA status
- Check compact coverage
- Check state licenses
- Return eligibility status

#### Step 18: Add Job Match Field (Minimal)
**File:** `vitalcv-backend/src/routes/autopilot.ts`
- New endpoint: `GET /api/autopilot/job-matches`
- Basic job matching logic
- Return top 3 matches
- Integration with existing job system (if any)

---

## Database Schema Requirements

### Check Existing Schema
**File:** `vitalcv-backend/prisma/schema.prisma`

**Required Fields:**
- `User.trustScore` (Float, optional)
- `Credential.expiresAt` (DateTime, optional)
- `Credential.chainHash` (String, optional)
- `Credential.chainAnchorLastUpdated` (DateTime, optional)

**If Missing:**
- Create migration to add these fields
- Update Prisma client

---

## File Manifest

### Backend Files to Modify/Create

1. `vitalcv-backend/src/services/autopilot.ts` - Implement all 4 tasks
2. `vitalcv-backend/src/routes/autopilot.ts` - Enhance all 3 endpoints
3. `vitalcv-backend/src/server.ts` - Register autopilot routes (if not already)
4. `vitalcv-backend/prisma/schema.prisma` - Add trust score fields (if needed)
5. `vitalcv-backend/src/services/substrate.ts` - Already exists, use as-is

### Frontend Files to Modify/Create

1. `v0-vital-cv-frontend-mvp/apps/web/src/lib/autopilot/api.ts` - Update API client
2. `v0-vital-cv-frontend-mvp/apps/web/src/lib/autopilot/tasks/index.ts` - Connect to backend
3. `v0-vital-cv-frontend-mvp/apps/web/src/contexts/AutopilotContext.tsx` - Add trust score
4. `v0-vital-cv-frontend-mvp/apps/web/src/app/(wallet)/autopilot/page.tsx` - Enhance UI
5. `v0-vital-cv-frontend-mvp/apps/web/src/components/lumen/IdentityOrb.tsx` - New component
6. `v0-vital-cv-frontend-mvp/apps/web/src/components/lumen/ComplianceWeather.tsx` - New component

---

## Testing Strategy

### Unit Tests
- Test each autopilot task independently
- Test trust score calculation
- Test chain re-anchoring logic

### Integration Tests
- Test full autopilot cycle
- Test API endpoints
- Test frontend-backend integration

### Manual Testing
- Test "Fix One Thing" flow
- Test "You're Ready" state
- Test Lumen visual components

---

## Migration/Refactor Notes

### Potential Issues

1. **Multiple Backend Repos:**
   - `vitalcv-backend` - Main backend (use this)
   - `chai-vc-platform` - Has trust score engine (may need to port)
   - `backend` - Another backend (check if used)

2. **Trust Score Location:**
   - Trust score calculation exists in `chai-vc-platform`
   - May need to port to `vitalcv-backend` or create shared service

3. **Database Schema:**
   - Need to verify if trust score is stored in Prisma schema
   - May need migration to add fields

4. **Chain Integration:**
   - Substrate integration exists but may need configuration
   - Check if chain node is running in development

---

## Success Criteria

### Phase 1-2 (Backend)
- ✅ All 4 tasks implemented and working
- ✅ All 3 API endpoints functional
- ✅ Trust score computed and stored

### Phase 3 (Chain)
- ✅ Chain re-anchoring logic working
- ✅ Credential hashes stored on-chain
- ✅ Transaction hashes stored in database

### Phase 4-5 (Frontend)
- ✅ Frontend connected to backend
- ✅ "Fix One Thing" displays real tasks
- ✅ "You're Ready" state works correctly

### Phase 6 (Lumen)
- ✅ Identity orb component created
- ✅ Compliance weather system working
- ✅ Lumen visuals integrated

### Phase 7 (Additional)
- ✅ Telemedicine eligibility endpoint
- ✅ Job match field (minimal)

---

## Next Steps

1. Review this plan
2. Confirm which backend repo to use
3. Check database schema for required fields
4. Verify chain integration setup
5. Start with Step 1 (small, safe changes)

---

**Ready for Step 1**

