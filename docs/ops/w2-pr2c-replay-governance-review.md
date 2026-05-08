# W2-PR2C — Replay Governance Review (Track B)

**Wave:** Wave 2, PR 2C — adversarial legitimacy governance, Track B · **Date:** 2026-05-08 · **Status:** governance review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** replay-risk reviewer / audit-semantics reviewer

This doc subjects Lock v2's replay-resistance commitments to adversarial pressure. It separates **observational** from **preventative** replay guarantees and enumerates the operator-misunderstanding risks that follow from conflating them.

The central thesis: **Lock v2's correlationId mechanism is replay observability with best-effort dedup, NOT replay prevention.** The wave's safety depends on this being said out loud; the lock's wording does not yet say it out loud.

---

## 1. Replay categories

Replay risk comes in four shapes. The wave addresses two and conflates the others.

| Category | Definition | Lock v2 stance |
|---|---|---|
| **R-CAT-1: Network-retry replay** | The same client retries because of network failure (fetch timeout, 502, etc.) | Addressed via correlationId observability |
| **R-CAT-2: Client-bug replay** | The same client retries because of a UI bug or impatient user double-click | Addressed via correlationId observability |
| **R-CAT-3: Hostile capture-and-replay** | An attacker captures a request from the wire / logs / browser DevTools and re-issues it | NOT addressed — see §4 |
| **R-CAT-4: Cross-actor replay** | An attacker captures a request from actor A and replays as actor A's identity (e.g., via stolen JWT) | NOT addressed — see §4 |

---

## 2. The correlationId mechanism (Lock v2 §3, §6, §7.4)

**Mechanism:**
- Web proxy generates a UUID if request lacks `x-correlation-id`, OR validates UUID format if present.
- Forwards as `x-correlation-id` to backend.
- Backend records `correlationId` in `audit.metadata`.
- Service function checks for prior `(actorId, correlationId)` audit row in last 24h; if found, returns 409 `duplicate_request` and writes NO new row.

**What this provides:**

- ✅ **Observability:** repeated requests cluster in audit metadata; SOC analyst can detect retry storms.
- ✅ **Best-effort dedup:** in single-threaded retry, the second request hits the duplicate-check and returns 409.
- ✅ **Idempotency hint:** clients that supply a stable `correlationId` per logical operation get safe retry semantics.

**What this does NOT provide:**

- ❌ **DB-enforced uniqueness:** there is no `UNIQUE INDEX` on `(actorId, metadata->>'correlationId')` because the lock forbids schema migration.
- ❌ **TOCTOU defense:** between the duplicate-check query and the audit insert, a concurrent retry can pass.
- ❌ **Capture-replay resistance:** an attacker who captures a complete request (body + headers) can replay it with a NEW correlationId and the duplicate-check fails to fire.
- ❌ **Cross-actor replay resistance:** an attacker with a stolen `x-clerk-user-id` (topology breach) controls the correlationId namespace.

---

## 3. Fingerprint determinism

A replay-resistant system pins a request to a deterministic fingerprint. Lock v2's fingerprint is `(actorId, correlationId)`. This is **client-supplied** for the correlationId portion. The fingerprint is therefore:

- **Deterministic** if the client supplies the same correlationId on every retry of the same logical operation.
- **Non-deterministic** if the client supplies a fresh correlationId per network attempt.
- **Attacker-controlled** if an attacker captures or forges either component.

A correct fingerprint for capture-replay defense would be:

```
fingerprint = HMAC(server_secret, actorId || canonical_payload || timestamp_window)
```

The wave does NOT introduce this. It cannot — server-side HMAC requires a secret-management story (key rotation, fail-closed on key unavailability) outside the wave's scope.

**Adversarial finding B-1:** the client-supplied correlationId is sufficient for honest-client retry observability and insufficient for capture-replay defense. Lock v2's wording should disclose this.

---

## 4. Capture-and-replay attack surface (R-CAT-3)

### 4.1 Threat model

An attacker has access to:
- A captured `POST /api/employer-review/<entityId>/<action>` request (body, headers, including `x-clerk-user-id`, `x-vitalcv-team-role`, `x-correlation-id`).

The capture is plausible from:
- Browser DevTools logs
- Proxy access logs (if `x-clerk-user-id` not stripped)
- Compromised observability pipelines

### 4.2 Attack steps

1. Attacker reaches the backend (assumes T2 topology breach: the backend is reachable beyond the proxy).
2. Attacker re-issues the captured request with a **new `x-correlation-id`**.
3. Backend sees a fresh correlationId; duplicate-check fails to fire.
4. Mutation commits with the original actor's `userId`.

### 4.3 What Lock v2 does NOT prevent

