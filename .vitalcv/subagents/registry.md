# Subagent Registry — VitalCV
_Active tracking of all subagent missions._

## 2026-03-12 Session

### wave237-backend (completed)
- **Role:** Backend API builder
- **Wave:** 237
- **Mission:** Document Intelligence API routes (parse/verify/retrieve)
- **Output:** `routes/documents.ts`, multer install, app.ts wiring, liveMatchaService fix
- **Accepted:** ✅ All recommendations accepted, committed `29b4fd7d`
- **Roadmap impact:** None — execution only

### wave237-frontend (completed)
- **Role:** Frontend UI builder  
- **Wave:** 237
- **Mission:** DocumentParser + ParseAnimation + page route + proxy routes + navbar link
- **Output:** 7 files created, 2 modified
- **Accepted:** ✅ All accepted, committed with backend in `29b4fd7d`
- **Roadmap impact:** None — execution only

### wave237-harden (running)
- **Role:** Trust-state hardening
- **Wave:** 237h
- **Mission:** Replace in-memory store with durable persistence, add audit records, file validation, tests
- **Status:** 🔄 Running
- **Expected output:** documentStore.ts, documentAudit.ts, updated routes, tests

### wave238-onboarding (running)
- **Role:** Holder credential onboarding
- **Wave:** 238
- **Mission:** Wire document parser into holder onboarding, create CandidateCredential records, review/confirm UX, PSV trigger
- **Status:** 🔄 Running
- **Expected output:** credentialIngestion.ts, credential routes, CredentialReview.tsx, proxy routes, holder page updates

### repo-cartographer-docs (expired)
- **Role:** Repo Cartographer
- **Wave:** 237 (pre-build)
- **Mission:** Map document processing infrastructure
- **Status:** Completed but results expired from context
- **Note:** Findings were reconstructed manually from direct file reads
