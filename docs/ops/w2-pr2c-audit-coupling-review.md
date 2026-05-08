# W2-PR2C — Audit Coupling Integrity Review (Track C)

**Wave:** Wave 2, PR 2C — adversarial legitimacy governance, Track C · **Date:** 2026-05-08 · **Status:** governance review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** audit-semantics reviewer / partial-failure reviewer

This doc adversarially reviews Lock v2's audit-coupling commitments. It enumerates mutation-before-audit risks, audit-after-mutation risks, partial-failure modes, correlation-propagation gaps, and attribution inconsistencies — drawing on the runtime audit findings already in `w2-pr2b-runtime-mutation-audit.md` and `w2-pr2b-side-effect-inventory.md`.

The central thesis: **audit coupling in v2 is strong for the four `prisma.$transaction`-wrapped handlers and weaker (cosmetic) for `share-packet` and `packet`.** Lock v2's blanket "atomic mutation+audit" framing must be qualified by which handlers it applies to.

---

## 1. Coupling shapes — taxonomy

There are five distinct shapes of audit-mutation coupling in the runtime today + Lock v2's planned changes:

| Shape | Description | Handlers (today + v2) |
|---|---|---|
| **C-1: True transactional (mutation + audit in same tx)** | Atomic; either both rows commit or both roll back | `accept`, `request-refresh`, `route-to-review`, `confirm-start` |
| **C-2: Cosmetic transactional (single audit row in tx)** | The audit row IS the persistent record; tx wrap doesn't change rollback semantics | `share-packet`, `packet` (after Lock v2 wraps them) |
| **C-3: Audit-only with side effects** | Audit row + fire-and-forget telemetry | `view` (telemetry only; no audit) |
| **C-4: No coupling (read with telemetry)** | Read response + fire-and-forget learning event | `status`, `acceptance-history` |
| **C-5: Pre-tx side-effect dependency** | Side-effect read (passport build, snapshot capture) outside tx influences mutation decision | `accept` (passport-blocked check); `confirm-start` (acceptance lookup); all snapshots |

Lock v2 strengthens C-1 (preserves it) and codifies C-2 (cosmetic). It does NOT address C-5's pre-tx race window.

---

## 2. C-1 handlers — true transactional coupling

### 2.1 What's strong

The four C-1 handlers (`accept`, `request-refresh`, `route-to-review`, `confirm-start`) wrap mutation + audit + outbox writes in `prisma.$transaction`. Failure of any insert rolls back all of them.

This is the **strongest audit-coupling guarantee in the platform** today. It satisfies `MUTATION_GATE_SEQUENCE.md` §4 and `w2-pr2b-audit-coupling.md` §1.1 fully.

### 2.2 Adversarial pressure points

#### 2.2.1 Pre-tx side-effect reads (C-5)

Each C-1 handler captures a trust snapshot OR loads a passport OR queries an acceptance BEFORE the tx opens. These reads are not part of the atomicity guarantee.

| Handler | Pre-tx read | Race window |
|---|---|---|
| `accept` | `buildPassport(entityId)` (line 191) + duplicate-check (line 175) + `buildDecisionTrustSnapshot` (line 727) | Passport state can change between read and tx commit; duplicate-check can race |
| `confirm-start` | Acceptance `findFirst` (line 829) | Concurrent acceptance creation can race |
| `request-refresh` | `buildDecisionTrustSnapshot` (line 825) | Snapshot can be stale at tx commit |
| `route-to-review` | `buildDecisionTrustSnapshot` (line 925) | Same |

**Adversarial finding C-1.A:** Lock v2's atomicity claim covers tx-internal writes only. The pre-tx reads that determine WHETHER the tx writes are NOT atomic with the writes. A race-narrative that flips `passport.decisionPosture` between line 191 and the tx commit results in an audit row recording the *pre-race* posture as if it were the *commit-time* posture.

