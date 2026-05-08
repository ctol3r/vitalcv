# W2-PR2C — Mutation Governance Matrix (Track E)

**Wave:** Wave 2, PR 2C — adversarial legitimacy governance, Track E · **Date:** 2026-05-08 · **Status:** governance review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** mutation-governance reviewer

This doc classifies each mutation branch on five governance dimensions and produces an aggregate governance criticality. It is the consolidated risk surface across Tracks A–D, scored per-branch.

The five dimensions:

1. **Runtime legitimacy strength** — how well the runtime enforces the authorization & validation contract.
2. **Replay sensitivity** — how exposed the branch is to retry/replay producing duplicate state.
3. **Audit reliability** — how strong audit coverage is across success and denied paths.
4. **Attribution quality** — how trustworthy the actor identity is on the persisted record.
5. **Observability completeness** — how easy is it for a SOC analyst / on-call engineer to reconstruct what happened.

Allowed scores: **LOW** / **MEDIUM** / **HIGH** / **CRITICAL** — where LOW means "well-governed, low risk" and CRITICAL means "highest risk; needs immediate attention."

Each cell is scored against the **post-Lock-v2** state (after the wave lands as planned). The "today (pre-v2)" column shows pre-wave state for delta visibility.

---

## 1. Branch inventory (recap from `w2-pr2b-mutation-branch-map.md`)

| ID | Branch | Method | Class |
|---|---|---|---|
| B1 | `accept` | POST | mutating |
| B2 | `confirm-start` | POST | mutating |
| B3 | `request-refresh` | POST | mutating (audit-only persistence) |
| B4 | `route-to-review` | POST | mutating (audit + outbox + optional HITL) |
| B5 | `share-packet` | POST | mutating (audit-only persistence; emits public-read authorization artifact) |
| B6 | `view` | POST | telemetry-only (out of W2-PR2C scope per Lock v2 §4) |
| B7 | `packet` | GET (audit-emitting) | export |
| B8 | `status` | GET (telemetry-emitting) | read |
| B9 | `acceptance-history` | GET | read (anonymous) |
| B10 | `refresh-requests` | GET | read (anonymous; sibling route) |

W2-PR2C's scope (per Lock v2 §3, §6) covers: B1, B2, B3, B4, B5, B7. B8, B9, B10 are optional/deferred. B6 is out of scope.

---

## 2. Per-branch governance scoring

### 2.1 B1 — `accept`

| Dimension | Pre-v2 | Post-v2 | Notes |
|---|---|---|---|
| Runtime legitimacy strength | MEDIUM | **MEDIUM** | Web Clerk auth + body validation present; v2 adds readonly denial; ownership comparison still deferred |
| Replay sensitivity | HIGH | **MEDIUM** | TOCTOU race on duplicate-check exists today; v2's correlationId observability reduces operational misclassification but DB-anchor still deferred |
| Audit reliability | HIGH (already in tx) | **HIGH** | C-1 transactional; v2 mandates denied-path audit (new) |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor (Clerk userId) — proxy-bounded; v2 adds payloadHash for capture-replay forensics |
| Observability completeness | MEDIUM | **HIGH** | v2 adds correlationId across all audit rows + multi-field denied-path literals |
| **Aggregate (combined)** | **HIGH** | **MEDIUM** | Wave reduces aggregate criticality by closing ⅔ of the surfaces |

### 2.2 B2 — `confirm-start`

| Dimension | Pre-v2 | Post-v2 | Notes |
|---|---|---|---|
| Runtime legitimacy strength | MEDIUM | **MEDIUM** | Per-actor scope (acceptance lookup is `(employerId, clinicianNpi)`-keyed); v2 adds readonly denial; ownership comparison deferred |
| Replay sensitivity | **CRITICAL** | **HIGH** | Fallback-to-most-recent path today produces duplicate StartAttestation rows; v2 deprecates over 1-release window — **race risk persists during the deprecation window** |
| Audit reliability | HIGH (in tx) | **HIGH** | C-1 transactional; v2 adds correlationId |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor; same as B1 |
| Observability completeness | MEDIUM | **HIGH** | v2 adds correlationId + denied-path audit |
| **Aggregate** | **CRITICAL** | **HIGH** | The deprecation window keeps replay-sensitivity high; full reduction blocked until window closes |

