# W2-PR2B — Side-Effect Inventory

**Wave:** Wave 2, PR 2B — runtime audit, side-effect inventory · **Date:** 2026-05-08 · **Status:** audit only; **NO product code, NO runtime modification, NO merge** · **Scope:** every fire-and-forget call, intra-process telemetry capture, outbox emission, recompute job, and external dispatch triggered by the `/api/employer-review/**` mutation surface · **Authority:** companion to `w2-pr2b-runtime-mutation-audit.md` and `w2-pr2b-mutation-branch-map.md`

This doc inventories side effects — the calls each mutating handler launches in addition to the primary persistence + audit write. They are catalogued because they shape replay risk, race conditions, observability gaps, and the visibility of failures that the constitutional layer does NOT cover.

A side effect, in this audit's terms, is any call that:

1. Fires after the primary `prisma.$transaction` commits (or in some cases, before it),
2. Is dispatched via `void` to discard the Promise OR via `.catch(...)` to swallow errors,
3. Is NOT rolled back if the primary mutation rolls back, AND
4. Is NOT re-tried by the handler on failure.

In total: 14 distinct side-effect dispatches across 5 mutating handlers + 2 audit-emitting reads. Some side effects emit to in-process queues (outbox), some to learning capture, some to KPI / SEAL pipelines, some are pure logging.

---

## 1. Side-effect taxonomy

| Type | Definition | Failure mode |
|---|---|---|
| **Outbox event** | Insert into the outbox table within the same `$transaction` as the audit row; consumed asynchronously by a downstream worker | Persisted; never lost. Failure here rolls back the mutation |
| **Trust snapshot capture** | Pre-transaction read of decision-time trust state for inclusion in audit metadata | Read failure aborts the mutation |
| **SEAL decision capture** | Fire-and-forget intra-process call to `captureEmployerDecision` with full trust snapshot | Logged warning if it throws; mutation already committed |
| **Learning capture** | Fire-and-forget call to `captureDecisionSignal` for recommender/boost training | Silently dropped on error |
| **Boost recompute** | Fire-and-forget call to `recomputeMatchBoosts` with `.catch(() => {})` | Errors silently swallowed |
| **KPI / pilot capture** | Fire-and-forget call to `captureStartOutcome`, `captureAdvisoryEvent`, etc. | `.catch(...)` logs warning |
| **Learning event emit** | `emitLearningEvent` for read-flavored signals (e.g., EMPLOYER_VIEWED) | Fire-and-forget |
| **Logging** | `log('info', ...)` after the mutation commits | Synchronous; failure is rare |
| **Trust container manifest entry** | Issuance of a manifest entry consumed by the packet builder | Synchronous; read-shaped |

---

## 2. Per-handler side-effect catalogue

### 2.1 `accept` (B1)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `buildDecisionTrustSnapshot(input.clinicianNpi)` | BEFORE tx (line 727) | Aborts the mutation | Snapshot must be in audit metadata; not optional |
| 2 | `writeEmployerReviewOutboxEvent(tx, ...)` | INSIDE tx (line 754) | Aborts mutation | Outbox is durable; downstream worker dispatches |
| 3 | `writeEmployerReviewAuditEvent(tx, ...)` | INSIDE tx (line 795) | Aborts mutation | Atomic with acceptance row |
| 4 | `log('info', 'employer_review_accepted', ...)` | AFTER tx commit (line 227) | Synchronous; never aborts | Operational telemetry |
| 5 | `void captureEmployerDecision({trustSnapshotAtDecision, ...})` | AFTER tx commit (line 237) | Promise discarded — silent on throw | SEAL pipeline; tolerant |
| 6 | `void captureDecisionSignal({decision: 'accept', ...})` | AFTER tx commit (line 271) | Promise discarded | Learning pipeline; eventually consistent |
| 7 | `void recomputeMatchBoosts().catch(() => {})` | AFTER tx commit (line 289) | `.catch` swallows | Recommender refresh; tolerant |

