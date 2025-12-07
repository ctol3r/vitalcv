# 7-Week Critical Path to Pilot

## Week 1: Foundation & Core Backend
**Goal**: Backend infrastructure and basic claim flow

### Critical Tasks
- [x] Backend route separation (npi.ts, claimDoc.ts, claimBasic.ts, claimStatus.ts)
- [ ] Health check endpoint
- [ ] Basic logging setup
- [ ] Docker compose for local development
- [ ] Database schema migration for Claims
- [ ] NPI lookup service with Redis cache

### Deliverables
- Working `/api/npi/lookup` endpoint
- Working `/api/claim/doc` endpoint
- Working `/api/claim/basic` endpoint
- Working `/api/claim/status` endpoint

## Week 2: Frontend & UI Components
**Goal**: Frontend claim wizard and status tracking

### Critical Tasks
- [x] ClaimWizard component
- [x] App Router page at `/start`
- [ ] ClaimStatusBadge component
- [ ] Status polling hook
- [ ] File upload UI
- [ ] MSW mocks for development

### Deliverables
- Complete claim submission flow in UI
- Status tracking and updates
- Responsive design

## Week 3: Integration & Workflow
**Goal**: End-to-end claim processing workflow

### Critical Tasks
- [ ] OCR stub implementation
- [ ] Job queue for async processing
- [ ] ACA-Py integration stub
- [ ] Issuer attestation flow
- [ ] Status progression logic

### Deliverables
- Complete claim lifecycle: upload → OCR → attestation → VC issuance
- Background job processing
- Status updates via polling

## Week 4: Security & Compliance
**Goal**: Security hardening and compliance checks

### Critical Tasks
- [ ] Rate limiting middleware
- [ ] CORS configuration for widget
- [ ] File upload security (size limits, type validation)
- [ ] PHI redaction in audit logs
- [ ] Security audit checklist

### Deliverables
- Secure file uploads
- Protected API endpoints
- HIPAA compliance notes

## Week 5: Testing & QA
**Goal**: Comprehensive testing and bug fixes

### Critical Tasks
- [ ] Cypress E2E tests for full flow
- [ ] Backend unit tests (Supertest)
- [ ] Frontend component tests (React Testing Library)
- [ ] Integration tests
- [ ] Load testing

### Deliverables
- Full test coverage for critical paths
- Bug fixes and refinements
- Performance optimization

## Week 6: Operations & Documentation
**Goal**: Deployment readiness and documentation

### Critical Tasks
- [ ] Docker production configuration
- [ ] CI/CD pipeline for staging
- [ ] Monitoring setup (Prometheus, Grafana)
- [ ] Demo runbook
- [ ] API documentation
- [ ] Developer onboarding guide

### Deliverables
- Staging environment
- Complete documentation
- Runbook for demo day

## Week 7: Pilot Launch & Support
**Goal**: Successful pilot launch and support

### Critical Tasks
- [ ] Production deployment
- [ ] Demo day preparation
- [ ] Support team training
- [ ] Monitoring dashboard
- [ ] Feedback collection

### Deliverables
- Live pilot environment
- Successful demo
- Feedback mechanism

## Critical Path Dependencies

```
Week 1 Backend → Week 2 Frontend → Week 3 Integration
                     ↓
Week 4 Security ← Week 3 Integration
                     ↓
Week 5 Testing ← Week 4 Security
                     ↓
Week 6 Ops ← Week 5 Testing
                     ↓
Week 7 Launch ← Week 6 Ops
```

## Risk Mitigation

### High-Risk Items
1. **External API Dependencies** (NPPES, ACA-Py)
   - Mitigation: Stubs and mocks ready
   - Fallback: Manual processing path

2. **Database Performance**
   - Mitigation: Redis caching, query optimization
   - Fallback: In-memory stores for pilot

3. **Frontend-Backend Integration**
   - Mitigation: API contract documentation, MSW mocks
   - Fallback: Direct API testing

## Success Metrics

- **Week 1**: All API endpoints responding
- **Week 2**: UI can submit claims end-to-end
- **Week 3**: Claims progress through all stages
- **Week 4**: Security audit passes
- **Week 5**: All critical paths have test coverage
- **Week 6**: Staging environment stable
- **Week 7**: Demo completes without critical errors

## Milestone Gates

- **Gate 1** (End Week 2): Backend + Frontend basic flow
- **Gate 2** (End Week 4): Security compliance met
- **Gate 3** (End Week 6): Ready for pilot launch
