# Replay Topology Gap Analysis

**Branch under audit:** `wave/canonical-route-map`
**Repo:** `/tmp/vitalcv-canonical-routes`
**Diff vs `origin/main`:** 1 file changed (`docs/architecture/canonical-trust-route-map.md`, +114 lines)
**Audit date:** 2026-05-12

## 0. Executive summary

The canonical route map document landed on this branch (commit `164e7039`) advertises
nine canonical public paths for the institutional verifier surface, including
`/api/receipt/[npi]` (#349) and `/api/receipt/by-lineage/[lineageKey]` (#355).
However, the **implementation stack referenced by that document is not on this
branch**. PRs #345, #349, and #355 have not been merged into the tree at
`wave/canonical-route-map`. As a result, this branch is a forward-looking spec
document; the verifier-continuity primitives it describes (lineageKey, runId,
client/server parity mirror, receipt endpoints, receipt-by-lineage cross-check)
**do not yet exist in code anywhere in the repo**.

Search confirmation (zero hits): `grep -rn "lineageKey\|lin_v1_"` over `apps/`
returns nothing; the directories `apps/api/backend/src/services/replay/`,
`apps/web/lib/replay/`, and `apps/web/app/api/receipt/` do not exist; the
pinning tests `well-known-surfaces.test.ts` and
`verifier-continuity-completion.test.ts` named in the route-map doc are also
absent. There is no enforcement mechanism on this branch holding the spec to
its referenced implementation.

What this audit measures is the gap between the canonical-route-map
**specification** and the **current substrate** the implementation would have
to stand on (Prisma schema, audit/replay engine, receipt signing primitives,
artifact persistence). The substrate is partially adequate, partially missing.

### Axis verdict matrix

| # | Axis | Verdict | One-line summary |
|---|------|---------|------------------|
| 1 | Replay writer (lineageKey / runId generator) | **MISSING** | No backend `replayIdentity.ts`, no browser `clientReplayIdentity.ts`; identifier scheme is unimplemented. |
| 2 | Replay reader (lineageKey → run / chronology / ownership) | **MISSING** | No `/api/replay/[runId]`, no `/api/lineage/[lineageKey]/runs`, no `/api/receipt/by-lineage/[lineageKey]`; the only reader-shaped surfaces (`/api/decisions/:id/...`) key on capsule UUID, not lineageKey. |
| 3 | Lineage persistence layer (Prisma) | **MISSING** | No `ReplayRun`, `Lineage`, or `LineageRun` model; `VerificationArtifact` is the closest analog but has no `lineageKey` column. |
| 4 | Receipt persistence layer | **PARTIAL** | `VerificationReceiptRecord`, `PsvReceipt`, `AuditReceiptRecord`, and `ReceiptCandidate.signedReceiptJwt` exist and store receipts; but none is keyed by `lineageKey` or `runId` and there is no on-demand receipt-by-lineage retrieval path. |
| 5 | Chronology persistence layer | **PARTIAL** | `DecisionCapsule.decisionTimestamp` plus `/api/decisions/npi/:npi/timeline` provides a per-NPI ordered list of decisions, but it is keyed on capsule UUID, not on lineageKey, and is not the chronology of lineage-replay runs the canonical spec implies. |
| 6 | Continuity derivation layer (lineageKey delta reconciler) | **MISSING** | No continuity reconciler; the closest extant primitive is `replayEngine.integrity.hashMatch` which compares a single capsule's stored `artifactHash` to a recomputed digest — it does not compute deltas across consecutive lineageKeys nor identify which artifacts churned. |

The rest of this document expands each axis with citations and a build-effort
estimate, then closes with the dependency-ordered PR plan (§7).

---

## 1. Replay writer — MISSING

### Status: MISSING

### Evidence

The canonical-route-map document (commit `164e7039`,
`docs/architecture/canonical-trust-route-map.md:24-25`) lists:

> `/api/receipt/[npi]` → `apps/web/app/api/receipt/[npi]/route.ts` — Owning PR #349
> `/api/receipt/by-lineage/[lineageKey]` → `apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts` — Owning PR #355

Neither handler file exists on this branch. The expected generator modules
also do not exist:

- `apps/api/backend/src/services/replay/replayIdentity.ts` — **does not exist**
  (directory `apps/api/backend/src/services/replay/` is absent; only sibling
  service directories are present, e.g. `apps/api/backend/src/services/audit/`,
  `apps/api/backend/src/services/ingest/`, `apps/api/backend/src/services/investigators/`)
- `apps/web/lib/replay/clientReplayIdentity.ts` — **does not exist**
  (no `apps/web/lib/replay/` directory at all)

Repo-wide search for the literal scheme strings returns zero matches:

```
$ grep -rn "lineageKey\|lin_v1_\|run_v1_" apps --include="*.ts" --include="*.tsx"
(no matches)
```

Existing `runId` references in the tree refer to **unrelated** runs:

- `apps/api/backend/src/services/ingest/ingestOrchestrator.ts:172` — `runId` is a
  UUID for an `IngestRun` row (`prisma.ingestRun` — model at
  `apps/api/backend/prisma/schema.prisma:716`).
- `apps/api/backend/src/services/strategyAgents/strategyAgentService.ts:1627` —
  `runId = buildStableId('run', { ... })`, a strategy-agent run.
- `apps/api/backend/src/services/graph-engine/rebuildEngine.ts:1782` —
  `createGraphBuildRunId({ ... })`, a graph-build run.
- `apps/web/hooks/useIngestStream.ts:56,86,116` — `runId` is the ingest run id
  surfaced to the streaming UI.

None of these is the canonical `runId = run_v1_<16hex>` content-addressed
identifier; none participates in a `lineageKey` parity contract.

### Gap

The entire writer half of the replay-identity primitive is unimplemented:

- No canonical hash function over the artifact set
- No 16-hex truncation / prefix convention enforced
- No browser mirror using `crypto.subtle.digest` to produce byte-identical output
- No call-site that emits `(lineageKey, runId)` together with any persistence

### Build effort estimate

**Multi-PR.** Minimum decomposition:

- 1 small PR to introduce `apps/api/backend/src/services/replay/replayIdentity.ts`
  (pure function: canonical-JSON serialize artifact set → SHA-256 → hex →
  truncate; deterministic, no IO). Snapshot tests pin output.
- 1 small PR to introduce `apps/web/lib/replay/clientReplayIdentity.ts` mirror
  using `crypto.subtle.digest('SHA-256', ...)`. Parity test in vitest harness.
- 1 medium PR to thread the generator into at least one writer caller
  (ingestOrchestrator or capsule-create) so the identifier is computed at the
  same boundary where artifacts are pinned.

Neither schema migration nor new endpoints required for the writer half on its
own — the writer is pure derivation.

---

## 2. Replay reader — MISSING

### Status: MISSING

### Evidence

#### What exists today (reader-shaped surfaces)

The decision-accountability layer in
`apps/api/backend/src/routes/auditReplay.ts` exposes four readers, all keyed on
**capsule UUID**, not on lineageKey:

```
apps/api/backend/src/routes/auditReplay.ts:42  GET /api/decisions/:id/evidence
apps/api/backend/src/routes/auditReplay.ts:77  GET /api/decisions/:id/chain
apps/api/backend/src/routes/auditReplay.ts:122 GET /api/decisions/:id/bundle
apps/api/backend/src/routes/auditReplay.ts:199 GET /api/decisions/npi/:npi/timeline
apps/api/backend/src/routes/auditReplay.ts:282 POST /api/decisions/:id/attest
```

The capsule-replay endpoint mentioned in the file header,
`GET /api/decisions/:capsuleId/replay`, lives in
`apps/api/backend/src/routes/decisionCapsules.ts` and likewise keys on
capsuleId UUID, not lineageKey.

The Next.js audit proxy at `apps/web/app/api/audit/events/route.ts` forwards a
flat audit-event list (`limit`, `category`, `since` query params) to the
backend. It returns rows from the `AuditEvent` Prisma model
(`apps/api/backend/prisma/schema.prisma:1477`), which has columns
`type / hash / referenceId / clinicianId / metadata` — no `lineageKey` column,
no `runId` column.

#### What is canonical but absent

The route-map document lists `/api/receipt/by-lineage/[lineageKey]` as the
canonical reader. The handler file is absent. Its expected behavior per the
prompt context — "501s when no npi supplied because there's no backend index" —
cannot be reproduced on this branch because the handler doesn't exist to return
the 501 in the first place.

Also absent from the canonical surface set the prompt enumerates:

- `/api/replay/[runId]` — no Next route, no Express route
- `/api/lineage/[lineageKey]/runs` — no Next route, no Express route
- `/api/lineage/[lineageKey]/chronology` — no Next route, no Express route

No `apps/web/app/api/replay/` or `apps/web/app/api/lineage/` directory exists.

### Gap

The reader half of the lineage→record / lineage→chronology / lineage→ownership
contract is fully absent. The capsule-id-keyed timeline at
`/api/decisions/npi/:npi/timeline` is the only chronological reader the system
exposes, and it answers a different question (what decisions did we make about
this NPI?), not the canonical question (what runs are continuous under this
lineageKey?).

Even if the writer (axis 1) were built and lineageKey began appearing in logs
and audit-event metadata, there would be no index allowing a verifier to start
from a lineageKey URL and resolve the run, the artifacts, or the receipts —
exactly the smoking-gun described in the prompt context.

### Build effort estimate

**Multi-PR, requires backend schema migration.** The reader endpoints are
trivial Next.js / Express route files in isolation, but they are useless
without the persistence layer underneath. Sequence:

1. Land axis 3 first (schema migration + writer persistence)
2. Then introduce `/api/replay/[runId]/route.ts` (single-row read)
3. Then introduce `/api/lineage/[lineageKey]/runs/route.ts` (index read)
4. Then introduce `/api/receipt/by-lineage/[lineageKey]/route.ts` (read + sign-or-return-stored)

Each of (2)–(4) is roughly 1 small PR once (1) lands.

---

## 3. Lineage persistence layer (Prisma) — MISSING

### Status: MISSING

### Evidence

`apps/api/backend/prisma/schema.prisma` is 3,734 lines and contains the
following replay-/lineage-/receipt-relevant models:

| Model | Line | Has `lineageKey` column? | Has `runId` column? |
|---|---|---|---|
| `VerificationArtifact` | 607 | no | no (has `sourceRunId` linking to `SourceRun`) |
| `SourceRun` | 684 | no | no (uses `id` UUID) |
| `IngestRun` | 716 | no | no |
| `IngestEvent` | 754 | no | no |
| `VerificationReceiptRecord` | 962 | no | no |
| `VerificationRun` (model referenced from `Provider`) | n/a | no | n/a |
| `AuditEvent` | 1477 | no | no |
| `AuditReceiptRecord` | 1830 | no | no |
| `DecisionCapsule` | 2075 | no | no |
| `ReceiptCandidate` | 3702 | no | no |

The closest extant analog — `VerificationArtifact` — has the right shape
(`npi`, `source`, `checksum`, `verifiedAt`, `rawPayload`, supersession edges)
but is not a per-run identity row. Each row is per (artifact, source, capture)
not per (lineageKey, run). Key columns:

```
model VerificationArtifact {
  id                          String                       @id @default(uuid()) @db.Uuid
  npi                         String
  source                      String
  status                      String
  rawPayload                  Json?
  checksum                    String                       // <- per-artifact hash, NOT lineage-set hash
  verifiedAt                  DateTime
  // ... 30+ further columns including supersededByArtifactId,
  //     supersedesArtifactId, sourceRunId, sourceRecordId
  @@index([npi])
  @@index([source])
  // ... no @@index on lineageKey because the column does not exist
}
```

(`apps/api/backend/prisma/schema.prisma:607-682`)

There is one promising adjacent migration directory —
`apps/api/backend/prisma/migrations/20260323010000_m3_receipt_traceability_hardening/`
— but inspection shows it only adds `claimType`, `matchConfidence`,
`freshnessWindowHours`, `integrityHash`, `sourceUrl`, `retrievedAt`,
`rawArtifactRef` columns to `verification_receipt_records`. No `lineage_key`
column is introduced anywhere in any migration on this branch.

### Gap

No table exists where a row represents `(lineageKey, entityId, runId,
checkedAt, artifactChecksums)`. Consequently:

- The lineageKey can be derived on demand (axis 1), but never persisted.
- The reverse map `lineageKey → npi` (the index whose absence makes the
  canonical receipt-by-lineage reader 501) cannot be built without a new table.
- "List runs for lineageKey X in chronological order" is unanswerable.
- "What ownership snapshot was in force at run R?" is partially answerable
  via `VerificationArtifact` joins, but only if the run is identified by some
  other key (capsuleId, sourceRunId), not by lineageKey.

### Build effort estimate

**Requires backend schema migration. 1 PR.** The migration is small:

```prisma
model ReplayRun {
  id                String                @id @default(uuid()) @db.Uuid
  lineageKey        String                // lin_v1_<16hex>; SHA-256 over canonical artifact set
  runId             String                @unique // run_v1_<16hex>; per-execution
  entityId          String                // NPI or canonical entity reference
  checkedAt         DateTime              // pinned at run time
  artifactChecksums Json                  // {source: checksum} map for delta reconciliation
  createdAt         DateTime              @default(now())

  @@index([lineageKey])
  @@index([entityId, checkedAt])
  @@index([lineageKey, checkedAt])
}
```

The migration unblocks every other axis. Without it, axes 2 / 4-by-lineage / 5
/ 6 are all stuck.

---

## 4. Receipt persistence layer — PARTIAL

### Status: PARTIAL

### Evidence

#### What exists today

Four Prisma models persist receipt-shaped material:

- **`PsvReceipt`** (`schema.prisma:84-106`): per-clinician PSV row with
  `receiptId`, `responseHash`, `revoked`, `lane`. No JWT body field; structured
  columns only.
- **`VerificationReceiptRecord`** (`schema.prisma:962-1003`): per-claim row
  with `receiptId @unique`, `integrityHash`, `checksum`, `rawArtifactRef`,
  `freshnessWindowHours`. No `signedJwt`, no `jti`, no `lineageKey`.
- **`AuditReceiptRecord`** (`schema.prisma:1830-1847`): generic audit receipt
  storing `receiptId`, `hash`, `payload` (JSON), `actor`, `subject`,
  `issuedAt`. Receipt payload preserved here but keyed on free-form
  `receiptId`, not on lineage or run; no `jti` column.
- **`ReceiptCandidate`** (`schema.prisma:3702-3734`) — the only model that
  persists a signed receipt JWT:

```prisma
model ReceiptCandidate {
  id                String   @id @default(uuid()) @db.Uuid
  candidateId       String   @unique
  // ...
  decisionGrade     Boolean  @default(false)   // literal false; enforced by CHECK constraint
  proofTier         String?                    // literal 'receipt_candidate'; enforced by CHECK
  signedReceiptJwt  String?
  recordedBy        String   @default("demo")
  createdAt         DateTime @default(now())
}
```

This is the closest model to "signed receipt stored at rest." But it lives
under the issuer-verification flow (the `ReceiptCandidate.decisionGrade` /
`proofTier` literal contract from CLAUDE.md), and is structurally the unsigned
or partially-signed candidate stage — not a canonical receipt-by-lineage store.

#### On-demand signing primitive

`apps/web/lib/crypto/receiptIssuer.ts:94-133` defines:

```ts
export async function signIssuerReceipt(
  response: IssuerResponse,
  context: { providerId: string; claimId: string; source: string; rawHash: string; },
): Promise<SignedIssuerReceipt> {
  const { privateKey, kid } = await getOrInitKeypair();
  // ...
  const jti = `rcpt_${response.responseId}_${Date.now()}`;
  const payload = { iss: issuerUrl, sub: context.providerId, jti, vcv: { ... } };
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(privateKey);
  return { jwt, kid, jti };
}
```

The `jti` here is **not** the deterministic `'receipt:' + replay.runId` form
the prompt describes — it is `rcpt_<responseId>_<Date.now()>`, which is
non-deterministic (timestamp-dependent) and not cross-referenceable to a
replay run. Two requests for the same effective receipt would produce
different `jti` values.

Verifier-side:

```
apps/web/lib/trust/jwtVerifier.ts:11  verifyReceiptJWT(token): ES256 verify via local JWKS
apps/web/app/api/receipts/verify/route.ts: POST that wraps verifyReceiptJWT
```

The verifier accepts any ES256 JWT signed by the in-process kid; it does not
look up a stored receipt by `jti` and does not check for revocation. There is
no `/api/receipts/lookup/[jti]` reader.

### Gap

What is present: receipts are stored in three different shapes
(`PsvReceipt`, `VerificationReceiptRecord`, `AuditReceiptRecord`,
`ReceiptCandidate`), only one of which (`ReceiptCandidate.signedReceiptJwt`)
contains a signed JWT body, and that one is constrained to the receipt-candidate
flow.

What is missing for the canonical receipt-by-lineage contract:

- **No deterministic-jti pinning.** `signIssuerReceipt` injects `Date.now()`,
  so the same logical receipt issued twice for the same `(lineageKey, npi,
  artifact-set, checkedAt)` would have two different `jti`s. The canonical
  scheme requires `jti = 'receipt:' + runId` so duplicates collapse.
- **No iat pinning to `lastCheckedAt`.** `signIssuerReceipt` uses
  `setIssuedAt()` (now), not the canonical "iat = lastCheckedAt seconds"
  rule. This means re-signing for the same run mutates `iat`.
- **No `lineageKey → receipt` index.** None of the four receipt tables has a
  `lineageKey` column.
- **No revocation-by-lineage path.** `PsvReceipt.revoked` exists but is keyed
  on `clinicianId / receiptId`, not on lineage.
- **No "what receipt did we issue at T?" query.** The closest answer requires
  joining `AuditReceiptRecord.issuedAt` with a free-form `subject` filter and
  picking a row; there is no canonical bind to the run that produced it.

### Build effort estimate

**Multi-PR, includes a migration.**

- 1 PR to add `lineageKey` and `runId` columns to `AuditReceiptRecord` (or
  add a new `LineageReceipt` join table). Backfill is non-trivial because
  existing rows have no lineageKey.
- 1 PR to rewrite `signIssuerReceipt` so `jti` and `iat` are deterministic
  from `(runId, lastCheckedAt)`. Snapshot tests must pin a deterministic JWT
  output for a fixed input — this is a behavior change with a blast radius
  through every existing receipt-signing caller.
- 1 PR to introduce a writer path that stores the signed JWT (not just the
  structured fields) when a receipt is minted, alongside its lineage key.

---

## 5. Chronology persistence layer — PARTIAL

### Status: PARTIAL

### Evidence

#### What exists

`apps/api/backend/src/routes/auditReplay.ts:199-265` exposes
`GET /api/decisions/npi/:npi/timeline`. It reads
`prisma.decisionCapsule.findMany` filtered on `subjectNpi`, ordered by
`decisionTimestamp desc`:

```ts
const capsules = await prisma.decisionCapsule.findMany({
  where: { subjectNpi: npi, /* ... */ },
  select: {
    id: true, decisionType: true, decisionTimestamp: true,
    status: true, artifactHash: true, methodology: true, metadata: true,
  },
  orderBy: { decisionTimestamp: 'desc' },
  take: limit,
});
```

This delivers a real chronological reader, but for **decision capsules**
(immutable cryptographic audit capsules over a credentialing decision), not
for replay runs.

`DecisionCapsule` (`apps/api/backend/prisma/schema.prisma:2075-2110`):

```prisma
model DecisionCapsule {
  id                String   @id @default(uuid()) @db.Uuid
  subjectDid        String
  subjectNpi        String
  decisionType      String   // HIRING | PRIVILEGING | DEPLOYMENT | RENEWAL
  decisionTimestamp DateTime
  credentialIds     String[]
  issuerIds         String[]
  artifactHash      String   // SHA-256 of bundle snapshot
  methodology       String   @default("CRS_v1.0")
  status            String   @default("VALID")
  // ...
}
```

This is "ordered decisions for NPI X" — distinct from "ordered replay runs for
lineageKey Y."

Searches for `recentNpis` and `chronology` return:

- `apps/web/components/sandbox/SandboxApp.tsx:51,99` — `vitalcv_recent_npis`
  localStorage key. Client-only memory of recently-viewed NPIs in the
  sandbox. No backend equivalent.
- `apps/api/backend/src/services/investigators/trustDeclineInvestigator.ts:140`
  and `divergenceInvestigator.ts:106` — both define a local variable
  `recentNpis = await prisma.verificationArtifact.groupBy({ ... })`. This is
  "NPIs with a recent VerificationArtifact" computed on every investigator
  run; it is an aggregation, not a persisted chronology view.

The `RecentNpis.tsx` UI primitive the prompt references is **not present on
this branch** (`apps/web/components/trust/` contains
`TrustStateCard.tsx`, `TrustGraphXRay.tsx`, `TrustContainerPanel.tsx`,
`KnowledgeTrustGraphPanel.tsx`, and similar — no `RecentNpis.tsx`,
`ReplayLineage.tsx`, `RunIdentity.tsx`, or `TrustHeader.tsx`).

#### Implicit / fragile chronology

`VerificationArtifact` has `createdAt`, `verifiedAt`, `fetchedAt`,
`observedAt`, `statusLastChecked` and the supersession edges
`supersededByArtifactId` / `supersedesArtifactId`. A consumer can — and the
`replayEngine.replayDecision` function does
(`apps/api/backend/src/services/audit/replayEngine.ts:259-271`) —
reconstruct an ordered sequence of artifacts at a point in time:

```ts
const contextArtifacts = await prisma.verificationArtifact.findMany({
  where: {
    npi: capsule.subjectNpi,
    source: { not: 'TRUST_STATE_ENGINE' },
    createdAt: { lte: decisionTime },
  },
  orderBy: { createdAt: 'desc' },
  take: 100,
});
```

This is an implicit chronology computed each query: it is correct in the
common case, but fragile under:

- Backdated `createdAt` (e.g. migration backfills)
- Multiple artifacts at identical `createdAt` (tiebreaker is row order)
- Supersession that does not align with `createdAt` ordering
- Cross-source ordering ambiguity

### Gap

What is present:

- Per-NPI decision-capsule chronology via `/api/decisions/npi/:npi/timeline`
- Per-NPI artifact reconstruction via `replayEngine.replayDecision`

What is missing:

- A persisted chronology of replay runs (because there is no
  `ReplayRun` table — see axis 3)
- A canonical "list runs for lineageKey X in order" query
- A persisted snapshot of which artifacts were *in force* at each run
  (currently this is computed from `VerificationArtifact.createdAt <= T`)
- Any UI primitive that consumes such a chronology

### Build effort estimate

**Requires axis 3 first. Then 1 PR for the reader endpoint, 1 PR for the UI
component.**

Once `ReplayRun(lineageKey, runId, entityId, checkedAt, artifactChecksums)`
exists, the chronology reader is:

```ts
const runs = await prisma.replayRun.findMany({
  where: { lineageKey, /* or entityId */ },
  orderBy: { checkedAt: 'asc' },
});
```

The fragile implicit chronology in `replayEngine` can stay as a fallback for
data that predates the `ReplayRun` rollout, but new runs should write to
`ReplayRun` synchronously.

---

## 6. Continuity derivation layer — MISSING

### Status: MISSING

### Evidence

#### What exists (the closest primitive)

`replayEngine.replayDecision` computes an integrity check per capsule:

```
apps/api/backend/src/services/audit/replayEngine.ts:332-348
const integrity: IntegrityCheck = {
  storedHash:         capsule.artifactHash,
  recomputedHash:     replayResult.actualArtifactHash,
  hashMatch:          replayResult.valid,
  // ...
  tamperEvidence:     replayResult.valid
    ? null
    : replayResult.actualArtifactHash !== capsule.artifactHash
      ? `Hash mismatch — stored: ${capsule.artifactHash.slice(0, 16)}… computed: ${replayResult.actualArtifactHash.slice(0, 16)}…`
      : replayResult.expectedEvidenceSpineDigest !== replayResult.actualEvidenceSpineDigest
        ? 'Evidence spine digest mismatch — referenced verification artifacts or receipts no longer replay to the stored trust-critical spine.'
        : 'Decision capsule replay validation failed.',
};
```

This answers the question: "for this *single* capsule, does the recomputed
artifact bundle hash still match the stored one?" Useful for tamper detection
in isolation.

The supersession edges on `VerificationArtifact`
(`supersedesArtifactId`, `supersededByArtifactId` — lines 646-656 of the
schema) provide a per-artifact lineage chain: artifact A1 was superseded by
artifact A2. A consumer can walk this graph to identify which artifacts
churned between two points in time.

#### What does not exist

There is no module, route, or service that answers the canonical continuity
question:

> "Given two receipts for entity E with lineageKeys L1 and L2 (where L1 was
> issued before L2), are they continuous? If not, which artifacts in the
> bundle changed between L1 and L2?"