This is a real audit-truthfulness concern. The audit row's `trustSnapshot` is the snapshot at "decision time," which is a few-ms before commit. If the pre-tx read is wrong, the audit is wrong.

#### 2.2.2 Audit-after-mutation in same tx (Postgres ordering)

Within `prisma.$transaction`, the order of inserts is:

1. `tx.employerAcceptance.create(...)` — the mutation row.
2. `tx.outboxEvent.create(...)` — outbox.
3. `tx.auditEvent.create(...)` — audit.

If insert #3 (audit) fails for any reason (constraint violation, etc.), the transaction aborts and #1 + #2 roll back. **This is correct.**

However: the `audit.referenceId = acceptanceRow.id` (passed by reference). If insert #1 produced an `id` and insert #3 references it, the audit row is *post-hoc-coupled* to the acceptance — but in DB transactional terms, both are uncommitted until the tx commits. This is fine.

**Adversarial finding C-1.B:** No real concern here; the ordering is correct. Flagged only to confirm reviewer awareness.

#### 2.2.3 Outbox-then-audit ordering

`recordEmployerReviewAcceptance` writes outbox BEFORE audit. If the outbox table has a constraint that the acceptance row has not yet been committed (it hasn't — they're both in the same tx; `tx` provides isolation), the outbox insert may fail with a referential integrity issue depending on the FK shape.

The runtime audit found this works in practice — the FK is on `employer_acceptances.id` referenced by `outbox_events.entity_id` (which is the entityId UUID, not the acceptance row). So no FK race exists.

**Adversarial finding C-1.C:** No concern. Flagged for reviewer awareness.

#### 2.2.4 `route-to-review` HITL try/catch

`recordEmployerReviewRouting` wraps `tx.hITLReviewItem.create` in try/catch (line 932). On throw, `reviewItemId = null` and the tx continues. This means:

- If the HITL Prisma model is missing OR fails — the tx commits with outbox + audit but no HITL row.
- The audit row records `reviewItemCreated: false` so forensics is preserved.

**Adversarial finding C-1.D:** the silent-degrade is auditable but not alertable — without a Sentry breadcrumb on the catch, an operator may not notice the degradation until queue-depth reports. Lock v2 §6 promises to add a "logged warning + Sentry breadcrumb at degrade." This MUST land in the implementation; without it, the degrade is genuinely silent and undermines audit-coupling integrity.

#### 2.2.5 Long transaction risk

Each `prisma.$transaction` in v2 runs:

- 1–3 inserts.
- An optional HITL insert (route-to-review only).
- No external HTTP calls.

Total tx duration: low ms. No row-lock contention concern beyond the duplicate-check predicate on `(employerId, clinicianNpi)`.

**Adversarial finding C-1.E:** No concern at v2 scale. If the wave's success leads to 100x volume, lock contention on `EmployerAcceptance` could become real. Out of scope for v2.

---

## 3. C-2 handlers — cosmetic transactional coupling

### 3.1 What Lock v2 commits

§6 of Lock v2: "wrap audit insert in a `prisma.$transaction((tx) => ...)` (single-write tx is acceptable — establishes the contract that share-packet's audit row is the persistent record AND is rollback-safe)."

### 3.2 Adversarial pressure

#### 3.2.1 The wrap is functionally a no-op

A single insert inside `prisma.$transaction` has the same atomicity properties as a bare `prisma.auditEvent.create`: the insert either commits or it doesn't. There is no second write to roll back.

**Adversarial finding C-2.A:** the wrap is **code-uniformity**, NOT additional rollback safety. Lock v2's wording "AND is rollback-safe" inflates the guarantee. The honest framing is "establishes a uniform code pattern; provides no additional rollback semantics."

#### 3.2.2 Response delivery is outside the tx

For `share-packet`:
1. tx commits the audit row.
2. Response writes the share URL to the client.

