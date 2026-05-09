# Constitutional Drift Registry

**Status:** **GOVERNANCE — DRIFT REGISTRY** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-enforcement-matrix.md`, `semantic-drift-detection.md`, `survivability-inflation-audit.md`, `runtime-trust-class-map.md`

This doc catalogs **all current unresolved drift risks** in VitalCV's operational governance: hidden ambiguity vectors, taxonomy-fragile surfaces, replay-fragile wording, export-fragile wording, dashboard-fragile wording.

Each entry classified: 🟢 CONTROLLED / 🟡 PARTIAL / 🟠 DRIFT-PRONE / 🔴 UNCONTROLLED.

---

## 1. Aggregated drift inventory

### 1.1 Lexicon-bounded drifts (forbidden phrases)

| # | Drift | Source surface | Classification | Mitigation |
|---|---|---|---|---|
| **L-DR-1** | Lock v2 §1, §7.4 "replay resistance" wording | Lock v2 doc | 🟠 DRIFT-PRONE | Lock v2 wording fix per W2-PR2C R2 |
| **L-DR-2** | Lock v2 §6 "atomic mutation+audit" applied unqualified to share-packet/packet | Lock v2 doc | 🟠 DRIFT-PRONE | Lock v2 wording fix per W2-PR2C R10 |
| **L-DR-3** | Code comment "non-repudiable" in `apps/api/backend/src/routes/employer-action.ts:8, 79` | Sibling code file | 🟡 PARTIAL (grandfathered code; cleanup wave) | Per W2-PR4B inflation register §1.1 (MISLEADING class) |
| **L-DR-4** | Archive `apps/web/app/_archive/wave119/trust/page.tsx:134` "cryptographically secured" + "guarantee complete traceability" | Archived UI | 🟡 PARTIAL (archived; cleanup) | Per W2-PR4B (CONTEXTUALLY UNSAFE) |
| **L-DR-5** | `docs/CRED0_DOCTRINE.md:70` "Non-Repudiable:" heading | Doctrine doc | 🟡 PARTIAL (doctrine; review needed) | Per W2-PR4B |

### 1.2 Trust-class drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **TC-DR-1** | Hidden ambiguity HCA-1: pre-tx duplicate-check race in `accept` | `runtime-trust-class-map.md` §6.1 | 🟡 PARTIAL — disclosed in trust-class-map | PR-review caveat enforcement |
| **TC-DR-2** | HCA-2: `route-to-review` HITL silent-degrade | Same §6.2 | 🟡 PARTIAL — Sentry breadcrumb (Lock v2 §6 mandate; pending implementation) | Implementation mandate |
| **TC-DR-3** | HCA-3: side-effects post-tx fire-and-forget on all C-1 handlers | Same §6.3 | 🟢 CONTROLLED — disclosed; intentional design | Documentation only |
| **TC-DR-4** | HCA-4: `appendAuditEvent` in-memory volatility | Same §6.4 | 🟡 PARTIAL — disclosed | Drain-on-shutdown hook (TS-Rec-5; LOW priority) |
| **TC-DR-5** | HCA-5: `prisma.$transaction` isolation level not explicitly set (READ COMMITTED default) | Same §6.5 | 🟡 PARTIAL — disclosed | PR-review verifies isolation appropriate per use case |

### 1.3 Replay taxonomy drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **RT-DR-1** | Parallel taxonomies: `IDEMPOTENT_REPLAY` (canonical) vs `<base>.duplicate_request` (Lock v2) | `replay-taxonomy-map.md` §3.1 | 🟢 CONTROLLED — vocabulary map distinguishes; explicit anti-aliases | Lexicon enforcement |
| **RT-DR-2** | R-OBSERVED ↔ R-DENIED conflation risk (opposite outcomes) | Same | 🟢 CONTROLLED — anti-aliases in `operational-alias-layer.md` §6 | Doc + reviewer discipline |
| **RT-DR-3** | TOCTOU race on application-layer correlationId dedup | `replay-taxonomy-map.md` §2.2 | 🟠 DRIFT-PRONE — best-effort labeled but operators may infer prevention | Lexicon + dashboard badge |
| **RT-DR-4** | 24h window cliff for long-window replays (R-CAT-5) | Same §6 | 🟠 DRIFT-PRONE — undocumented for honest-client retain-correlationId-too-long | Documentation update needed |
| **RT-DR-5** | R-ACCEPTED state has NO row marker | Same | 🟡 PARTIAL — depends on payloadHash mandate (ML-Rec-1) | Implementation gate |

### 1.4 Audit-event vocabulary drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **AV-DR-1** | 3 parallel vocabularies (AUDIT_EVENT_TYPES enum, AuditCategory, free-form prisma type) | `audit-event-vocabulary-map.md` §1 | 🟡 PARTIAL — vocabulary map enumerates wave-scope | Map covers wave-scope; broader-ecosystem follow-up needed |
| **AV-DR-2** | ~140 free-form prisma type literals out of W2-PR2B scope | Same §4.3 | 🟠 DRIFT-PRONE — vocabulary classification incomplete | Follow-up vocabulary-broader-ecosystem wave |
| **AV-DR-3** | `EMPLOYER_REVIEW_ACCEPTED` (free-form) vs `EMPLOYER_ACCEPTANCE` (canonical) — alias relationship | Same §7 | 🟢 CONTROLLED — alias map declared; query templates handle | Reviewer discipline |
| **AV-DR-4** | actor/subject conflation: `clinician_id` (subject) vs `metadata.actorId` (principal) | `w2-pr7a-audit-event-convergence.md` AC-CONV-9 | 🟡 PARTIAL — disclosed in alias-layer + canonical-query-model anti-pattern P3 | Lexicon + query-model discipline |
| **AV-DR-5** | Hash content asymmetry per writer (manifestHash, shareTokenHash, attestationHash, payloadHash) | Same AC-CONV-3 | 🟠 DRIFT-PRONE — different writers hash different content; cross-row hash comparison meaningless | Documentation in audit-row-schema doc |

### 1.5 Export survivability drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **EX-DR-1** | DL-8 SIEM coverage gap (T2 writers bypass in-memory ledger) | `export-query-cohesion.md` §3 | 🟠 DRIFT-PRONE — STRUCTURAL gap; documented but operators may forget | Dashboard-governance badge + operational runbook |
| **EX-DR-2** | EX-4 scrapbook source coverage UNVERIFIED | `runtime-trust-class-map.md` LS9 | 🟠 DRIFT-PRONE — inspection deferred | LT-Rec-4 / AC-Rec-5 |
| **EX-DR-3** | Cross-store fragmentation (audit + KPI + learning have separate stores) | `export-query-cohesion.md` §5 EF-5 | 🟡 PARTIAL — disclosed | Documentation only |
| **EX-DR-4** | Audit retention SLA undocumented (gate G7) | Multiple docs | 🟠 DRIFT-PRONE — affects forensic durability across all surfaces | Formalize SLA |

### 1.6 Denial-fragile drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **DF-DR-1** | F-4 denial-emission regression risk | `w2-pr9a-replay-survivability.md` DC-4 | 🟡 PARTIAL — mitigatable via test coverage + dashboard variance alerting | Implementation discipline |
| **DF-DR-2** | Step-1 + Step-6 silent denials (BY DESIGN absent) | `w2-pr6a-denial-path-certification.md` §3 | 🟢 CONTROLLED — disclosed; intentional | Documentation only |
| **DF-DR-3** | SD-3: proxy returns 200 silently on backend errors | `w2-pr6a` SD-3 | 🟠 DRIFT-PRONE — deployment-correctness concern | Operational alerting |

### 1.7 Anchoring (L3) drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **AN-DR-1** | L3 anchoring pipeline coverage UNVERIFIED for the 6 in-scope event types | `w2-pr3b-audit-strength-review.md` AS-2 / `w2-pr5a-audit-certification.md` Track C | 🟠 DRIFT-PRONE — claims of L3 protection forbidden until verified | Gate G6 verification |
| **AN-DR-2** | `anchored: false` default; `merkleRoot: null` default | Schema | 🟢 CONTROLLED — defaults correct; lexicon forbids "anchored" claim until pipeline verified | Lexicon discipline |

### 1.8 Topology + deployment drifts

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **TO-DR-1** | T2 topology assumption: backend reachable only by web proxy | `w2-pr2b-implementation-lock-v2.md` §10 | 🟠 DRIFT-PRONE — operational invariant; not code-enforced | Deploy runbook (gate G8) |
| **TO-DR-2** | Stale-session window: JWT outlives org membership change | `AUTHORIZATION_BASELINE_V1.md` §5.1 | 🟠 DRIFT-PRONE — deferred to session-revocation wave | Future wave |
| **TO-DR-3** | Backend trusts `x-clerk-user-id` header without independent JWT verification | `w2-pr2b-runtime-mutation-audit.md` §2.2 | 🟠 DRIFT-PRONE — backend JWT verification deferred to MIG-B | Future wave |

### 1.9 Dashboard / UI drifts (UI artifacts not attached)

| # | Drift | Source | Classification | Mitigation |
|---|---|---|---|---|
| **UI-DR-1** | Dossier UI may render audit rows as "verifications" | `w2-pr2c-truth-alignment-governance.md` §10–§13 (speculative) | 🟠 UNVERIFIED → DRIFT-PRONE without artifact inspection | UI artifact attachment required |
| **UI-DR-2** | Autopilot UI may imply autonomous decision authority | Same | 🟠 UNVERIFIED → DRIFT-PRONE | Same |
| **UI-DR-3** | Confidence UI may show "T4 · Issuer-signed" without TRUST-PERSIST-1 verification | Same | 🟠 UNVERIFIED → DRIFT-PRONE | Same |
| **UI-DR-4** | Inbox UI may aggregate refresh-requests across employers without disclosure | Same | 🟠 UNVERIFIED → DRIFT-PRONE | Same |

---

## 2. Aggregate drift distribution

| Status | Count | % of total |
|---|---|---|
| 🟢 CONTROLLED | 6 | 18% |
| 🟡 PARTIAL | 11 | 33% |
| 🟠 DRIFT-PRONE | 16 | 48% |
| 🔴 UNCONTROLLED | 0 | 0% |
| **TOTAL** | **33** | |

**Headline:** 0 UNCONTROLLED drifts. The platform's governance has documented every known drift; the issue is operational follow-through.

---

## 3. Drift-prone surfaces requiring closure

The 16 DRIFT-PRONE entries cluster into 4 closure pathways:

### 3.1 Lock v2 wording fixes (L-DR-1, L-DR-2)

Document-only fix; high priority; no runtime change. Closes IP-1 + IP-3 inflations.

### 3.2 Implementation gates (RT-DR-3, RT-DR-4, RT-DR-5, AV-DR-2, AV-DR-5, EX-DR-1, EX-DR-2, EX-DR-4, DF-DR-3, AN-DR-1, TO-DR-1)

Mostly operational + documentation closure. Each maps to a specific gate from prior waves (G6, G7, G8, ML-Rec-1, etc.).

### 3.3 Future-wave deferrals (TO-DR-2, TO-DR-3)

Session-revocation + backend JWT verification waves.

### 3.4 UI artifact inspection (UI-DR-1..UI-DR-4)

Pending artifact bundle attachment per W2-PR2C R0.

---

## 4. Per-category drift summary

| Category | Total drifts | DRIFT-PRONE | Action priority |
|---|---|---|---|
| Lexicon | 5 | 1 | Lock v2 wording fix (HIGH) |
| Trust classes | 5 | 0 | Reviewer discipline |
| Replay taxonomy | 5 | 2 | Lexicon enforcement + payloadHash mandate |
| Audit-event vocabulary | 5 | 2 | Vocabulary-broader-ecosystem wave + audit-row-schema doc |
| Export survivability | 4 | 3 | Mit-2 (SIEM source change) + retention SLA |
| Denial-fragile | 3 | 1 | Operational alerting |
| Anchoring | 2 | 1 | Gate G6 verification |
| Topology | 3 | 3 | Deploy runbook + future migration waves |
| Dashboard / UI | 4 | 4 | Artifact bundle attachment |

---

## 5. Cross-wave drift dependencies

Each drift's closure depends on specific gates:

| Drift | Closing gate | Owner |
|---|---|---|
| L-DR-1, L-DR-2 | Lock v2 wording fix | Lock v2 author |
| L-DR-3, L-DR-4, L-DR-5 | Cleanup wave | Founder + cleanup-wave author |
| TC-DR-2 | Sentry breadcrumb implementation | Implementation PR |
| TC-DR-4 | Drain-on-shutdown hook | Future wave |
| RT-DR-3, RT-DR-5 | payloadHash mandate (ML-Rec-1) | Implementation PR |
| AV-DR-2 | Vocabulary-broader-ecosystem wave | Founder |
| AV-DR-5 | Audit-row-schema doc (TS-Rec-1) | Future wave |
| EX-DR-1 | Mit-2 SIEM source extension OR documented gap | Ops + future wave |
| EX-DR-2 | LT-Rec-4 / AC-Rec-5 verification | Reviewer |
| EX-DR-4 | Retention SLA formalization (G7) | Ops |
| DF-DR-1 | Test coverage + dashboard variance alerting | Implementation PR |
| DF-DR-3 | Operational alerting on SD-3 | Ops |
| AN-DR-1 | Pipeline coverage verification (G6) | Ops + audit team |
| TO-DR-1 | Deploy runbook (G8) | Ops |
| TO-DR-2 | Session-revocation wave | Future wave |
| TO-DR-3 | MIG-B backend JWT verification | Future wave |
| UI-DR-1..4 | Artifact bundle attachment | Reviewer |

---

## 6. Drift-monitoring frequency

| Drift class | Re-audit frequency | Method |
|---|---|---|
| Lexicon | Every PR | CI-grep (per W2-PR4B) |
| Trust classes | Every PR | Codex audit + reviewer playbook |
| Replay taxonomy | Every PR + quarterly | Codex audit + dashboard variance |
| Audit-event vocabulary | Every PR introducing new literal | Reviewer + vocabulary-map update |
| Export survivability | Quarterly | Ops review |
| Denial-fragile | Continuous (dashboard alerting) | Variance alerting |
| Anchoring (L3) | Per audit-pipeline change | Ops + gate G6 |
| Topology | Per deploy | Deploy runbook |
| Dashboard / UI | Per UI release | UI review + lexicon enforcement |

---

## 7. Drift-resolution playbook

When a new drift is detected:

1. Classify per §1's category.
2. Assign 🟢 / 🟡 / 🟠 / 🔴 status.
3. Identify closing gate per §5.
4. Add entry to this registry with cross-references.
5. Codex audit + founder review (if 🟠 or 🔴).
6. Track closure timeline; re-audit after gate close.

---

## 8. Closing principle (constitutional drift registry)

The registry catalogs every known drift surface — visible, documented, mitigation-mapped. Zero UNCONTROLLED drifts means the platform's governance posture is HONEST about what's drifting + WHY + WHEN it closes.

**Drift visibility is itself a governance achievement. Not invisible drift = bounded drift.** The remaining work is operational follow-through on the 16 DRIFT-PRONE closures + per-PR vigilance.