- Step 1 is mitigated by deployment topology, not code.
- Step 2's mutation succeeds because the wave's replay anchor is `(actorId, correlationId)`, NOT `(actorId, body_hash)`.
- Step 3 succeeds because there is no DB-enforced anchor and the correlationId is attacker-chosen.
- Step 4 succeeds because the audit row records the captured `actorId` — appearing to be a legitimate action by the original actor.

**Adversarial finding B-2:** the wave does NOT defend against capture-replay where the attacker is permitted to set the correlationId. The audit row that results is *attributed to the original actor* and looks legitimate. Forensics requires correlating captures by `(actorId, payloadHash)` — which the audit row contains via `metadata.payloadHash` IF the implementation populates that field correctly. The wave **must** populate `payloadHash` on every audit row, not just permitted ones; otherwise capture-replay leaves no fingerprint.

---

## 5. TOCTOU race — the in-application duplicate check

### 5.1 The race

```
Time t0: Request R1 arrives; service function reads "is there a prior (actorId, correlationId) in last 24h?" → returns NO.
Time t1: Request R2 (replay of R1) arrives; same query → returns NO (R1 hasn't committed yet).
Time t2: R1's tx commits.
Time t3: R2's tx commits.
```

**Result:** TWO mutation rows + TWO audit rows for the same logical operation.

### 5.2 Mitigations Lock v2 provides

- **None at the application layer.** The lock declines DB-level UNIQUE constraints (forbids schema migration).

### 5.3 Mitigations Lock v2 could add (and does NOT)

| Option | Why declined | Risk |
|---|---|---|
| Add `UNIQUE INDEX` on `(audit_event.actor_id, (metadata->>'correlationId'))` | Schema migration forbidden | TOCTOU race persists |
| Wrap the duplicate-check inside the same `prisma.$transaction` as the insert | Possible but doesn't help — Prisma transactions don't see uncommitted siblings unless using `SERIALIZABLE` isolation | Most Prisma deploys default to `READ COMMITTED`; the race persists |
| Switch transaction to `SERIALIZABLE` isolation | Performance / contention concern; out of scope | Deadlock risk on hot rows |
| Use Postgres advisory locks keyed by `correlationId` | New pattern; out of scope | Lock-leak risk |
| Use a separate dedicated `idempotency_keys` table with `UNIQUE (actor_id, key)` | Schema migration | TOCTOU eliminated |

**Adversarial finding B-3:** the TOCTOU window is real and unaddressed. Under retry storms (e.g., a flaky network during a high-fanout client retry-loop), duplicate mutations can occur. The wave's wording must disclose this.

---

## 6. Timestamp-window weaknesses

### 6.1 The 24h window

Lock v2 §7.4: "duplicate `(actorId, correlationId, 24h)` returns 409."

The 24-hour window means correlationIds outside the window are reusable. An attacker with patience (or a long-lived capture) can replay a request after 24 hours and the duplicate check does not fire.

### 6.2 Honest-client implication

A long-running client (mobile app left open across days, browser tab cached overnight) might retain a correlationId in its retry buffer and re-emit it after 24 hours. The 25-hour retry succeeds twice. This is a **real bug** in the honest-client path, not just an attacker concern.

### 6.3 Mitigations not provided

- Time-of-day rolling buckets (`floor(now / 24h)` as part of fingerprint) — not in lock.
- Server-side correlationId minting with TTL — not in lock; would defeat client-supplied idempotency intent.

**Adversarial finding B-4:** the 24h window is arbitrary and produces honest-client false-negatives at the 24h+1m mark. Lock v2's wording should specify why 24h was chosen, what alternative windows were considered, and what happens to long-lived clients.

---

## 7. Future replay-collapse scenarios

Scenarios where the current wave's replay observability collapses:

| Scenario | Cause | Result |
|---|---|---|
| **F-1: Audit retention shortens to <24h** | Compliance / cost decision in a future wave | Duplicate-check window shrinks; replays older than retention succeed |
| **F-2: Audit table partitioning rolls window forward** | Postgres partition swap | Cross-partition queries miss prior correlationIds |
| **F-3: Multi-region deploy with eventual-consistent audit replication** | Architectural change | A region without the prior audit row admits the replay |
| **F-4: Sharding by `actorId` for scale** | Volume concern | Sharding by `actorId` is fine; sharding by other key would split correlationId namespace |
| **F-5: Migration to a different audit store (e.g., append-only ledger)** | Non-repudiation tightening | Need to reproduce the duplicate-check semantics on the new store |
| **F-6: `share-packet` audit row deletion (token revocation)** | Future revocation feature | If audit row is the persistence record for share-token, deletion creates a window where the same shareToken can be re-issued under a fresh correlationId |
| **F-7: `correlationId` collision across actors** | UUID collision (negligibly rare but reasoning is needed) | Zero observed in practice; not a concern at UUID-v4 entropy |

**Adversarial finding B-5:** scenarios F-1, F-2, F-3, F-5, and F-6 each silently collapse the replay observability without producing a 5xx or visible regression. The wave should document these as future-wave risks, not silent assumptions.