If step 2 fails (network drop, response stream closed), the audit row persists — recording an issued share token that the client never received.

For `packet`:
1. tx commits the audit row.
2. Response streams the packet bytes.

If step 2 fails mid-stream, the audit row says "exported" but the bytes are partial.

**Adversarial finding C-2.B:** Lock v2's "atomic" framing for these handlers is misleading because the **delivery side effect** (response stream) is the user-observable artifact, and it is NOT atomic with the audit row. The audit log's truth diverges from delivery's truth.

The honest framing: "the audit row records an export attempt that succeeded at the platform layer; delivery to the caller is not guaranteed by the audit row."

#### 3.2.3 Audit-as-persistence pattern semantic

For `share-packet`, the audit row IS the share-token record. Resolution path queries audit metadata for `shareTokenHash`. This pattern means:

- Audit retention policy = share-token TTL ceiling.
- Audit deletion (for compliance) = share-token revocation.
- Audit table queryability = share-resolution latency.

**Adversarial finding C-2.C:** the audit table is not architected as a primary-key store for share tokens. Using it as one couples two concerns (forensics + token resolution) that may evolve at different cadences. Lock v2 preserves this pattern; the wave does not introduce it but does not address it either. Flagged for the future-migration wave (`w2-pr2b-future-org-ownership-migration.md` §5).

---

## 4. Correlation propagation gaps

### 4.1 The propagation chain

Lock v2's correlationId path:

```
Client
  → web proxy (validates UUID format; generates if absent)
  → backend (reads x-correlation-id header)
  → service function (passes to recordEmployerReview*)
  → audit-event metadata (correlationId field)
```

Five hops. Each is a potential silent-drop.

### 4.2 Per-hop drop scenarios

| Hop | Drop cause | Result |
|---|---|---|
| **Hop 1: client → proxy** | Client doesn't send `x-correlation-id` | Proxy generates fresh UUID per attempt; idempotency benefit lost (each retry is "new") |
| **Hop 2: proxy → backend** | Proxy regression / config — header not forwarded | Backend doesn't see correlationId; service function generates one OR records `null` |
| **Hop 3: backend → service** | Service function signature doesn't accept correlationId param (TODO until implemented) | correlationId silently dropped |
| **Hop 4: service → audit metadata** | Metadata builder forgets the field | Audit row has no correlationId; observability lost |
| **Hop 5: audit metadata → forensic query** | Query author doesn't know about the field | Forensics never use the data |

**Adversarial finding C-3.A:** five hops is a lot of propagation. Each requires the implementation PR to maintain the chain. Test coverage in §7.4 of Lock v2 covers Hop 4 (audit row contains correlationId) but NOT Hops 1–3 explicitly. The wave should add tests that:

- Assert proxy generates a UUID when client absent (Hop 1 covered).
- Assert backend receives the proxy-generated value (Hop 2).
- Assert service function receives the value from the route handler (Hop 3).
- Assert audit row contains the value (Hop 4 — already in §7.4).

Without these, a regression at any hop produces silent observability loss.

### 4.3 Mismatched correlationId across hops

What if:
- Client sends `x-correlation-id: A`.
- Proxy validates UUID format and forwards `A`.
- Backend reads `A`, but a downstream middleware (for some reason) overwrites it to `B`.
- Audit metadata records `B`.

Now the client thinks "I sent correlationId A," logs/forensics show `B`. The two never reconcile.

**Adversarial finding C-3.B:** there is no in-process invariant that the correlationId observed by the route handler matches the one returned in the response header. The implementation PR should:

- Echo the value-as-recorded in the response header `x-correlation-id`.
- Ensure the response header value matches what landed in the audit row.

Lock v2 §3 says "echoed in proxy response header `x-correlation-id`" — but the proxy echoes the value IT generated, which may differ from what the backend / audit recorded. This is an alignment risk.

---

## 5. Attribution inconsistencies

### 5.1 Multiple attribution fields per audit row