Repo-wide search:

```
$ grep -rn "lineageContinuity\|continuityReconciler\|lineageDelta\|reconcileLineage" apps --include="*.ts"
(no matches)
```

No file owns this responsibility. The supersession walk could in principle
support it, but no caller drives it.

### Gap

Because lineageKey is content-addressed (SHA-256 over the canonical artifact
set), the simple boolean answer "L1 == L2?" is already free once the writer
(axis 1) is built. What is genuinely missing is the **explanatory delta**:
when L1 ≠ L2, which subset of artifacts caused the change? Today this
requires a custom join over `VerificationArtifact` for the same NPI between
the two `checkedAt` boundaries, plus heuristics for "did this artifact
churn vs. did a new artifact appear vs. did one expire?"

A continuity reconciler service is therefore not a one-liner: it needs

- the lineageKey writer (axis 1) to produce both keys
- the lineage persistence (axis 3) to store the `artifactChecksums` map per
  run (so the delta can be computed without re-fetching every artifact)
- a service module that takes two run rows and returns
  `{added, removed, churned}` artifact sets with their checksums

### Build effort estimate

**Multi-PR. Depends on axes 1 and 3.** After those land:

- 1 PR for the reconciler service module
  (`apps/api/backend/src/services/replay/continuityReconciler.ts`) — pure
  function over two `ReplayRun` rows, returns the delta.
