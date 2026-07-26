# Replay Persistence Execution Plan
Generated: 2026-05-13T04:59:00Z
Branch: wave-10a/docs-status

---

## Current State

### What exists (Prisma schema confirmed)
- `JtiReplay` — replay attack prevention (`service, jti` composite PK + `expiresAt`)
- `VerificationReceiptRecord` — receipts stored by `receiptId`
- `IngestRun` — NPI ingest tracking with `npi, status, entityId`
- `SourceRun` — source-level runs with `idempotencyKey @unique`
- `PsvReceipt` — PSV-specific receipts
- `LearningEvent` — event log with `dedupeKey @unique`, `actor_id` in metadata

### What's missing
1. **`ReplayRunRecord` table** — no persistence for `{runId, laneId, npi, checkedAt, priorRunId, actorId, signerKid}`
2. **`LineageContinuityRecord` table** — no `lineageKey → ordered [runIds]` chain
3. **Deterministic `jti`** — `signIssuerReceipt` uses `rcpt_{responseId}_{Date.now()}` (non-deterministic)
4. **`getReplayInspection` reads from DB** — currently synthesizes from NPI, not from persisted runs

### Current workaround
`getReplayInspection(runId)` constructs synthetic replay data. This means:
- Two calls with the same runId may produce different results
- Replay chain is not independently verifiable from DB
- `priorRunId` is inferred, not authoritative

---

## Execution Plan — 5 PRs

### PR 1: Deterministic JTI
**Target:** `apps/web/lib/crypto/receiptIssuer.ts`

Replace:
```typescript
const jti = `rcpt_${response.responseId}_${Date.now()}`;
```
With:
```typescript
// Deterministic jti: sha256(providerId + laneId + checkedAt)
import { createHash } from 'crypto';
const jti = `rcpt_${createHash('sha256')
  .update(`${context.providerId}:${context.laneId ?? 'unknown'}:${response.respondedAt}`)
  .digest('hex')
  .slice(0, 16)}`;
```

**Invariant:** Same provider + lane + respondedAt always produces the same jti.
**Idempotency:** `JtiReplay` table prevents double-issuance.

**Acceptance:** `signIssuerReceipt` called twice with identical inputs → same jti, second call rejected by JtiReplay.

---

### PR 2: ReplayRunRecord Prisma model
**Target:** `apps/api/backend/prisma/schema.prisma`

```prisma
model ReplayRunRecord {
  id          String   @id @default(uuid()) @db.Uuid
  runId       String   @unique @map("run_id")          // 8-char hex
  lineageKey  String   @map("lineage_key")             // {laneId}:{npi}
  laneId      String   @map("lane_id")
  npi         String
  checkedAt   DateTime @map("checked_at")
  priorRunId  String?  @map("prior_run_id")           // chain link
  actorId     String?  @map("actor_id")               // Clerk userId
  signerKid   String?  @map("signer_kid")             // signing key ID
  receiptId   String?  @map("receipt_id")             // links to VerificationReceiptRecord
  tier        String   @default("T1")                 // T1/T2/T3/T4
  status      String   @default("verified")
  survivable  Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([lineageKey])
  @@index([npi])
  @@index([priorRunId])
  @@map("replay_run_records")
}
```

Migration: `npx prisma migrate dev --name add_replay_run_record`

---

### PR 3: LineageContinuityRecord Prisma model
**Target:** `apps/api/backend/prisma/schema.prisma`

```prisma
model LineageContinuityRecord {
  id           String   @id @default(uuid()) @db.Uuid
  lineageKey   String   @unique @map("lineage_key")   // {laneId}:{npi}
  laneId       String   @map("lane_id")
  npi          String
  latestRunId  String?  @map("latest_run_id")
  runCount     Int      @default(0) @map("run_count")
  gapCount     Int      @default(0) @map("gap_count")
  survivabilityScore Int @default(100) @map("survivability_score")
  lastCheckedAt DateTime? @map("last_checked_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([npi])
  @@map("lineage_continuity_records")
}
```

---

### PR 4: ReplayRunRecord write path
**Target:** `apps/api/backend/src/services/` (new file: `replayPersistence.ts`)

```typescript
export async function persistReplayRun(input: {
  runId: string;
  lineageKey: string;
  laneId: string;
  npi: string;
  checkedAt: Date;
  priorRunId: string | null;
  actorId: string | null;
  signerKid: string | null;
  receiptId: string | null;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  status: string;
}): Promise<void>
```

Implementation: `prisma.replayRunRecord.upsert({ where: { runId }, update: {}, create: {...} })` — first write wins, idempotent.

Wire into: `SourceRun` completion handler — after a successful source check, persist the replay run.

---

### PR 5: getReplayInspection reads from DB
**Target:** `apps/web/lib/replay/getReplayInspection.ts`

Update to hit `GET /api/replay/inspect/[npi]` (new backend route) which reads from `ReplayRunRecord` by NPI, builds the chain by following `priorRunId` links, and returns a real `ReplayInspection`.

Fallback: if no records exist (fresh NPI), return the current synthetic inspection with `_synthetic: true` flag.

---

## Acceptance Criteria

| Check | Test |
|-------|------|
| Deterministic jti | signIssuerReceipt(same inputs) × 2 → same jti |
| Replay durability | restart server → runId still queryable |
| Chain derivability | GET /api/replay/[runId] returns same data pre/post restart |
| Continuity derivability | GET /api/receipt/[lineageKey] uses persisted data |
| Institutional defensibility | auditor can reconstruct full chain from DB alone |