Today's audit rows carry:

- `metadata.employerId` (= Clerk userId; existing)
- `metadata.actorId` (= Clerk userId; NEW per Lock v2 §8)
- `metadata.attribution.organizationId` (= attribution-resolved org, if any)
- `metadata.attribution.bundleId` (= bundle, if any)
- `metadata.attribution.organizationName` (= friendly name, if any)
- `metadata.attribution.requestorEntityId` (= requesting entity, if any)
- `metadata.organizationContextId` (= raw client-supplied attribution)

Seven distinct attribution fields. Each is filled by a different code path.

**Adversarial finding C-4.A:** seven fields invite drift. A forensic query must know which to trust. Lock v2 §5.1 forbids using `organizationContextId` for authorization but **allows recording it in audit metadata as descriptive attribution** — which means a forensic query that joins on `organizationContextId` reaches an attacker-supplied value. Lock v2 should explicitly disclaim that `metadata.attribution.organizationContextId` is **untrusted client input** and forensic analytics must not rely on it as if it were authoritative.

### 5.2 `actorId` vs `employerId` redundancy

Lock v2 §8 introduces `metadata.actorId`. The existing `metadata.employerId` IS the same value (Clerk userId). Two fields, same value. Two queries, same answer.

**Adversarial finding C-4.B:** redundant fields drift over time. If a future schema change keeps one and removes the other (or renames `employerId` to `userId`), forensic queries break differently depending on which they used.

Recommendation: pick one canonical name for "the actor's Clerk userId in audit metadata" and use it everywhere. Lock v2 should either:
- Use existing `employerId` and skip the new `actorId` (preserves runtime; less noise).
- Use new `actorId` and deprecate `employerId` (cleaner semantics; needs deprecation window).

The wave's PR description must declare which.

### 5.3 `tenantId` / `organizationId` always-NULL

Lock v2 §8: "`tenantId` field on `AuditEvent` — NULL or omitted in v1."

A reader of the audit row sees `tenantId: null` and may infer "this row applies to no tenant." The correct interpretation is "this row's tenant is undefined in v1." The semantic distinction matters for downstream analytics.

**Adversarial finding C-4.C:** `null` is overloaded. The wave should consider populating `tenantId` with a sentinel (e.g., `'__pre_org_migration__'`) to distinguish "deliberately-NULL-pending-migration" from "row is broken." Or document that v1 audit rows have NULL `tenantId` by design.

---

## 6. Partial-failure risks

### 6.1 The audit row commits but downstream side effects fail

This is the dominant partial-failure pattern (per `w2-pr2b-side-effect-inventory.md` §4). Examples:

- `accept`: audit commits → SEAL `captureEmployerDecision` fails → SEAL state stale.
- `confirm-start`: audit commits → `captureStartOutcome` fails → KPI funnel underreports.
- `route-to-review`: audit commits → `recomputeMatchBoosts` throws → match boosts stale.

Lock v2 does NOT change this. Side effects remain fire-and-forget.

**Adversarial finding C-5.A:** the wave's audit-coupling rule applies only to mutation+audit. Side-effect coupling is intentionally NOT atomic. This is correct — but reviewer must confirm that NO commit message, audit-row label, or PR description claims "all-or-nothing semantics" for the broader operation.

### 6.2 The audit row commits but the response delivery fails

Per §3.2.2 above. For `share-packet` and `packet`, the audit row records "issued/exported" while the caller may not have received it.

**Adversarial finding C-5.B:** the wave should add a response-delivery assertion at the end of `share-packet` and `packet` handlers — `try { await deliver() } catch { /* breadcrumb but do NOT roll back audit */ }`. The current pattern is fire-and-forget delivery; making the failure visible is a hardening that fits the wave's scope.

### 6.3 Concurrent retries with mismatched correlationIds

If client A retries with correlationId X, then X', then X again (cycle), the duplicate-check fires intermittently. Two of three could commit duplicates.

