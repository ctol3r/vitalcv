# Replay Taxonomy Map

**Status:** **CONSTITUTIONAL** — frozen reference for VitalCV replay-event semantics · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` §1.3, `audit-event-vocabulary-map.md`, `w2-pr7a-replay-taxonomy-convergence.md`

This doc is the operational reference for **how the platform observes, denies, accepts, collapses, or remains ambiguous about replays.** It maps the 3 parallel replay primitives (canonical `IDEMPOTENT_REPLAY` + `CONCURRENCY_GUARD_TRIGGERED`; Lock v2 `<base>.duplicate_request`; governance R-CAT-* taxonomy) into one operational language.

The central rule: **"replay observability" is NOT "replay prevention."** Per `TRUST_GUARANTEE_LEXICON.md` §1.3, "replay protected" / "replay-resistant" / "replay-secure" are FORBIDDEN phrases unless server-minted nonce + DB UNIQUE substrate exists. This doc enforces the discipline by naming each replay state precisely.

---

## 1. The 5 replay states (canonical)

A replay attempt produces ONE of five outcomes from the platform's perspective. The audit log records the outcome via either an event-type, an action-literal suffix, or by absence. SOC analysts use these 5 states to disambiguate:

| State | Wire | Persisted artifact | Meaning |
|---|---|---|---|
| **R-OBSERVED** | (no caller-visible signal) | `IDEMPOTENT_REPLAY` audit event (canonical) | Operation was processed; the platform recognized it as an idempotent repeat AND completed it returning the original outcome |
| **R-DENIED** | 409 `duplicate_request` | Audit row with `metadata.action: '<base>.duplicate_request'`, `metadata.outcome: 'denied'` (Lock v2) | Operation was REJECTED at the application-layer correlationId gate within 24h |
| **R-ACCEPTED** | 200/201 (success) | Audit row with no replay marker | Operation was processed normally; either (a) genuinely new, OR (b) a replay that bypassed dedup (TOCTOU race / fresh correlationId / capture-replay) |
| **R-COLLAPSED** | (varies) | `CONCURRENCY_GUARD_TRIGGERED` audit event (canonical) | Concurrency mechanism (DB UNIQUE / advisory lock) prevented duplicate state; one of the racing operations succeeded |
| **R-AMBIGUOUS** | (varies) | (multiple audit rows; SOC must disambiguate) | Insufficient signal to distinguish — see ambiguity matrix in §6 |

---

## 2. Per-state operational definition

### 2.1 R-OBSERVED — replay observed AND processed

**Definition:** the platform's idempotent-operation handler detected the replay, recognized the prior result, and returned it without performing the action twice.

**Substrate (canonical):** `IDEMPOTENT_REPLAY` audit event (canonical AUDIT_EVENT_TYPES).

**Substrate (Lock v2):** N/A — Lock v2's correlationId gate is DENY-on-replay, not REPLAY-AND-RETURN-PRIOR. The wave does not implement R-OBSERVED.

**Wave-scope coverage:**
- `accept` handler today does NOT implement R-OBSERVED (returns 409 already_accepted on retry, not the prior result).
- No wave-scope handler implements R-OBSERVED today.
- `IDEMPOTENT_REPLAY` event is used elsewhere in the platform (UNVERIFIED specifics).

**SOC query:** `WHERE type = 'IDEMPOTENT_REPLAY' AND clinician_id = $npi`.

### 2.2 R-DENIED — replay denied at the gate

**Definition:** the platform's correlationId-based dedup detected a duplicate within 24h and refused to process the request a second time.

**Substrate (Lock v2):** `metadata.action: '<base>.duplicate_request'` + `metadata.outcome: 'denied'` on a denied audit row.

**Substrate (existing — `accept`-specific):** `metadata.action: '<base>.already_accepted'` on `accept` handler's existing 409 path (post-Lock-v2 audit emission).

**Wave-scope coverage:**
- All 5 mutating handlers (`accept`, `confirm-start`, `request-refresh`, `route-to-review`, `share-packet`) — post-Lock-v2.
- `accept` ALSO has the existing `<base>.already_accepted` denial (per-actor scope; `(employerId, clinicianNpi, status='ACCEPTED')` UNIQUE-via-query).

**SOC query:** `WHERE metadata->>'action' LIKE '%duplicate_request' OR metadata->>'action' LIKE '%already_accepted' AND metadata->>'outcome' = 'denied'`.

### 2.3 R-ACCEPTED — replay processed as if new

**Definition:** the platform processed the operation normally. Either it WAS new, or it was a replay that EVADED dedup (3 evasion paths).

**Evasion paths:**

1. **TOCTOU race** — concurrent retry slipped between dedup-check query and audit insert.
2. **Fresh correlationId** — client supplied a different correlationId per attempt; dedup couldn't match.
3. **Long-window** — retry past 24h dedup window.

**Substrate:** the audit row looks IDENTICAL to a permitted-new-operation row. There is NO marker on the row indicating it was a replay. **Replay detection on R-ACCEPTED requires forensic clustering.**

**Wave-scope detection:** post-ML-Rec-1 (mandate `payloadHash` on every audit row), forensic clustering by `(actorId, payloadHash)` reveals R-ACCEPTED replays:

```sql
SELECT actor_id, payload_hash, COUNT(*), MIN(created_at), MAX(created_at)
FROM audit_events
WHERE created_at > now() - interval '7 days'
GROUP BY actor_id, payload_hash
HAVING COUNT(*) > 1;
```

Multiple rows with same `(actor, payloadHash)` likely indicate replay (collisions at SHA-256 negligibly rare).

### 2.4 R-COLLAPSED — concurrency mechanism prevented duplicate

**Definition:** a DB UNIQUE constraint, advisory lock, or other concurrency guard fired during a race, allowing exactly one operation to succeed and rejecting the other(s).

**Substrate (canonical):** `CONCURRENCY_GUARD_TRIGGERED` audit event.

**Substrate (DB-level):** Postgres UNIQUE constraint violations OR advisory-lock contention.

**Wave-scope coverage:**
- `accept` does NOT have a DB UNIQUE on `(employerId, clinicianNpi, status='ACCEPTED')` — TOCTOU race exists. R-COLLAPSED does NOT fire.
- `confirm-start` does NOT have a DB UNIQUE on `StartAttestation.acceptanceId` — same.
- Lock v2 does NOT introduce DB UNIQUEs.
- W2-PR2B-MIG-A introduces DB UNIQUE constraints — at that point R-COLLAPSED becomes operational for the wave's handlers.

**SOC query:** `WHERE type = 'CONCURRENCY_GUARD_TRIGGERED' AND clinician_id = $npi`.

### 2.5 R-AMBIGUOUS — insufficient signal

**Definition:** the audit log shows multiple rows for similar operations but does not unambiguously classify which replay state applies.

**Substrate:** multiple permitted rows with same `(actor, correlationId)` (TOCTOU race) OR multiple permitted rows with same `(actor, payloadHash)` (capture-replay or coincidence).

**Wave-scope handling:** SOC analyst must use disambiguation queries (per §6) and may reach inconclusive verdict.

---

## 3. The 6-category R-CAT-* governance taxonomy (analytical lens)

Per `w2-pr2c-replay-governance-review.md` §1, the R-CAT framework is the ANALYTICAL lens used by reviewers — NOT a runtime primitive.

| R-CAT | Definition | State produced | Wave defends? |
|---|---|---|---|
| **R-CAT-1** Network-retry replay (honest client) | Client retries due to network failure | R-OBSERVED if idempotent handler; R-DENIED if dedup catches; R-ACCEPTED if evades | OBSERVABILITY |
| **R-CAT-2** Client-bug double-click | Client retries due to UI bug | Same as R-CAT-1 | OBSERVABILITY |
| **R-CAT-3** Hostile capture-and-replay | Attacker captures + reissues | R-DENIED if same correlationId; R-ACCEPTED if fresh correlationId | DETECTION (post-hoc via payloadHash) |
| **R-CAT-4** Cross-actor replay | Attacker uses stolen JWT | R-ACCEPTED (attribution falsified) | NONE |
| **R-CAT-5** Long-window replay | Honest or hostile retry past 24h | R-ACCEPTED (window cliff) | NONE |
| **R-CAT-6** Fingerprint substitution | Attacker uses captured body + fresh correlationId | R-ACCEPTED | NONE — payloadHash clustering detects post-hoc |

---

## 4. R-CAT-to-state mapping (the reverse lookup)

For each R-CAT category, the runtime state(s) most likely to result:

| R-CAT | R-OBSERVED | R-DENIED | R-ACCEPTED | R-COLLAPSED | R-AMBIGUOUS |
|---|---|---|---|---|---|
| R-CAT-1 | possible (if idempotent handler) | LIKELY (if same correlationId within 24h) | possible (TOCTOU) | possible (post-MIG-A) | possible (TOCTOU) |
| R-CAT-2 | possible | LIKELY | possible | possible | possible |
| R-CAT-3 | unlikely | possible (if attacker reuses correlationId) | LIKELY (if attacker uses fresh correlationId) | unlikely | possible |
| R-CAT-4 | n/a | n/a | LIKELY (no defense) | n/a | n/a |
| R-CAT-5 | n/a | LIKELY (within 24h); LIKELY R-ACCEPTED past 24h | LIKELY (past window) | n/a | n/a |
| R-CAT-6 | n/a | n/a | LIKELY | n/a | possible (payloadHash cluster reveals) |

**Track B finding RT-MAP-1:** R-CAT-1 + R-CAT-2 are the OBSERVABLE-AND-DENIABLE replay categories. R-CAT-3 + R-CAT-6 are FORENSIC-DETECTABLE only post-hoc. R-CAT-4 + R-CAT-5 are UNDEFENDED.

---

## 5. Replay observability semantics

The platform offers **replay observability** but NOT **replay prevention**. The semantics map:

| Property | Substrate | Lexicon-aligned wording |
|---|---|---|
| Observability of R-CAT-1 / R-CAT-2 retries | correlationId-stamped audit rows (Lock v2) | "replay observability via correlationId clustering" |
| Best-effort dedup of R-CAT-1 / R-CAT-2 | application-layer query before insert | "best-effort idempotency check (TOCTOU race exists)" |
| Forensic detection of R-CAT-3 / R-CAT-6 | payloadHash clustering (post-ML-Rec-1) | "capture-replay forensic detection via payloadHash" |
| Prevention of R-CAT-1 / R-CAT-2 | DB UNIQUE on `(actor, correlationId)` | DEFERRED to W2-PR2B-MIG-A |
| Prevention of R-CAT-3 / R-CAT-4 / R-CAT-5 / R-CAT-6 | server-minted nonce / mTLS-bound JWT / proof-of-possession | NOT in any wave's roadmap |

**Forbidden phrases per `TRUST_GUARANTEE_LEXICON.md` §1.3:** "replay protected" / "replay-resistant" / "replay-secure" / "replay-prevented." Use only the lexicon-aligned phrases above.

---

## 6. Ambiguity disambiguation matrix

For each ambiguity scenario, the disambiguation query (and its limitation):

### 6.1 AMB-1 — Permitted row + denied `<base>.duplicate_request` row for same `(actor, correlationId)`

```sql
-- Was this honest retry caught? Or capture-replay reusing correlationId?
SELECT * FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND metadata->>'correlationId' = $cid
ORDER BY created_at;
```

**Disambiguation:** check `metadata.payloadHash` of permitted vs denied rows. Same hash → likely honest retry. Different hash → capture-modify-replay scenario.

### 6.2 AMB-2 — Two permitted rows for same `(actor, correlationId)`

```sql
SELECT *, EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) AS gap_seconds
FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND metadata->>'correlationId' = $cid;
```

**Disambiguation:** small gap_seconds → TOCTOU race (most likely). Large gap → past-window replay OR backfill artifact.

### 6.3 AMB-3 — `IDEMPOTENT_REPLAY` event but no `<base>.duplicate_request` denial

**Disambiguation:** the operation was processed by an idempotent handler that pre-dates Lock v2's correlationId gate. The `<base>.duplicate_request` is NOT expected for this code path.

### 6.4 AMB-4 — `<base>.already_accepted` denial (existing `accept` 409) for `accept` retry

**Disambiguation:** existing duplicate-check fired (per-actor `(employerId, clinicianNpi, status='ACCEPTED')` query). The `<base>.duplicate_request` would ALSO fire if Lock v2's correlationId matched. Two different reason suffixes for similar concept.

### 6.5 AMB-5 — `CONCURRENCY_GUARD_TRIGGERED` for an operation NOT in employer-review path

**Disambiguation:** different code path's concurrency mechanism. The wave's handlers do NOT (today) trigger CONCURRENCY_GUARD_TRIGGERED — the canonical event is for paths where DB UNIQUE / advisory locks exist.

---

## 7. Operational queries by replay state

### 7.1 "All replay-observed events for clinician X"

```sql
SELECT * FROM audit_events
WHERE clinician_id = $npi
  AND type = 'IDEMPOTENT_REPLAY';
