# Multi-Agent System - Complete Implementation

## ✅ Implementation Status

**Backend**: ✅ Complete
**Frontend**: ✅ Complete
**Integration**: ⬜ Pending (wire events in existing routes)

---

## 📋 What's Been Delivered

### Backend Infrastructure (10 files)

1. **Prisma Schema** (`prisma/schema.prisma`)

   - `NpiClaim.tags` (JSON field for auto-tagging)
   - `AgentRun` model for audit trail

2. **Event Bus** (`src/agents/bus.ts`)

   - EventEmitter-based domain events
   - 6 event types supported

3. **Agent System** (5 agents + orchestrator)

   - `AutoTagger.ts` - Automatic entity tagging
   - `ClinicianAgent.ts` - Clinician guidance
   - `VerifierAgent.ts` - Verifier signals
   - `IssuerAgent.ts` - Issuer sanity checks
   - `orchestrator.ts` - Event dispatcher

4. **Utilities** (`src/agents/utils.ts`)

   - Tag merge logic
   - Shared Prisma client

5. **API Routes** (`src/routes/agents.ts`)

   - `POST /api/agents/trigger` - Manual trigger
   - `GET /api/agents/runs` - List runs

6. **Example Routes** (integration reference)

   - `claim.example.ts` - How to wire events
   - `issuer.example.ts` - Issuer event patterns
   - `npi.example.ts` - Lookup event pattern

7. **Server Setup** (`src/server.ts`)
   - Mounts orchestrator
   - Exposes agent endpoints

### Frontend Components (2 files)

1. **API Client** (`lib/apiClient.ts`)

   - `listAgentRuns()` - Fetch runs
   - `triggerAgent()` - Manual trigger

2. **Ops Page** (`app/ops/agents/page.tsx`)
   - Monitor agent runs
   - Filter by NPI
   - Manual trigger UI

---

## 🚀 How It Works

### Event Flow

```
1. User Action
   ↓
2. Route Handler (e.g., POST /api/claim/basic)
   ↓
3. Business Logic (update DB, create audit)
   ↓
4. emitEvent({ type: 'CLAIM_START', npi })
   ↓
5. Orchestrator receives event
   ↓
6. All 4 agents run in parallel
   ↓
7. Tags merged into NpiClaim.tags
   ↓
8. AgentRun rows created (audit)
```

### Agent Execution

**Parallel**: All agents run concurrently (non-blocking)

**Error Handling**: Failed agents logged, don't crash server

**Idempotent**: Safe to run multiple times for same NPI

---

## 🔧 Next Steps

### 1. Wire Events (Required)

Add `emitEvent()` calls to your existing routes:

**File**: `src/routes/claim.ts` (or your actual file)

```typescript
import { emitEvent } from '../agents/bus.js';

// After successful claim start:
emitEvent({ type: 'CLAIM_START', npi });

// After PIN verification:
emitEvent({ type: 'CLAIM_VERIFY_PIN', npi });

// After document upload:
emitEvent({ type: 'CLAIM_DOC_UPLOAD', npi });
```

**File**: `src/routes/issuer.ts`

```typescript
import { emitEvent } from '../agents/bus.js';

// After attestation request:
emitEvent({ type: 'ATTEST_REQUESTED', npi });

// After approval:
emitEvent({ type: 'ATTEST_APPROVE', npi });
```

**File**: `src/routes/npi.ts`

```typescript
import { emitEvent } from '../agents/bus.js';

// After successful lookup:
emitEvent({ type: 'NPLOOKUP_VIEW', npi: String(npi) });
```

### 2. Mount Orchestrator (Required)

In your server entry (`src/index.ts` or `src/server.ts`):

```typescript
import { mountOrchestrator } from './agents/orchestrator.js';

// Call before routes start handling requests
mountOrchestrator();
```

### 3. Run Migration (Required)

```bash
cd vitalcv-backend
npm run prisma:generate
npm run prisma:migrate dev --name add_agents
```

### 4. Test (Recommended)

```bash
# Trigger agents manually
curl -X POST http://localhost:4000/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"npi":"1538102066","type":"NPLOOKUP_VIEW"}'

# Check results
curl http://localhost:4000/api/agents/runs
```

---

## 📊 Tag Structure

Tags are stored in `NpiClaim.tags` as JSON:

```json
{
  "userGroup": ["clinician"],
  "level": ["L1"],
  "signals": ["highIdentityConfidence"],
  "specialty": ["207R00000X"],
  "nextAction": ["uploadDocs"]
}
```

**Use Cases**:

- **Routing**: Show different UI based on `userGroup`
- **Analytics**: Track `level` distribution
- **UX**: Display `signals` as badges
- **Guidance**: Show prompts based on `nextAction`

