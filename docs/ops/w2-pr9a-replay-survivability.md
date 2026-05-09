# W2-PR9A — Replay Survivability (Track C)

**Wave:** Wave 2, PR 9A — operational failure survivability certification, replay-survivability track · **Date:** 2026-05-08 · **Status:** survivability analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` §1.3, `replay-taxonomy-map.md`, `w2-pr3b-replay-governance.md`, `w2-pr5a-replay-certification.md`

This doc determines whether replay semantics remain **observable, attributable, queryable, and explainable** under degraded conditions: retries, async lag, duplicate submission storms, and degraded denial visibility.

The central rule (per non-negotiable rule #1): **"replay visibility" is NOT "replay prevention" is NOT "replay collapse."** Each is a distinct semantic; each survives degradation differently.

---

## 1. Replay survivability axes

A replay event must survive across:

| Axis | Property |
|---|---|
| **OBSERVABILITY** | Can the replay be detected / classified post-event? |
| **ATTRIBUTABILITY** | Can the replay be tied to a specific actor + payload? |
| **QUERYABILITY** | Can SOC analysts find it via canonical queries? |
| **EXPLAINABILITY** | Can operators distinguish R-OBSERVED / R-DENIED / R-ACCEPTED / R-COLLAPSED / R-AMBIGUOUS without ambiguity? |

Each axis degrades differently under specific conditions.

---

## 2. The 5 degraded conditions

| Condition | Description |
|---|---|
| **DC-1: Retry storm** | Client retries N times due to network condition |
| **DC-2: Async lag** | Side-effect or worker queue lags; downstream artifacts delayed |
| **DC-3: Duplicate submission storm** | Multiple attempts (honest or malicious) flood the dedup gate |
| **DC-4: Degraded denial visibility** | Lock v2's denied-path emission missing on some paths (regression) |
| **DC-5: Process restart during in-flight retry** | Server-side state lost mid-handling |

---

## 3. Per-condition × per-axis matrix

### 3.1 DC-1 — Retry storm (single client retrying)

| Axis | Status | Reason |
|---|---|---|
| Observability | 🟢 RESILIENT post-Lock-v2 | correlationId-stamped audit rows; each attempt audit-emits |
| Attributability | 🟢 RESILIENT | actorId stamped on every row |
| Queryability | 🟢 RESILIENT | Q-CANON-3 + Q-CANON-7 templates |
| Explainability | 🟡 PARTIAL | If client uses same correlationId: R-DENIED on retries 2..N; if fresh per attempt: R-ACCEPTED on all (capture-replay-equivalent) |

**Aggregate (DC-1):** 🟡 **PARTIAL — observability + attribution + queryability strong; explainability depends on client correlationId discipline.**

### 3.2 DC-2 — Async lag (side-effect / worker delays)

| Axis | Status | Reason |
|---|---|---|
| Observability | 🟢 RESILIENT (audit row commits sync) | Audit doesn't depend on async completion |
| Attributability | 🟢 RESILIENT | Same |
| Queryability | 🟢 RESILIENT | Same |
| Explainability | 🟠 FRAGMENTED | "Did this side effect actually fire?" is invisible to audit; audit row says "permitted" but downstream may be incomplete |

**Aggregate (DC-2):** 🟡 **PARTIAL — audit invariants preserved; downstream side-effect explainability NOT covered by audit.**

### 3.3 DC-3 — Duplicate submission storm

| Axis | Status | Reason |
|---|---|---|
| Observability | 🟡 PARTIAL | Each attempt audit-emits; dedup catches some; TOCTOU lets some through |
| Attributability | 🟢 RESILIENT | actorId on every row |
| Queryability | 🟢 RESILIENT | Q-CANON-7 per-actor mutation rate; cluster by correlationId |
| Explainability | 🟠 FRAGMENTED | TOCTOU race produces 2 permitted rows for same correlationId; SOC can't easily distinguish "race" from "intended replay-as-new" |

**Aggregate (DC-3):** 🟠 **FRAGMENTED — dedup is best-effort; TOCTOU race opacity; capture-replay-equivalent for fresh-correlationId attacks.**

### 3.4 DC-4 — Degraded denial visibility

If Lock v2's denied-path emission regresses (a future code change accidentally drops the denied-row write):

| Axis | Status | Reason |
|---|---|---|
| Observability | 🔴 COLLAPSED | Denied attempts silently disappear from audit |
| Attributability | 🔴 COLLAPSED | No row to attribute |
| Queryability | 🔴 COLLAPSED | Denied-row queries return zero |
| Explainability | 🔴 COLLAPSED | "Why is denial rate suddenly zero?" — operator confusion |

**Aggregate (DC-4):** 🔴 **COLLAPSED if regression hits — strong signal of regression IF baseline denial rate is monitored.**

**Mitigation:** dashboard alerting on denial-rate variance (drop > 50% relative to baseline); test coverage in implementation PR for every denied-path emission.

### 3.5 DC-5 — Process restart during in-flight retry

| Axis | Status | Reason |
|---|---|---|
| Observability | 🟡 PARTIAL | Postgres-committed rows survive; in-memory ledger entries lost (T0 path); T2 commits visible |
| Attributability | 🟡 PARTIAL | Same |
| Queryability | 🟡 PARTIAL | EX-3 Postgres direct preserves |
| Explainability | 🟠 FRAGMENTED | Mid-retry state ambiguous; client may retry past restart with same OR fresh correlationId |

**Aggregate (DC-5):** 🟡 **PARTIAL — Postgres durability covers; in-memory volatility creates window.**

---

## 4. Replay survivability under each replay state

Per `replay-taxonomy-map.md` §2, the 5 states have different survivability profiles:

| State | DC-1 retry storm | DC-2 async lag | DC-3 duplicate storm | DC-4 degraded denial | DC-5 process restart |
|---|---|---|---|---|---|
| R-OBSERVED (`IDEMPOTENT_REPLAY`) | 🟢 RESILIENT | 🟢 RESILIENT | 🟢 RESILIENT | 🟡 PARTIAL (different code path) | 🟢 RESILIENT (Postgres) |
| R-DENIED (`<base>.duplicate_request`) | 🟢 RESILIENT | 🟢 RESILIENT | 🟡 PARTIAL (TOCTOU) | 🔴 COLLAPSED if regression | 🟡 PARTIAL |
| R-ACCEPTED (no marker) | 🟠 FRAGMENTED | 🟠 FRAGMENTED | 🟠 FRAGMENTED | n/a (replay invisible by definition) | 🟡 PARTIAL |
| R-COLLAPSED (`CONCURRENCY_GUARD_TRIGGERED`) | n/a (DB UNIQUE absent today) | n/a | n/a | n/a | n/a |
| R-AMBIGUOUS | always relevant | always | always | always | always |

**Track C finding RS-1:** R-OBSERVED is the most resilient state (canonical event, Postgres-durable). R-ACCEPTED is the LEAST resilient (no marker; forensic detection only). R-DENIED is RESILIENT in normal operation but COLLAPSES under DC-4 regression.

---

## 5. Replay observability under degraded conditions

### 5.1 Observability survivability

The platform's replay observability post-Lock-v2:

```
correlationId-stamped audit row → SOC query → R-state classification
```

This survives:

- ✅ Network conditions (T2 path is Postgres-durable; tx atomic).
- ✅ Async lag (audit commits sync).
- ✅ Process restart (Postgres ACID).
- ⚠ TOCTOU race (best-effort dedup; DC-3).
- ❌ Implementation regression dropping denied-path emission (DC-4).

### 5.2 Observability completeness threshold

For observability to be MEANINGFUL, the audit row must contain:

1. `metadata.correlationId` (per Lock v2 §8 mandate).
2. `metadata.actorId` (per Lock v2 §8 mandate; canonical name).
3. `metadata.payloadHash` (per ML-Rec-1 + DC-Rec-2 mandate — REQUIRED for capture-replay forensic detection).
4. `metadata.outcome` (for permitted/denied separation).
5. `metadata.action` (for reason classification on denials).

**Track C finding RS-2:** if any of these 5 fields is missing on a row, replay observability degrades for that row. Implementation PR must verify all 5 on every audit emission.

---

## 6. Replay attribution under degraded conditions

| Degraded condition | Attribution survivability |
|---|---|
| DC-1 retry storm | Strong — actorId stamped on every audit row |
| DC-2 async lag | Strong — actorId in mutation row metadata persists |
| DC-3 duplicate storm | Strong (audit) — but PW-3 audit-vs-delivery divergence for C-2 means actor sees delivery failure while attribution persists |
| DC-4 denial regression | COLLAPSED — no row to attribute |
| DC-5 process restart | Strong (Postgres) — partial for in-memory T0 path |

**Track C finding RS-3:** attribution survives most degraded conditions IF audit row commits. The single attribution-killer is DC-4 (no row written at all).

---

## 7. Replay queryability under degraded conditions

Per `canonical-query-model.md` Q-CANON-3 (replay-state classification query):

```sql
SELECT type, metadata->>'correlationId' AS correlation_id, ...
FROM audit_events
WHERE metadata->>'actorId' = $userId AND created_at > now() - interval '1 day';
```

This query survives:

- ✅ DC-1 retry storm — finds all retry-attempt audit rows.
- ✅ DC-2 async lag — audit commits sync.
- ✅ DC-3 duplicate storm — finds all duplicates including TOCTOU survivors.
- ❌ DC-4 denial regression — finds zero denials (silent regression).
- ✅ DC-5 process restart — Postgres-durable.

**Track C finding RS-4:** queryability is RESILIENT EXCEPT under DC-4 regression. Mitigation: dashboard with denial-rate variance alerting.

---

## 8. Replay explainability under degraded conditions

Explainability is the ability for a SOC analyst to definitively classify each row's replay state.

| Row pattern | Definitive classification? |
|---|---|
| Type=`IDEMPOTENT_REPLAY` | YES — R-OBSERVED |
| Type=`CONCURRENCY_GUARD_TRIGGERED` | YES — R-COLLAPSED |
| `metadata.action LIKE '%duplicate_request'` AND `outcome='denied'` | YES — R-DENIED |
| Permitted row alone (no other rows for same actor+correlationId) | YES — R-NORMAL (not a replay) |
| Two permitted rows for same `(actor, correlationId)` | AMBIGUOUS — R-ACCEPTED via TOCTOU OR backfill artifact OR pre-Lock-v2 retry |
| Permitted + denied for same `(actor, correlationId)` | LIKELY R-DENIED on retries 2..N; ambiguity at first-arrived |
| Multiple permitted with same `(actor, payloadHash)` different correlationIds | LIKELY R-ACCEPTED capture-replay scenarios; coincidence at SHA-256 negligible |

**Track C finding RS-5:** explainability is STRONG for marker-bearing rows; AMBIGUOUS for marker-absent rows that require forensic clustering. The `replay-taxonomy-map.md` §6 disambiguation matrix is required reading for SOC.

---

## 9. The "replay collapse" scenarios

Per `w2-pr3b-replay-governance.md` §9 + `w2-pr5a-replay-certification.md` Track B §6, scenarios where replay observability silently collapses:

| Scenario | Cause | Mitigation status |
|---|---|---|
| Audit retention < 24h | Operations decision | Document retention SLA (gate G7) |
| Audit table partitioning rolls forward | DB ops | Document cross-partition queries |
| Multi-region eventual-consistent audit | Architecture change | Future-wave concern |
| Migration to ledger | Future tightening | Future-wave concern |
| Time-skew between proxy and backend | Clock drift | NTP sync invariant |
| correlationId UUID collision | UUID-v4 entropy | Negligible |
| Audit table TRUNCATE (operational error) | Operational discipline | Runbook |
| Schema rename in flight | Lock v2 transition (employerId → actorId) | Carry-both-fields window |
| **DC-4 regression** | Implementation regression dropping denied-row emission | Test coverage + dashboard variance alerting |

**Track C finding RS-6:** of 9 collapse scenarios, 7 are operational (require runbook/SLA discipline) and 2 are architectural (future-wave concerns). DC-4 is the most code-controllable; testing closes it.

---

## 10. Per-handler replay survivability

| Handler | DC-1 retry | DC-2 async lag | DC-3 duplicate storm | DC-4 denial regression | DC-5 process restart | **Aggregate** |
|---|---|---|---|---|---|---|
| `accept` | 🟢 R | 🟢 R | 🟡 P (TOCTOU) | 🔴 C if regression | 🟡 P | 🟡 **PARTIAL** |
| `confirm-start` | 🟢 R | 🟢 R | 🟡 P | 🔴 C if regression | 🟡 P | 🟡 **PARTIAL** |
| `request-refresh` | 🟢 R | 🟢 R | 🟡 P | 🔴 C if regression | 🟡 P | 🟡 **PARTIAL** |
| `route-to-review` | 🟢 R | 🟢 R | 🟡 P | 🔴 C if regression | 🟡 P | 🟡 **PARTIAL** |
| `share-packet` | 🟢 R | n/a | 🟠 F (each retry mints token) | 🔴 C if regression | 🟡 P | 🟠 **FRAGMENTED** |
| `packet` | 🟢 R | n/a | 🟡 P (audit bloat) | 🔴 C if regression | 🟡 P | 🟡 **PARTIAL** |

**Aggregate per dimension:**
- DC-1: all 🟢 RESILIENT.
- DC-2: 🟢 / n/a.
- DC-3: 🟡 PARTIAL / 🟠 FRAGMENTED for share-packet.
- DC-4: 🔴 COLLAPSED universally if regression.
- DC-5: 🟡 PARTIAL.

---

## 11. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **RS-Rec-1** | Implementation PR test suite includes "denied-row emission verified for every gated reason" cases (closes DC-4 regression risk) | HIGH |
| **RS-Rec-2** | Dashboard alerts on denial-rate variance (drop > 50% relative to 7-day baseline) | HIGH |
| **RS-Rec-3** | `metadata.payloadHash` mandate on EVERY audit row (closes R-ACCEPTED forensic-detection gap; per ML-Rec-1) | HIGH |
| **RS-Rec-4** | Document client-correlationId discipline (same correlationId per logical operation) in API docs | MEDIUM |
| **RS-Rec-5** | Document TOCTOU window in operational runbook with disambiguation queries | MEDIUM |
| **RS-Rec-6** | Avoid T0 fire-and-forget for any canonical replay event | HIGH |
| **RS-Rec-7** | Cross-region audit replication strategy (deferred future-wave concern) | LOW |

---

## 12. Track C determination

| Question | Answer |
|---|---|
| Is replay observability resilient under DC-1 retry storm? | YES — 🟢 RESILIENT |
| Is it resilient under DC-2 async lag? | YES |
| Is it resilient under DC-3 duplicate storm? | PARTIAL — 🟡 (TOCTOU; share-packet 🟠) |
| Is it resilient under DC-4 denial regression? | NO — 🔴 COLLAPSED universally if regression hits |
| Is it resilient under DC-5 process restart? | PARTIAL — 🟡 (Postgres-durable; T0 in-memory volatile) |
| Is replay attribution survivable? | STRONG except DC-4 |
| Is replay queryability survivable? | STRONG except DC-4 |
| Is replay explainability survivable? | STRONG for marker-bearing rows; AMBIGUOUS for marker-absent (R-ACCEPTED) |

**Track C classification:** 🟡 **PARTIAL — STRONG observability under most degraded conditions; FRAGMENTED for share-packet; COLLAPSE-PRONE under DC-4 (mitigated by test coverage + dashboard alerting).**

---

## 13. Closing principle (Track C)

Replay survivability is the discipline of preserving observability + attribution + queryability + explainability under degraded conditions. The platform survives DC-1, DC-2, DC-5 by design (Postgres durability + correlationId stamping). It is FRAGMENTED under DC-3 (TOCTOU race + capture-replay) and COLLAPSE-PRONE under DC-4 (implementation regression).

**Replay survives degradation IF: (a) every audit row carries the 5 required fields per RS-Rec-2 baseline, (b) DC-4 regression is detected via dashboard variance + test coverage, (c) R-ACCEPTED forensic detection is enabled via payloadHash mandate.** The wave's contribution is enumeration; the durable mitigation is RS-Rec-1 + RS-Rec-2 + RS-Rec-3.

**Replay verdict:** 🟡 **OBSERVABLE-AND-ATTRIBUTABLE; PARTIALLY EXPLAINABLE; NOT PREVENTED.** The lexicon's distinction holds: replay visibility ≠ replay prevention ≠ replay collapse — and this wave certifies that distinction operationally.