**Adversarial finding C-5.C:** the duplicate-check is sensitive to client implementation. Honest clients with stable correlationId per logical operation are protected; clients that rotate correlationIds per attempt are not. The wave should publish a "client retry guidance" doc as part of the PR's documentation surface.

---

## 7. Audit-coupling matrix (per branch, post-Lock v2)

| Branch | Pre-tx race | Mutation+audit atomic? | Side-effect coupling | Response-delivery atomic? | Correlation propagation | Attribution clarity |
|---|---|---|---|---|---|---|
| `accept` | YES (passport, dup-check, snapshot) | YES (C-1) | fire-and-forget (3 SEAL/learning/recompute) | n/a (no stream) | hop-vulnerable | 7-field redundancy |
| `confirm-start` | YES (acceptance lookup) | YES (C-1) | fire-and-forget (1 KPI capture) | n/a | hop-vulnerable | redundancy |
| `request-refresh` | YES (snapshot) | YES (C-1) | fire-and-forget (2 SEAL/learning) | n/a | hop-vulnerable | redundancy |
| `route-to-review` | YES (snapshot) | YES (C-1, with HITL try/catch) | fire-and-forget (3) | n/a | hop-vulnerable | redundancy + reviewItemCreated |
| `share-packet` | NO | C-2 (cosmetic) | none | NO (response stream) | hop-vulnerable | shareTokenHash + redundancy |
| `packet` (GET, audit-emitting) | NO | C-2 (cosmetic) | none | NO (ZIP/JSON stream) | n/a (read; no client-supplied correlationId expected) | redundancy |

**Aggregate observation:** every branch has at least one "NO" or "fire-and-forget" cell. Lock v2's blanket "atomic mutation+audit" wording must be qualified per branch.

---

## 8. Recommendations to Lock v2 (audit-coupling)

| # | Recommendation |
|---|---|
| **C-Rec-1** | Replace blanket "atomic mutation+audit" with per-branch table — use the matrix in §7 |
| **C-Rec-2** | Disclose pre-tx race windows explicitly (which reads happen outside tx and what their staleness implies) |
| **C-Rec-3** | Pick one canonical field for actor attribution in audit metadata (recommend `actorId`); document deprecation of redundant fields |
| **C-Rec-4** | Document that `metadata.tenantId = null` in v1 is deliberate; consider sentinel value or explicit comment |
| **C-Rec-5** | Mandate `metadata.payloadHash` on EVERY audit row (permitted + denied) so capture-replay leaves a fingerprint (per Track B B-Rec-3) |
| **C-Rec-6** | Echo audit-recorded correlationId in `x-correlation-id` response header — and assert in tests that proxy-emitted ID matches audit-row ID |
| **C-Rec-7** | Add Sentry breadcrumb on `route-to-review` HITL silent-degrade (Lock v2 §6 already promises; merge gate must verify) |
| **C-Rec-8** | For `share-packet` + `packet`, change the lock's wording from "atomic mutation+audit" to "single-row tx wrap for code uniformity; delivery is not guaranteed atomic with audit row" |
| **C-Rec-9** | Document that `metadata.organizationContextId` is untrusted client input; forensic analytics must NOT treat it as authoritative |
| **C-Rec-10** | Add a "client retry guidance" page describing how to construct correlationIds for honest-client idempotency |

---

## 9. Closing principle (Track C)

Audit coupling is the wave's strongest commitment for the four C-1 handlers and a uniform-code-pattern commitment for the C-2 handlers. The wording must be honest about which is which.

**The wave is safe for audit-coupling IF the language distinguishes (a) true transactional atomicity from cosmetic atomicity, (b) tx-internal atomicity from end-to-end atomicity (delivery), (c) authoritative attribution from descriptive attribution.** Reviewer's job is to enforce the distinction at every surface where audit-coupling claims appear.