```

### 7.2 "All replay-denied events for actor X in the last hour"

```sql
SELECT * FROM audit_events
WHERE metadata->>'actorId' = $userId
  AND metadata->>'outcome' = 'denied'
  AND (
    metadata->>'action' LIKE '%duplicate_request'
    OR metadata->>'action' LIKE '%already_accepted'
  )
  AND created_at > now() - interval '1 hour';
```

### 7.3 "All possible R-ACCEPTED replays for actor X (forensic detection)"

```sql
-- Requires payloadHash on every row (post-ML-Rec-1)
SELECT actor_id, payload_hash, COUNT(*), MIN(created_at), MAX(created_at)
FROM (
  SELECT
    metadata->>'actorId' AS actor_id,
    metadata->>'payloadHash' AS payload_hash,
    created_at
  FROM audit_events
  WHERE metadata->>'actorId' = $userId
    AND metadata->>'outcome' = 'permitted'
    AND created_at > now() - interval '7 days'
) sub
GROUP BY actor_id, payload_hash
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

### 7.4 "All replay-collapsed events"

```sql
SELECT * FROM audit_events
WHERE type = 'CONCURRENCY_GUARD_TRIGGERED'
  AND created_at > now() - interval '1 day';
```

### 7.5 "Replay rate metrics for dashboard"