**Properties:**
- Pre-transaction reads (#1) make the snapshot capture a hard dependency — a transient DB hiccup on the snapshot path aborts the entire mutation. This is intentional (snapshot is part of the non-repudiation event).
- Post-transaction side effects (#5, #6, #7) are eventually-consistent. A failure leaves the audit row referencing a SEAL/learning state that never landed.
- The acceptance is durable as soon as the `$transaction` commits; subsequent side effects are best-effort.

### 2.2 `confirm-start` (B2)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | Acceptance lookup (`prisma.employerAcceptance.findFirst`) | BEFORE tx (line 829) | 409 if missing | Required for the StartAttestation reference |
| 2 | INSIDE tx — `tx.startAttestation.create` | INSIDE tx (line 864) | Aborts mutation | Primary mutation |
| 3 | INSIDE tx — `tx.auditEvent.create` (`type: 'START_ATTESTED'`) | INSIDE tx (line 874) | Aborts mutation | Atomic with attestation |
| 4 | `log('info', 'employer_start_attested', ...)` | AFTER tx commit (line 897) | Synchronous | Operational |
| 5 | `void captureStartOutcome({...}).catch(...)` | AFTER tx commit (line 908) | `.catch` logs warning | KPI funnel; tolerant |

**Properties:**
- No SEAL/learning side effects on `confirm-start`. The KPI capture is the only post-commit side effect.
- The acceptance lookup BEFORE tx is the implicit ownership check (per-actor scope). A change-of-actor concurrent with the transaction does not corrupt — the acceptance lookup is read at decision time, used inside the tx.

### 2.3 `request-refresh` (B3)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `buildDecisionTrustSnapshot(...)` | BEFORE tx (line 825) | Aborts mutation | For audit metadata |
| 2 | INSIDE tx — outbox event write | INSIDE tx (line 865) | Aborts mutation | Durable; the only persisted shape |
| 3 | INSIDE tx — audit event write | INSIDE tx (line 884) | Aborts mutation | Atomic with outbox |
| 4 | `log('info', 'employer_review_refresh_requested', ...)` | AFTER tx commit (line 330) | Synchronous | Operational |
| 5 | `void captureEmployerDecision({decision: 'REQUEST_REFRESH', ...})` | AFTER tx commit (line 341) | Promise discarded | SEAL |
| 6 | `void captureDecisionSignal({decision: 'request_info', ...})` | AFTER tx commit (line 376) | Promise discarded | Learning |

**Properties:**
- No `recomputeMatchBoosts` on refresh-request (unlike accept/route-to-review).
- All side effects are fire-and-forget.

### 2.4 `route-to-review` (B4)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `buildDecisionTrustSnapshot(...)` | BEFORE tx (line 925) | Aborts mutation | For audit metadata |
| 2 | INSIDE tx — `hITLReviewItem.create` (try/catch) | INSIDE tx (line 932) | Silently degrades to outbox-only on throw | Optional model; tolerated absence |
| 3 | INSIDE tx — outbox event write | INSIDE tx (line 978) | Aborts mutation | Durable |
| 4 | INSIDE tx — audit event write | INSIDE tx (line 997) | Aborts mutation | Atomic with outbox |
| 5 | `log('info', 'employer_review_routed_to_review', ...)` | AFTER tx commit (line 431) | Synchronous | Operational |
| 6 | `void captureEmployerDecision({decision: 'ROUTE_TO_REVIEW', ...})` | AFTER tx commit (line 442) | Promise discarded | SEAL |
| 7 | `void captureDecisionSignal({decision: 'reject', ...})` | AFTER tx commit (line 477) | Promise discarded | Learning (note: 'reject' literal) |
| 8 | `void recomputeMatchBoosts().catch(() => {})` | AFTER tx commit (line 495) | `.catch` swallows | Recommender refresh |

**Properties:**
- The HITL try/catch (#2) is the *single* observed silent-degrade pattern in the surface. If the optional `HITLReviewItem` Prisma model is missing or throws, the mutation continues but the queue item is not created. The audit row records `reviewItemCreated: false` so SOC analysts can detect this.
- The `'reject'` literal in #7 is semantically broader than "route-to-review" — the learning pipeline treats routing as rejection signal.

### 2.5 `share-packet` (B5)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `resolveEmployerReviewSubject(entityId)` | BEFORE (no tx) (line 668) | 404 if missing | Subject NPI lookup |
| 2 | `buildShareToken()` | BEFORE persistence (line 683) | n/a — pure | Token gen |
| 3 | `hashShareToken(shareToken)` | BEFORE persistence (line 684) | n/a — pure | Hash for audit lookup |
| 4 | `prisma.auditEvent.create({type: 'EMPLOYER_PACKET_SHARED', ...})` | Standalone (NO tx) (line 699) | 500 on failure | Audit IS the persistence record |
| 5 | `log('info', 'employer_packet_shared', ...)` | AFTER audit insert (line 713) | Synchronous | Operational |

**Properties:**
- No `$transaction` — the audit row is the only persisted record. There is no companion mutation to be atomic with. If the audit insert succeeds but the response write fails, the share record exists but the caller never gets the URL. The share token resolution path (sibling endpoint at line 734) would still work for any holder of the secret token.
- No SEAL/learning/recompute side effects.
- Token entropy: provided by `buildShareToken()` — implementation in `applyShareService.ts`. (Audit does not inspect the entropy source; flagged as O7 in the parent doc.)

### 2.6 `view` (B6)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `resolveEmployerReviewAttribution(...)` | BEFORE persistence (line 143) | 500 propagates | Read |
| 2 | `void captureAdvisoryEvent({...}).catch(...)` | (No tx; only this side effect) (line 156) | `.catch` logs warning | Pilot KPI capture; the only persisted-ish output |

**Properties:**
- Returns 202 immediately (line 181) regardless of whether `captureAdvisoryEvent` succeeds.
- No DB mutation, no audit row, no SEAL capture.
- Anonymous; no Clerk auth.

### 2.7 `packet` (B7 — audit-writing GET)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `Promise.all([buildPassport, prisma.vcvEntity.findUnique])` | BEFORE persistence (line 569) | 404 if missing | Read |
| 2 | `issueTrustContainerManifestEntry({passport})` | BEFORE persistence (line 583) | 500 propagates | Read |
| 3 | `buildEmployerEvidencePacket(...)` | BEFORE persistence (line 584) | 500 propagates | Pure construction |
| 4 | `prisma.auditEvent.create({type: 'ARTIFACT_EXPORTED', ...})` | Standalone (NO tx) (line 611) | 500 on failure | Audit-only persistence |
| 5 | `log('info', 'employer_packet_exported', ...)` | AFTER audit insert (line 625) | Synchronous | Operational |
| 6 | ZIP stream via `createEmployerEvidencePacketZipStream(packet).pipe(res)` OR JSON via `res.json(packet)` | AFTER audit insert (lines 642, 651) | Stream errors after audit committed | Response delivery |

**Properties:**
- The audit row commits BEFORE the packet bytes leave the perimeter. A network drop between audit insert and stream completion leaves a "successful export" audit row with no actual delivery — the audit log says "exported" but the caller never received the bytes.
- The reverse order (stream then audit) would risk audit-loss but ensure delivery; today's order favors auditability over delivery success. This is the right trade-off but worth documenting.

### 2.8 `status` (B8 — telemetry-emitting read)

| # | Side effect | Order relative to tx | Failure path | Why fire-and-forget |
|---|---|---|---|---|
| 1 | `loadEmployerReviewStatus({...})` | BEFORE persistence (line 512) | 500 propagates | Read |
| 2 | `emitLearningEvent({type: 'EMPLOYER_VIEWED', providerId, employerId, ...})` | After read (line 525) | Fire-and-forget | Learning |

**Properties:**
- No audit row, no DB mutation. Only learning telemetry.

### 2.9 `acceptance-history` (B9), `refresh-requests` (B10)

No side effects. Pure reads.

---

## 3. External calls

NONE in any handler in this surface. No HTTP calls, no message queue puts, no S3 writes. All side effects are intra-process (Promise dispatches that may eventually write to other tables or to in-memory queues consumed by intra-process workers).

This is operationally favorable: there is no out-of-process failure that can corrupt the mutation. It is also a constraint: any future per-tenant rate-limit, per-actor lockout, or external SIEM integration must be added explicitly and will introduce out-of-process failure modes that the current surface does not have.

---

## 4. Side-effect failure modes the constitutional layer does NOT cover

The audit-coupling contract (`MUTATION_GATE_SEQUENCE.md` §4 + `w2-pr2b-audit-coupling.md` §1.1) requires atomic mutation+audit. It does NOT require atomic side-effects. The following failure modes are therefore explicitly OUT OF SCOPE for the constitutional layer but flagged here for visibility:

| Failure | Today's behavior | Operational consequence |
|---|---|---|
| Audit row commits but `captureEmployerDecision` SEAL throws | Logged warning; SEAL state stale | A downstream consumer reading "the latest decision for entity X" sees the prior decision's SEAL state |
| Audit row commits but `captureDecisionSignal` learning throws | Promise discarded silently | The learning model trains on N-1 signals; eventual consistency holds for next mutation |
| Audit row commits but `recomputeMatchBoosts` throws | `.catch` swallows | Match boosts stale; recomputed on next trigger |
| Audit row commits but `captureStartOutcome` (confirm-start) throws | `.catch` logs warning | KPI funnel underreports; pilot-funnel pipeline reconciles eventually |
| `route-to-review` HITL `tx.hITLReviewItem.create` throws inside tx | `try/catch` silently sets `reviewItemId=null` | Audit row records `reviewItemCreated: false`; queue item missing |
| `share-packet` audit commits but stream/response fails | Caller never gets share URL | Token is valid; if attacker had pre-stolen the audit row, they could resolve it. Practically: caller retries, gets new token, both valid until expiry |
| `packet` audit commits but stream fails mid-flight | Caller gets partial bytes | Audit says "exported"; reality is partial delivery |

The remediation for each of these is operational (alerting, retry semantics, manual reconciliation), not constitutional. W2-PR2B does NOT introduce a "side-effects must be atomic with mutation+audit" rule because:

1. The current pattern is intentionally fire-and-forget for resilience.
2. Forcing atomicity on observability writes would couple availability of the mutation to availability of the SEAL/learning pipelines.
3. The audit row provides forensic visibility of *which* mutation occurred; reconciliation of side effects is an operations concern.

---

## 5. Side-effect coupling to ownership enforcement

When W2-PR2B introduces ownership enforcement, the side effects above continue to fire ONLY when the mutation succeeds. A denied attempt (cross-tenant 404, role-denied 403, etc.) does NOT fire any of them. The denied audit row is the ONLY persisted record of a denied attempt.

**Implication:** the side-effect inventory does not need to change for ownership enforcement. The constitutional contract handles it: denied attempts fire NO mutation, NO outbox, NO SEAL capture, NO learning capture, NO recompute, NO logging. They fire ONE denied audit row.

This is correct. The wave's risk is not in side-effect leakage; it is in the mutation surface itself.

---

## 6. Stale-state risks induced by side-effect ordering

| Stale-state risk | Cause | Severity |
|---|---|---|
| SEAL trust snapshot captured pre-tx may differ from post-tx state if a parallel ingest writes during the mutation | Pre-transaction snapshot read (line 727 / 825 / 925) | LOW (intentional) |
| Acceptance lookup BEFORE tx (B1, line 175) may pass while a concurrent accept inserts the duplicate before this one's tx commits | Race on `(employerId, clinicianNpi, status='ACCEPTED')` | MEDIUM |
| Passport BLOCKED check BEFORE tx (B1, line 191) may pass while a concurrent ingest flips the source state | Race on passport.decisionPosture | MEDIUM |
| `confirm-start` acceptance lookup may match a row that gets superseded by a concurrent re-accept before tx commits | Race on `EmployerAcceptance` | LOW |
| `route-to-review` HITL queue item may be created with stale priority/reason if the request body and a concurrent re-classification both land | Race on actor's classification intent | LOW |

None of these is a security breach in the cross-tenant sense. They are ops-level races that produce duplicate state or stale state.

---

## 7. Replay risk amplification by side effects

Side effects amplify replay risk because each retry re-fires the side-effect chain. Specifically:

- `accept` retry → 2× SEAL captures, 2× learning captures, 2× boost recomputes (if both pass duplicate-check race).
- `confirm-start` retry → 2× KPI captures, 2× StartAttestation rows.
- `request-refresh` retry → 2× SEAL captures, 2× learning captures, 2× outbox events.
- `route-to-review` retry → 2× HITL items, 2× SEAL captures, 2× learning captures, 2× boost recomputes.
- `share-packet` retry → 2× tokens (both valid).
- `packet` retry → 2× ARTIFACT_EXPORTED audit rows; 2× evidence packet streams.
- `view` retry → 2× advisory events.

Idempotency keys (per `MUTATION_GATE_SEQUENCE.md` §3.6 and `w2-pr2b-audit-coupling.md` §3.6) would prevent the second mutation from committing, which would prevent the second side-effect chain from firing. They are not enforced today on any of these handlers.

---

## 8. Closing principle

Side effects in the employer-review mutation surface are intra-process, fire-and-forget, and intentionally tolerant of failure. They are NOT covered by the constitutional atomic-mutation+audit rule, and they SHOULD NOT be — coupling observability writes to mutation availability would invert the trade-off the platform intentionally made.

**Side effects are visible in audit metadata (trust snapshot, persistence shape, attribution), reconcilable post-hoc, and bounded in blast radius. They are not the wave's risk surface; the mutation surface is.** W2-PR2B's responsibility is to ensure that ownership enforcement does not change side-effect ordering or atomicity; the inventory above is the contract that ensures the wave preserves what already works.