**Track E finding E-1:** B2's deprecation window is the single longest-lived replay risk in the wave. If the wave ships and the deprecation is silently extended past 1 release, the risk window extends with it. Reviewer should mandate that deprecation closure is a tracked launch-blocker, not a soft commitment.

### 2.3 B3 — `request-refresh`

| Dimension | Pre-v2 | Post-v2 | Notes |
|---|---|---|---|
| Runtime legitimacy strength | LOW | **MEDIUM** | Today no per-action gate; v2 adds readonly denial + correlationId idempotency |
| Replay sensitivity | HIGH (no idempotency) | **MEDIUM** | correlationId observability + best-effort dedup; audit-row bloat from retry storms still possible (TOCTOU) |
| Audit reliability | HIGH (in tx) | **HIGH** | C-1 transactional |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor |
| Observability completeness | MEDIUM | **HIGH** | v2 adds correlation + denial path |
| **Aggregate** | **HIGH** | **MEDIUM** | Substantial reduction |

### 2.4 B4 — `route-to-review`

| Dimension | Pre-v2 | Post-v2 | Notes |
|---|---|---|---|
| Runtime legitimacy strength | LOW | **MEDIUM** | Same shape as B3 |
| Replay sensitivity | HIGH | **MEDIUM** | Same; correlationId observability |
| Audit reliability | HIGH (in tx, with HITL try/catch) | **HIGH** | v2 mandates Sentry breadcrumb on HITL silent-degrade — **this MUST land** |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor; HITL items also stamped per-actor |
| Observability completeness | MEDIUM (HITL silent-degrade is auditable but not alertable) | **HIGH** | After breadcrumb lands |
| **Aggregate** | **HIGH** | **MEDIUM** | Reduction conditional on Sentry breadcrumb landing |

**Track E finding E-2:** B4's reduction depends on the Sentry breadcrumb actually being implemented. If the implementation PR ships without it, observability completeness drops to MEDIUM and aggregate stays HIGH. Reviewer should treat the breadcrumb as a hard merge gate.

### 2.5 B5 — `share-packet`

| Dimension | Pre-v2 | Post-v2 | Notes |
|---|---|---|---|
| Runtime legitimacy strength | LOW (no role gate; subject lookup only) | **MEDIUM** | v2 adds readonly denial + correlationId; ownership of `entityId` still deferred |
| Replay sensitivity | HIGH (each retry mints fresh token) | **HIGH** | correlationId is recorded in audit metadata; second mint within window blocked by best-effort dedup; **but tokens issued before dedup fires remain valid until expiry** |
| Audit reliability | MEDIUM (audit-only, not in tx) | **MEDIUM** | v2 wraps in single-row tx (cosmetic, per Track C C-2.A); rollback semantics unchanged |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor |
| Observability completeness | MEDIUM | **HIGH** | correlationId + denial path |
| **Aggregate** | **CRITICAL** | **HIGH** | Token-issuance blast radius keeps it high; only the future migration wave addresses cross-tenant share |

**Track E finding E-3:** B5's token-issuance public-read authorization remains the highest-leverage cross-tenant escape (per `w2-pr2b-runtime-mutation-audit.md` §B5). v2 closes the readonly hole and adds replay observability but does NOT add ownership compare. The CRITICAL→HIGH reduction is meaningful but not full closure.

### 2.6 B7 — `packet`

| Dimension | Pre-v2 | Post-v2 | Notes |
|---|---|---|---|
| Runtime legitimacy strength | LOW (no ownership; web Clerk only) | **MEDIUM** | v2 adds correlationId; ownership compare deferred |
| Replay sensitivity | MEDIUM (duplicate exports → audit bloat) | **MEDIUM** | correlationId observability |
| Audit reliability | MEDIUM (audit-only, not in tx) | **MEDIUM** | v2 wraps in single-row tx (cosmetic) |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor |
| Observability completeness | MEDIUM | **HIGH** | correlationId; denial path on entity-not-found |
| **Aggregate** | **CRITICAL** | **HIGH** | Highest-data-volume escape (evidence bytes); ownership deferred keeps risk |