```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE metadata->>'action' LIKE '%duplicate_request') AS r_denied,
  COUNT(*) FILTER (WHERE type = 'IDEMPOTENT_REPLAY') AS r_observed,
  COUNT(*) FILTER (WHERE type = 'CONCURRENCY_GUARD_TRIGGERED') AS r_collapsed
FROM audit_events
WHERE created_at > now() - interval '7 days'
GROUP BY hour
ORDER BY hour;
```

---

## 8. Per-state lexicon-aligned wording

| State | Lexicon-aligned wording |
|---|---|
| R-OBSERVED | "Idempotent-replay event recorded; operation processed once and replay acknowledged with the original outcome" |
| R-DENIED | "Best-effort idempotency-check denied audit; correlationId match within 24h window OR existing-acceptance match" |
| R-ACCEPTED | "Operation processed; replay-detection requires forensic payloadHash clustering" |
| R-COLLAPSED | "Concurrency-guard event recorded; concurrency mechanism prevented duplicate state" |
| R-AMBIGUOUS | "Replay state ambiguous; disambiguation queries required (see replay-taxonomy-map §6)" |

---

## 9. R-CAT defense status (the operator's truth)

For each R-CAT, the answer to "does the platform defend against this?":

| R-CAT | Defense status | Wording |
|---|---|---|
| R-CAT-1 (Network-retry) | **OBSERVABILITY + best-effort dedup** post-Lock-v2 | "Replay observability + best-effort idempotency check" |
| R-CAT-2 (Client-bug) | Same | Same |
| R-CAT-3 (Capture-replay) | **FORENSIC DETECTION** post-ML-Rec-1 | "Capture-replay forensic detection via payloadHash; prevention NOT in scope" |
| R-CAT-4 (Cross-actor / stolen JWT) | **NONE** | "Cross-actor replay defense requires JWT-stewardship + DPoP-style PoP; NOT in scope" |
| R-CAT-5 (Long-window) | **NONE — 24h cliff** | "Replays past 24h window are NOT detected; honest-client retain-correlationId-too-long is a false-negative case" |
| R-CAT-6 (Fingerprint substitution) | **DETECTION via payloadHash** | "Post-hoc forensic detection only" |