- 1 PR for a reader endpoint
  (`/api/lineage/[lineageKey]/continuity?since=<runId>`) that wraps the
  reconciler.
- Optionally 1 PR for a UI primitive in `apps/web/components/trust/` that
  renders the delta.

The reconciler itself is small (low triple-digit LOC); the dependency chain
is the long pole.

---

## 7. Gap closure plan

The dependency graph between axes is:

```
  axis 1 (writer)        axis 3 (schema)
       \                   /
        \                 /
         v               v
  +------------------------------+
  |   axis 2 (reader endpoints)  |
  |   axis 4 (receipt+jti)       |
  |   axis 5 (chronology read)   |
  +------------------------------+
                 |
                 v
         axis 6 (continuity)
```

The ordered PR plan below respects that graph.

### PR-α: introduce `replayIdentity.ts` + browser parity mirror

- **Scope:**
  - `apps/api/backend/src/services/replay/replayIdentity.ts` — pure
    function `computeLineageIdentity(artifacts: Artifact[]) →
    { lineageKey: 'lin_v1_<16hex>', runId: 'run_v1_<16hex>' }`, using
    canonical JSON serialization + SHA-256 + 16-hex truncation.
  - `apps/web/lib/replay/clientReplayIdentity.ts` — same algorithm using
    `crypto.subtle.digest`.
  - Snapshot tests pin a fixed input → fixed output. Parity test runs
    both implementations against the same fixture and asserts byte
    equality.