---

## 8. Operator misunderstanding risks

A SOC analyst, on-call engineer, or CTO reads "replay resistance" in the PR description and forms beliefs about platform behavior. Adversarial enumeration of the most dangerous misunderstandings:

| Belief | Reality | Operational hazard |
|---|---|---|
| "Replays are blocked at the wire" | Best-effort application-layer check | A replay-storm produces N% duplicates before the operator notices |
| "I can't accidentally double-accept by clicking twice" | TOCTOU race exists | Two acceptance rows with different IDs; downstream consumers see ambiguity |
| "Audit rows are unique per logical operation" | Audit rows are unique per `(actorId, correlationId, 24h)` IF the duplicate-check race doesn't fire | Audit-row count != logical-operation count |
| "Replay attacks are mitigated" | Capture-replay with attacker-chosen correlationId succeeds | False sense of security in threat model |
| "If I see a 409 duplicate_request, my client is buggy" | Could also be a slow first request that is still in-flight | Operators chase the wrong bug |
| "If I don't see a 409, my retry was the first one" | TOCTOU could have allowed both | Operators trust 200/201 too much |

The wave's wording must defuse these beliefs explicitly.

---

## 9. Audit-row interpretation risks

The wave writes audit rows with `metadata.correlationId`. Forensic queries against this field can mislead:

| Forensic query | What it returns | What an analyst might infer |
|---|---|---|
| `SELECT * FROM audit_events WHERE metadata->>'correlationId' = 'abc'` | All rows with that correlationId | "All retries of this logical operation" — but if correlationId is reused outside 24h or by a different actor, the result conflates |
| `COUNT(DISTINCT metadata->>'correlationId') FROM audit_events WHERE actor_id = 'X' AND timestamp > now() - 1h` | Approximate distinct logical operations | Off if any retries duplicated past the duplicate-check |
| `COUNT(*) WHERE metadata->>'outcome' = 'denied' AND metadata->>'action' LIKE '%duplicate_request'` | Number of detected duplicates | Lower bound; missed-duplicates from TOCTOU absent from this count |

**Adversarial finding B-6:** audit-row analytics on correlationId provide approximate (lower-bound) deduplication semantics. Reports that say "we processed N unique requests" must be qualified.

---

## 10. The "instrumentation theater" risk

Replay instrumentation is sometimes deployed as a *signal of seriousness* rather than a *defense*. The wave is at risk of this if:

- The PR description claims "replay-resistant" without disclaiming TOCTOU and capture-replay.
- Dashboards show "replay-prevention success rate" as a green metric without surfacing the duplicate-check miss rate.
- Audit-row labels include "replaySafe: false" (per Lock v2 §8) without explaining what that flag means.
- Marketing copy adopts "replay-resistant" language to differentiate the platform.

**Adversarial finding B-7:** Lock v2's `replaySafe: false` audit-row literal is correct and honest. But if downstream UIs, marketing, or dashboards re-interpret "replay-resistant" as a platform property, the literal becomes misleading. The wave should reserve `replaySafe: true` for an unambiguous future state where DB-enforced anchors exist.

---

## 11. Recommendations to Lock v2 (replay-language)

| # | Recommendation |
|---|---|
| **B-Rec-1** | Replace "replay resistance" wording in Lock v2 §1, §7 with "replay observability + best-effort idempotency check (correlationId-based; DB UNIQUE deferred)" |
| **B-Rec-2** | Document the TOCTOU race explicitly as a known limitation in Lock v2 §13 (rollback triggers section) |
| **B-Rec-3** | Specify in Lock v2 §8 that `metadata.payloadHash` MUST be populated on EVERY audit row (permitted + denied) so capture-replay leaves a fingerprint forensics can recover |
| **B-Rec-4** | Document the 24h window choice + the long-lived-client cliff in Lock v2 §6 (per-action contract) |
| **B-Rec-5** | Add §15 to Lock v2 enumerating the 7 future replay-collapse scenarios (F-1..F-7) so the wave's invariants are auditable across schema/topology changes |
| **B-Rec-6** | Add a note to the wave's Codex audit prompt: verify no commit message, audit-row label, or dashboard copy uses "replay-resistant" without qualification |
| **B-Rec-7** | Enforce in §7.4 of the test plan that duplicate `(actorId, correlationId)` test runs in single-threaded mode AND the test description says "best-effort, not concurrent-safe" |

---

## 12. Closing principle (Track B)

Replay governance is the discipline of describing what your instrumentation actually does. The wave's correlationId mechanism is useful for honest-client retry observability and forensic clustering. It is NOT capture-replay defense and NOT TOCTOU-safe.

**The wave is safe IF its replay claims are scoped to "observability + best-effort dedup" — and dangerous if it inherits the unqualified "replay-resistant" framing.** Reviewer's job is to enforce the qualification at every surface where the term appears.