---

## 10. Lexicon enforcement

Per `TRUST_GUARANTEE_LEXICON.md` §1.3, these phrases are FORBIDDEN unless server-minted nonce + DB UNIQUE substrate exists:

- "replay protected"
- "replay-resistant"
- "replay-secure"
- "replay-prevented"
- "replay-immune"
- "guaranteed dedup"
- "atomic idempotency" (for any handler that doesn't have DB UNIQUE)

ALLOWED phrases:

- "replay observability"
- "best-effort idempotency check"
- "correlationId-deduplicated within 24h"
- "DB-enforced replay prevention deferred to W2-PR2B-MIG-A"
- "capture-replay forensic detection"
- "[R-state] event recorded" (per §8 above)

---

## 11. Update protocol

Replay taxonomy is amended when:

- A new replay-related event type is added (canonical or free-form).
- A new replay state is identified.
- A new R-CAT category is added (governance-doc framework).
- DB UNIQUE constraints land (W2-PR2B-MIG-A) — converts R-DENIED from BEST-EFFORT to PREVENTION.
- Server-minted nonce mechanism lands — converts R-CAT-3 defense from DETECTION to PREVENTION.

Updates require founder approval per `TRUST_GUARANTEE_LEXICON.md` §6 + Codex SAFE audit confirming the new mapping doesn't break existing forensic queries.

---

## 12. Closing principle (replay taxonomy)

Replay taxonomy convergence is the discipline of speaking precisely about which replay state a runtime event represents. The platform has 5 distinct states (R-OBSERVED, R-DENIED, R-ACCEPTED, R-COLLAPSED, R-AMBIGUOUS), 3 detection primitives (`IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED`, Lock v2's `<base>.duplicate_request`), and 6 governance categories (R-CAT-1..R-CAT-6).

**No state, primitive, or category implies "replay protection."** The lexicon enforces that. This map enforces that operators query the right primitive for the right state, and that defenses are described accurately per R-CAT category.

**The platform is replay-OBSERVABLE post-Lock-v2 + ML-Rec-1; replay-DENIABLE on a best-effort basis; replay-PREVENTED never (today; deferred to MIG-A for R-CAT-1/2; never for R-CAT-3/4/5/6 in current scope).**