- **Blocks:** every other PR.
- **No schema change.** No new endpoints. Pure derivation primitive.

### PR-β: add `ReplayRun` Prisma model + migration

- **Scope:**
  - New model `ReplayRun(id, lineageKey, runId@unique, entityId, checkedAt,
    artifactChecksums Json, createdAt)`, with `@@index([lineageKey])`,
    `@@index([entityId, checkedAt])`, `@@index([lineageKey, checkedAt])`.
  - Migration creates the table; no backfill on initial rollout (rows are
    appended forward).
  - Update at least one existing writer (e.g. `ingestOrchestrator` or
    `decisionCapsules.create`) to call PR-α and write a `ReplayRun` row.
- **Depends on:** PR-α.
- **Blocks:** PR-γ, PR-δ, PR-ε, PR-ζ.

### PR-γ: receipt-signing determinism

- **Scope:**
  - Rewrite `apps/web/lib/crypto/receiptIssuer.ts:signIssuerReceipt` so
    `jti = 'receipt:' + runId` and `iat = floor(lastCheckedAt / 1000)`.
    Caller must thread `runId` and `lastCheckedAt` through.
  - Add `signedReceiptJwt` storage at the issuance site (likely in
    `AuditReceiptRecord` via new `lineage_key` / `run_id` columns, or in
    a new `LineageReceipt` table — pick one).
  - Snapshot test: same input → identical JWT bytes.
