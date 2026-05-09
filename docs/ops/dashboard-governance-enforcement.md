# Dashboard Governance Enforcement

**Status:** **OPERATIONAL — DASHBOARD CONTRACT** · **Date established:** 2026-05-08 · **Authority:** subordinate to `trust-class-taxonomy.md`, `trust-boundary-clarification.md`, `operational-guarantee-matrix.md`, `export-query-cohesion.md`, `constitutional-enforcement-matrix.md`

This doc defines how dashboards must expose VitalCV operational governance. Goal: **operators reading any dashboard widget can immediately see the trust class, lineage type, replay durability, export durability, and forensic durability of the data being shown.** Without these labels, dashboards inflate guarantees by omission.

---

## 1. Mandatory dashboard badges

Every dashboard widget that surfaces audit-spine data MUST display these badges:

### 1.1 Trust-class badges

| Badge | Meaning | Color recommendation |
|---|---|---|
| 🟢 **C-1** | Transactional canonical (atomic mutation+audit) | Green |
| 🟢 **C-2** | Cosmetic transactional (single-row tx wrap; audit-as-persistence) | Green-yellow (qualified) |
| 🟠 **T0** | Fire-and-forget eventual (in-memory + best-effort Postgres) | Orange |
| 🔵 **R0** | Replay-instrumentation event | Blue |
| 🔴 **D0** | Denial-instrumentation event (post-Lock-v2) | Red (denial signal) |

### 1.2 Lineage-type badges

| Badge | Meaning |
|---|---|
| 🟢 **L-T** | Transactional lineage (atomic within tx) |
| 🟡 **L-E** | Eventual lineage (async commit) |
| 🔵 **L-RO** | Replay-observable lineage |
| 🟠 **L-RF** | Replay-fragile lineage (forensic detection only) |
| 🟣 **L-ED** | Export-delayed lineage (eventual SIEM consistency) |
| 🔴 **L-DF** | Denial-fragile lineage (regression-prone OR by-design absent) |

---

## 2. Per-widget badge requirements

### 2.1 Mutation-rate widget

**Data displayed:** count of permitted mutations per actor / per time bucket.

**Mandatory badges:**

```
[🟢 C-1] Atomic mutation+audit
[🟢 L-T] Transactional lineage
Source: EX-3 Postgres direct
Time window: last 7 days
```

### 2.2 Denial-rate widget

**Data displayed:** count of denied audit rows per actor / per reason.

**Mandatory badges:**

```
[🔴 D0] Denied-path emission (post-Lock-v2)
[🔴 L-DF] Denial-fragile lineage
Coverage: Step-2+ denials only; Step-1 (no auth) and Step-6 (tx rollback) NOT included
Source: EX-3 Postgres direct (REQUIRED — SIEM stream lacks T2-direct-writer denials per DL-8)
Time window: last 7 days
```

**Critical:** widget MUST surface "Step-1 silent gap" caveat — operator awareness.

### 2.3 Replay-rate widget

**Data displayed:** counts of R-OBSERVED / R-DENIED / R-COLLAPSED.

**Mandatory badges:**

```
[🔵 R0] Replay-instrumentation
[🔵 L-RO] Replay-observable
Coverage: R-OBSERVED + R-DENIED + R-COLLAPSED states; R-ACCEPTED (no marker) NOT counted
Detection: capture-replay forensic detection requires payloadHash clustering (separate query)
Replay durability: BEST-EFFORT (TOCTOU race; DB UNIQUE deferred to MIG-A)
Source: EX-3 Postgres direct
```

### 2.4 Audit-trail timeline widget (per clinician)

**Data displayed:** chronological audit rows for a clinician NPI.

**Mandatory badges:**

```
Per-event badge mapping:
- EMPLOYER_REVIEW_ACCEPTED row → [🟢 C-1] [🟢 L-T] (alias: EMPLOYER_ACCEPTANCE)
- EMPLOYER_PACKET_SHARED row   → [🟢 C-2] [🟠 L-RF] (audit IS persistence)
- ARTIFACT_EXPORTED row         → [🟢 C-2] [🟣 L-ED]
- IDEMPOTENT_REPLAY row         → [🔵 R0] [🔵 L-RO]
- <base>.duplicate_request denied row → [🔴 D0] [🔴 L-DF]
- ...
```

**Caveat:** include row "Audit-event vocabulary may show parallel literals; cross-reference `audit-event-vocabulary-map.md`."

### 2.5 Export-coverage widget

**Data displayed:** SIEM stream coverage % vs Postgres direct coverage.

**Mandatory badges:**

```
[🟣 L-ED] Export-delayed lineage
SIEM stream: PARTIAL coverage (DL-8 SIEM gap for T2-direct-writer rows)
Postgres direct: CANONICAL — full coverage
Recommended source for forensics: EX-3 Postgres direct
```

### 2.6 Per-handler integrity widget

**Data displayed:** integrity status per wave-scope handler.

**Mandatory badges:**