**Track E finding E-4:** B7's evidence packet is a multi-MB artifact that crosses the perimeter on every successful export. The audit row's `payloadHash` covers the request, NOT the response. Forensics on "what bytes were actually exported" requires reconstructing the packet from the audit row's manifest hash + downstream source reads — a non-trivial reconstruction. Recommendation: store `manifestHash` AND a `packetSizeBytes` AND `packetSchemaVersion` on the audit row to enable forensic reconstruction.

### 2.7 B3/B5/B7 aggregate cross-branch concerns

The three branches that today have audit-only persistence (B3 audit + outbox; B5 audit-only; B7 audit-only) all share:

- **Audit retention = persistence ceiling.** If audit rows are deleted (compliance / cost), the persisted record disappears.
- **Cross-record consistency.** A `share-packet` audit row says "X token issued"; if a downstream `share-token/:token` GET resolution path queries a deleted audit row, the token silently expires before TTL.

**Track E finding E-5:** the wave does NOT formalize an audit-retention policy that protects these audit-as-persistence rows. Reviewer should flag this as a future-wave dependency: the audit-retention policy must respect the longest token TTL.

### 2.8 B6 — `view` (out of scope)

Out of W2-PR2C scope per Lock v2 §4. Aggregate score: **LOW** (telemetry-only). Flagged: a future wave that reclassifies `view` may need its own governance review.

### 2.9 B8 — `status` (optional in v2)

| Dimension | Pre-v2 | Post-v2 (if change lands) | Notes |
|---|---|---|---|
| Runtime legitimacy strength | LOW (Clerk only) | **MEDIUM** | If role gate added |
| Replay sensitivity | n/a (read) | n/a | No mutation |
| Audit reliability | n/a (no audit on read) | n/a | Lock v2 explicitly defers audit-on-read |
| Attribution quality | MEDIUM | **MEDIUM** | Per-actor scope on read |
| Observability completeness | LOW | **MEDIUM** | If learning telemetry retained but disclaimed |
| **Aggregate** | **MEDIUM** | **MEDIUM** | Marginal change |

### 2.10 B9 — `acceptance-history` (optional in v2)

Today: anonymous + cross-tenant by design. v2 OPTIONALLY adds Clerk auth.

| Dimension | Pre-v2 | Post-v2 (if change lands) | Notes |
|---|---|---|---|
| Runtime legitimacy strength | LOW | **MEDIUM** | If auth added |
| Replay sensitivity | n/a | n/a | Read |
| Audit reliability | n/a | n/a | No audit on read |
| Attribution quality | n/a (anonymous) | LOW | Per-actor on the lookup; cross-tenant data still returned |
| Observability completeness | LOW | **MEDIUM** | telemetry only |
| **Aggregate** | **MEDIUM** | **MEDIUM** | Reclassification is feature-shape change, not pure hardening |

### 2.11 B10 — `refresh-requests` (no change)

Out of scope per Lock v2 §6. By-design anonymous. Aggregate: **LOW**.

---

## 3. Aggregate matrix (post-Lock-v2)

Sorted by aggregate criticality:

| Branch | RTL strength | Replay sens. | Audit reliability | Attribution | Observability | **Aggregate** |
|---|---|---|---|---|---|---|
| B2 `confirm-start` | MEDIUM | **HIGH** (during deprecation window) | HIGH | MEDIUM | HIGH | **HIGH** |
| B5 `share-packet` | MEDIUM | HIGH | MEDIUM | MEDIUM | HIGH | **HIGH** |
| B7 `packet` | MEDIUM | MEDIUM | MEDIUM | MEDIUM | HIGH | **HIGH** |
| B1 `accept` | MEDIUM | MEDIUM | HIGH | MEDIUM | HIGH | **MEDIUM** |
| B3 `request-refresh` | MEDIUM | MEDIUM | HIGH | MEDIUM | HIGH | **MEDIUM** |
| B4 `route-to-review` | MEDIUM | MEDIUM | HIGH | MEDIUM | HIGH | **MEDIUM** |
| B8 `status` (optional) | MEDIUM | n/a | n/a | MEDIUM | MEDIUM | **MEDIUM** |
| B9 `acceptance-history` (optional) | MEDIUM | n/a | n/a | LOW | MEDIUM | **MEDIUM** |
| B6 `view` (oos) | LOW | LOW | LOW | LOW | LOW | **LOW** |
| B10 `refresh-requests` (oos) | LOW | n/a | n/a | n/a | LOW | **LOW** |