- **Depends on:** PR-α, PR-β.
- **Blocks:** PR-ε.

### PR-δ: `/api/replay/[runId]` and `/api/lineage/[lineageKey]/runs`

- **Scope:**
  - `apps/web/app/api/replay/[runId]/route.ts` — single-row read of
    `ReplayRun` by `runId`.
  - `apps/web/app/api/lineage/[lineageKey]/runs/route.ts` — list of
    `ReplayRun` rows for `lineageKey` ordered by `checkedAt asc`.
  - Both surface `entityId` and `artifactChecksums` so verifiers can
    cross-check without a second round trip.
- **Depends on:** PR-β.

### PR-ε: `/api/receipt/[npi]` and `/api/receipt/by-lineage/[lineageKey]`

- **Scope:**
  - `apps/web/app/api/receipt/[npi]/route.ts` — issue or look up the
    canonical receipt for an NPI; deterministic `jti = receipt:<runId>`
    per PR-γ.
  - `apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts` — look up
    the receipt(s) stored under `lineageKey` (no more 501; PR-β provides
    the index).
  - Pin Content-Type to `application/jwt` per
    `docs/architecture/canonical-trust-route-map.md:24-25`.
  - Add the two pinning tests the route-map doc names but that do not
    yet exist on this branch:
    - `apps/web/__tests__/well-known-surfaces.test.ts`
    - `apps/web/__tests__/verifier-continuity-completion.test.ts`