```
accept    → [🟢 C-1] Atomic mutation+audit (with HCA-1, HCA-3, HCA-5 caveats)
confirm-start → [🟢 C-1] (with deprecation-window race caveat)
request-refresh → [🟢 C-1]
route-to-review → [🟢 C-1] (with HITL silent-degrade caveat)
share-packet → [🟡 C-2] (with PW-3 audit-vs-delivery divergence caveat)
packet → [🟡 C-2] (same)
```

---

## 3. Dashboard-governance violations

A dashboard that violates the badge contract is itself a constitutional drift hazard:

| Violation | Hazard |
|---|---|
| Widget shows "all denials" without [🔴 D0] badge + Step-1/Step-6 caveat | Operator believes pre-auth probes audited |
| Widget shows replay rate without distinguishing R-OBSERVED / R-DENIED | Operator conflates processed-as-replay with denied-as-duplicate |
| Widget shows "real-time SIEM stream" without [🟣 L-ED] + DL-8 gap warning | Operator believes SIEM is canonical |
| Widget labels C-2 audit row as "atomic mutation+audit" | Operator believes share-packet delivery succeeded when caller may not have received URL |
| Widget uses forbidden phrasing per lexicon (e.g., "tamper-proof badge") | Inflation per `survivability-inflation-audit.md` |

---

## 4. Per-dashboard-widget approval workflow

Before a new dashboard widget ships:

1. Author declares which audit-spine data the widget reads.
2. Author identifies trust class + lineage type per `runtime-trust-class-map.md`.
3. Author drafts badge set.
4. Reviewer verifies badges per §2.
5. Codex audit (if applicable) verifies wording.
6. Widget ships with badges visible.

---

## 5. Integrity indicators per widget

Beyond trust-class + lineage badges, widgets must surface integrity status:

| Indicator | Meaning |
|---|---|
| 🟢 **CI-GREEN** | All constitutional requirements met; data is canonical |
| 🟡 **CI-DEGRADED** | Data has known gaps (e.g., DL-8 SIEM coverage); operator must understand caveat |
| 🟠 **CI-DRIFT** | Detected drift in vocabulary / classification / wording; investigation required |
| 🔴 **CI-FRAGMENTED** | Cross-source inconsistency observed (e.g., EX-1 SIEM count != EX-3 Postgres count) |
| ⚫ **CI-VIOLATION** | Constitutional violation detected (forbidden phrasing in widget; class mismatch); widget should be removed pending fix |

(Per `runtime-integrity-dashboard.md` Track D of W2-PR12A — to be defined.)

---

## 6. Dashboard-runtime mismatch detection

A dashboard's claimed coverage MUST match the runtime substrate. Mismatches:

| Mismatch | Detection |
|---|---|
| Dashboard shows "all replays" but query uses `IDEMPOTENT_REPLAY` only (misses Lock v2 denied replays) | SOC analyst variance check; Codex review of query |
| Dashboard shows count from EX-1 SIEM stream but labeled as "all events" | Compare EX-1 count to EX-3 count; alert on > 10% discrepancy |
| Dashboard shows acceptance count using single-literal query (misses aliases per audit-event-vocabulary-map.md §7) | Codex review; SOC alerting on count discrepancy vs canonical query |

---

## 7. Marketing surface vs operational dashboard discipline

The marketing surface (`vitalcv.com`) is governed by `vitalcv-public-claims-matrix.md`. Operational dashboards are governed by THIS doc.

**Cross-contamination risk:** marketing language ("cryptographically-signed snapshot", "T4 issuer-signed") leaking into operational dashboards.

**Mitigation:** dashboard widgets MUST use lexicon-aligned wording per `TRUST_GUARANTEE_LEXICON.md` §2 (substrate-allowed phrases) ONLY. Marketing-grade phrases are FORBIDDEN in operational dashboards even if they're permitted on marketing surface.

---

## 8. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **DG-Rec-1** | Adopt mandatory badges for all dashboard widgets that surface audit-spine data | HIGH |
| **DG-Rec-2** | Per-widget badge contract review at widget creation + at quarterly audit | HIGH |
| **DG-Rec-3** | CI-GREEN / CI-DEGRADED / CI-DRIFT / CI-FRAGMENTED / CI-VIOLATION integrity indicators | MEDIUM (per W2-PR12A integration) |
| **DG-Rec-4** | Dashboard-vs-runtime mismatch alerting (variance detection) | MEDIUM |
| **DG-Rec-5** | Marketing-vs-operational separation enforced via lexicon | HIGH |

---

## 9. Closing principle (dashboard governance)

Dashboards are the operator's primary view of platform truth. Without governance, dashboards inflate by OMISSION (failing to disclose caveats) more often than by COMMISSION (using forbidden phrases). The badge contract is the durable discipline — every widget self-discloses its trust class + lineage + coverage.

**Operators trust what dashboards say. Dashboards say what runtime allows. Badges enforce the alignment.**