**Three branches remain at HIGH aggregate:**

- **B2** because of the 1-release deprecation window for fallback-to-most-recent.
- **B5** because of token-issuance public-read authorization without ownership compare.
- **B7** because of evidence-packet bytes leaving the perimeter without ownership compare.

These three are **the wave's residual risk surface**. They will fully reduce only when the future migration wave introduces ownership enforcement.

---

## 4. Cross-cutting governance findings

### 4.1 Wave reduces aggregate risk substantively

Pre-v2 mean across the 6 in-scope branches: **HIGH** to **CRITICAL** spread.
Post-v2 mean across the 6 in-scope branches: **MEDIUM** to **HIGH** spread.

The wave moves the platform from "crit/high" toward "high/med." This is real progress.

### 4.2 Three branches do not fully reduce

Per §3, B2/B5/B7 stay HIGH. The wave's contract honestly acknowledges this — Lock v2 §1 frames the wave as "Mutation Legitimacy Hardening, NOT true tenant ownership." Reviewer should ensure the rollback-trigger list in Lock v2 §12 includes:

- B2's deprecation window not closing within 1 release.
- B5's token-issuance audit-row growth above baseline (probing detection).
- B7's evidence-packet export volume above baseline.

### 4.3 The audit-coupling layer is the wave's strongest commitment

Across all 6 in-scope branches, post-v2 audit reliability is **HIGH** for the four C-1 handlers and **MEDIUM** for the two C-2 handlers (per Track C). This is the single dimension where the wave delivers the most value — not "ownership," not "replay-resistance," but **denied-path audit emission + correlationId stamping + transactional uniformity**.

### 4.4 Observability is the wave's second-strongest commitment

Five of six in-scope branches move observability from MEDIUM to HIGH. This is a real improvement in the SOC-analyst / on-call posture. **The wave's value-narrative should be "audit-coupling + observability hardening," NOT "ownership / legitimacy authorization."**

---

## 5. Track E recommendations

| # | Recommendation |
|---|---|
| **E-Rec-1** | Make the B2 deprecation-window closure a tracked launch-blocker (1-release SLA from merge) |
| **E-Rec-2** | Make the B4 Sentry breadcrumb on HITL silent-degrade a hard merge gate |
| **E-Rec-3** | For B7 (`packet`), augment audit-row metadata with `packetSizeBytes` + `packetSchemaVersion` to enable forensic reconstruction |
| **E-Rec-4** | Define an audit-retention policy that respects the longest token TTL (B5's `SHARE_TOKEN_TTL_MS`) — protect audit-as-persistence rows |
| **E-Rec-5** | Re-frame the wave's value narrative around "audit-coupling + observability hardening" — NOT "legitimacy" or "authorization" — in PR description and commit messages |
| **E-Rec-6** | Quarterly governance review: re-score this matrix against the future-migration wave's progress; verify B2/B5/B7 transition from HIGH→MEDIUM after MIG-C lands |

---

## 6. Closing principle (Track E)

The mutation governance matrix shows where the wave delivers, where it doesn't, and where it can't. Three branches stay HIGH because the runtime substrate they operate on has limits the wave does not change. Six branches move toward MEDIUM because the wave delivers real audit-coupling + observability + readonly-denial work.

**The wave's per-branch reduction is genuine. The wave's residual risk is honest. Reviewer's job is to confirm the wave does NOT silently reframe its three-HIGH residual as if they were closed.**