- **Depends on:** PR-β, PR-γ.

### PR-ζ: continuity reconciler

- **Scope:**
  - `apps/api/backend/src/services/replay/continuityReconciler.ts` —
    pure function `diffRuns(runA, runB) → { added, removed, churned }`
    over the two rows' `artifactChecksums` maps.
  - `/api/lineage/[lineageKey]/continuity?since=<runId>` endpoint
    wrapping the reconciler.
  - Vitest fixtures cover: identical runs (empty delta), single artifact
    churn, artifact disappearance (revocation), artifact addition (new
    source onboarded).
- **Depends on:** PR-β.

### PR-η (optional UI consumption)

- **Scope:**
  - Components named in the prompt context but absent on this branch:
    `apps/web/components/trust/ReplayLineage.tsx`,
    `RecentNpis.tsx`, `ReplayIntegrityPanel.tsx`,
    `RunIdentity.tsx`, `TrustHeader.tsx`.
  - Each is a server-rendered component reading PR-δ / PR-ε / PR-ζ.
- **Depends on:** PR-δ, PR-ε, PR-ζ.
- **Not load-bearing for the canonical-route-map contract**, but
  required for the verifier-facing trust UX the doc implies.

---

## Appendix: branch context

This branch (`wave/canonical-route-map`) diverges from `origin/main` by a
single commit (`164e7039`, +114 lines, one file). The implementation stack
the canonical-route-map document references — PRs #345, #349, #355 — has not
been merged into this tree. Any reader of the doc on this branch should treat
it as a specification that will fail every assertion until the PR plan in §7
lands.