---

## 🎯 Agent Responsibilities

### AutoTagger

- Generates: `userGroup`, `level`, `signals`, `specialty`
- Runs on: All events
- Purpose: Automatic classification

### ClinicianAgent

- Generates: `nextAction`
- Runs on: Claim events
- Purpose: Guide users through flow

### VerifierAgent

- Outputs: Notes about pending requests
- Runs on: Attestation events
- Purpose: Surface work for verifiers

### IssuerAgent

- Outputs: Validation notes
- Runs on: Attestation request events
- Purpose: Pre-validate requests

---

## 📈 Monitoring

### Backend

**Database**:

```sql
-- Recent runs
SELECT * FROM "AgentRun" ORDER BY id DESC LIMIT 20;

-- Error rate
SELECT agentName, COUNT(*) FILTER (WHERE status='error') as errors
FROM "AgentRun" GROUP BY agentName;

-- Execution time
SELECT agentName, AVG(EXTRACT(EPOCH FROM (finishedAt - startedAt))) as avg_seconds
FROM "AgentRun" WHERE finishedAt IS NOT NULL
GROUP BY agentName;
```

### Frontend

**Ops Page**: `/ops/agents`

- View recent runs
- Filter by NPI
- Manual trigger
- Real-time refresh

---

## 🔮 Future Enhancements

### Phase 1: Production Hardening

- [ ] BullMQ migration (Redis-backed queue)
- [ ] Retry logic for failed agents
- [ ] Rate limiting
- [ ] Agent metrics dashboard

### Phase 2: Enhanced Tagging

- [ ] PubMed integration → `signals:["hasPublications"]`
- [ ] Doximity integration → `signals:["hasDoxProfile"]`
- [ ] LinkedIn integration → `signals:["hasLinkedIn"]`

### Phase 3: Per-User-Group UIs

- [ ] Clinician dashboard (reacts to `tags.nextAction`)
- [ ] Verifier queue (reacts to `VerifierAgent` notes)
- [ ] Issuer portal (reacts to `IssuerAgent` validation)

### Phase 4: Advanced Features

- [ ] Kafka event streaming
- [ ] ML-based classification
- [ ] Predictive analytics
- [ ] A/B testing framework

---

## 🐛 Known Limitations

1. **In-Process**: All agents run in same Node process
2. **No Retry**: Failed agents don't auto-retry
3. **No Priority**: All agents run with same priority
4. **No Rate Limiting**: Can trigger unlimited runs
5. **Event Loss**: Events lost if server crashes (before BullMQ migration)

---

## 📝 Code Structure

```
vitalcv-backend/
├── prisma/
│   └── schema.prisma          # Tags + AgentRun
├── src/
│   ├── agents/
│   │   ├── bus.ts            # EventEmitter bus
│   │   ├── types.ts          # Agent interface
│   │   ├── utils.ts          # Tag utilities
│   │   ├── autoTagger.ts     # Auto-tag agent
│   │   ├── clinicianAgent.ts # Clinician guidance
│   │   ├── verifierAgent.ts  # Verifier signals
│   │   ├── issuerAgent.ts    # Issuer validation
│   │   └── orchestrator.ts   # Event dispatcher
│   ├── routes/
│   │   ├── agents.ts         # Agent endpoints
│   │   ├── claim.example.ts  # Integration example
│   │   ├── issuer.example.ts # Integration example
│   │   └── npi.example.ts   # Integration example
│   ├── db.ts                 # Prisma client
│   └── server.ts             # Server entry

v0-vital-cv-frontend-mvp/
├── lib/
│   └── apiClient.ts          # Agent API functions
└── app/
    └── ops/
        └── agents/
            └── page.tsx      # Monitoring page
```

---

## ✅ Acceptance Criteria

- [x] Prisma schema includes tags + AgentRun
- [x] Event bus implemented (EventEmitter)
- [x] 4 agents implemented (AutoTagger, Clinician, Verifier, Issuer)
- [x] Orchestrator dispatches on events
- [x] API endpoints for monitoring
- [x] Frontend ops page
- [x] Example integration code
- [ ] Events wired in actual routes (TODO)
- [ ] Orchestrator mounted in server (TODO)
- [ ] Schema migrated (TODO)

---

## 🎉 Success!

You now have a complete, event-driven multi-agent system ready for integration. The "nervous system" is built—just wire it into your existing routes and watch the agents work their magic.

**Next Action**: Wire events in your actual route handlers (see `INTEGRATION_GUIDE.md`)

---

**Version**: 1.0
**Status**: ✅ Ready for Integration
**Last Updated**: October 29, 2025