Files cited as extant on this branch:
`apps/api/backend/prisma/schema.prisma`,
`apps/api/backend/src/routes/auditReplay.ts`,
`apps/api/backend/src/routes/decisionCapsules.ts`,
`apps/api/backend/src/services/audit/replayEngine.ts`,
`apps/api/backend/src/services/investigators/{trustDeclineInvestigator,divergenceInvestigator}.ts`,
`apps/api/backend/src/services/ingest/ingestOrchestrator.ts`,
`apps/web/lib/crypto/{receiptIssuer,receiptCandidateSigner}.ts`,
`apps/web/lib/trust/jwtVerifier.ts`,
`apps/web/app/api/receipts/verify/route.ts`,
`apps/web/app/api/audit/events/route.ts`,
`apps/web/components/sandbox/SandboxApp.tsx`,
`docs/architecture/canonical-trust-route-map.md`.

Files referenced by the canonical-route-map doc or the prompt context that
do **not** exist on this branch:
`apps/web/app/.well-known/{jwks.json,did.json,openid-credential-issuer,openid-configuration,trust-register}/route.ts`,
`apps/web/app/{trust,verify}/page.tsx`,
`apps/web/app/api/receipt/[npi]/route.ts`,
`apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts`,
`apps/web/__tests__/{well-known-surfaces,verifier-continuity-completion}.test.ts`,
`apps/api/backend/src/services/replay/replayIdentity.ts`,
`apps/web/lib/replay/clientReplayIdentity.ts`,
`apps/web/components/trust/{ReplayLineage,RecentNpis,ReplayIntegrityPanel,RunIdentity,TrustHeader}.tsx`,
`scripts/replay/*`.
