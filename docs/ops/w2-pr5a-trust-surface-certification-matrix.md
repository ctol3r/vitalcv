# W2-PR5A — Trust Surface Certification Matrix (Track E)

**Wave:** Wave 2, PR 5A — runtime legitimacy certification, trust-surface matrix · **Date:** 2026-05-08 · **Status:** certification matrix only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** runtime trust certifier · **Authority:** subordinate to all prior tracks (A, B, C, D); subordinate to `TRUST_GUARANTEE_LEXICON.md`

This doc consolidates per-trust-surface certification across the 5 dimensions named in the wave brief: **runtime legitimacy, replay semantics, audit semantics, provenance semantics, explainability quality.**

Each surface is assigned one of:

- 🟢 **CERTIFIED** — substrate exists; lexicon-aligned wording available; testable
- 🟡 **PARTIAL** — substrate partial OR substrate exists but Lock v2 implementation not yet merged
- 🟠 **UNVERIFIED** — substrate or implementation not inspectable in this conversation
- 🔴 **UNSAFE** — substrate absent AND wording risk requires explicit forbidden-list discipline

---

## 1. Surfaces inventoried

The certification covers 12 trust surfaces. They divide into:

- **Mutating handlers (6):** `accept`, `confirm-start`, `request-refresh`, `route-to-review`, `share-packet`, `view`
- **Audit-emitting reads (1):** `packet`
- **Pure reads (3):** `status`, `acceptance-history`, `refresh-requests` (sibling NPI-keyed)
- **Authorization layer (1):** middleware (W2-PR1A)
- **Audit infrastructure (1):** `auditService.ts` (T0/T1/T2 tiered write)

---

## 2. The certification matrix

| # | Surface | Runtime legitimacy | Replay semantics | Audit semantics | Provenance semantics | Explainability quality | **Aggregate** |
|---|---|---|---|---|---|---|---|
| **S1** | `accept` (POST mutating) | 🟡 PARTIAL — actor-scoped; role-gate post-Lock-v2 | 🟡 PARTIAL — TOCTOU on duplicate-check; correlationId post-Lock-v2 | 🟢 CERTIFIED — C-1 transactional L1+L2; denied-path post-v2 | 🟡 PARTIAL — actor + per-actor scope; trust snapshot at decision time | 🟢 STRONG — atomic-coupling pattern is well-documented | 🟡 **PARTIAL** |
| **S2** | `confirm-start` (POST mutating) | 🟡 PARTIAL — actor-scoped acceptance lookup | 🟠 UNVERIFIED → 🟡 PARTIAL — fallback-to-most-recent race during 1-release deprecation window | 🟢 CERTIFIED — C-1 transactional | 🟡 PARTIAL — references prior acceptance | 🟢 STRONG | 🟡 **PARTIAL** |
| **S3** | `request-refresh` (POST mutating) | 🟡 PARTIAL — audit-only persistence | 🟡 PARTIAL — correlationId post-v2; bloat from retry | 🟢 CERTIFIED — C-1 transactional | 🟡 PARTIAL — actor + clinicianNpi | 🟢 STRONG | 🟡 **PARTIAL** |
| **S4** | `route-to-review` (POST mutating) | 🟡 PARTIAL — HITL silent-degrade caveat | 🟡 PARTIAL | 🟢 CERTIFIED — C-1 transactional + Sentry breadcrumb (Lock v2 §6) | 🟡 PARTIAL — `reviewItemCreated: false` audit signal | 🟢 STRONG | 🟡 **PARTIAL** |
| **S5** | `share-packet` (POST mutating; audit-only persistence) | 🟠 UNVERIFIED — NPI body-match check; no resource-ownership compare | 🟡 PARTIAL — correlationId post-v2; old tokens valid until expiry | 🟡 PARTIAL — C-2 cosmetic-tx wrap; audit IS persistence | 🟠 UNVERIFIED — token entropy not inspected by review | 🟡 PARTIAL — token TTL surfaced; entropy not surfaced | 🟠 **UNVERIFIED → PARTIAL** |
| **S6** | `view` (POST telemetry; pilotKpi.ts) | 🔴 UNSAFE — explicitly anonymous; no audit row written | n/a — telemetry only | 🔴 UNSAFE — NO audit row | 🔴 UNSAFE — no enforcement | 🟢 STRONG — explicitly anonymous-by-design | 🔴 **UNSAFE BY DESIGN** (intentional; flagged as out-of-scope per Lock v2 §4) |
| **S7** | `packet` (GET; audit-emitting) | 🟠 UNVERIFIED — no resource-ownership compare; web Clerk only | 🟡 PARTIAL — correlationId on audit (post-v2) | 🟡 PARTIAL — C-2 cosmetic; audit IS export receipt | 🟡 PARTIAL — manifest hashed; export bytes leave perimeter | 🟢 STRONG — `manifestHash` recorded | 🟡 **PARTIAL** |
| **S8** | `status` (GET; telemetry-emitting) | 🟢 CERTIFIED — actor-scoped read | n/a — read | 🟠 UNVERIFIED — no audit on read (deferred) | 🟢 CERTIFIED | 🟢 STRONG | 🟢 **CERTIFIED** |
| **S9** | `acceptance-history` (GET; anonymous) | 🔴 UNSAFE BY DESIGN — anonymous + cross-employer | n/a — read | 🔴 UNSAFE — no audit | 🔴 UNSAFE — anonymous; reveals all employers' acceptances per NPI | 🟡 PARTIAL — design intent could be more explicit in dossier UX | 🔴 **UNSAFE BY DESIGN** (Lock v2 OPTIONAL reclassification) |
| **S10** | `refresh-requests` (GET, NPI-keyed; anonymous) | 🟠 UNVERIFIED → 🔴 UNSAFE BY DESIGN — NPI is public per code comment | n/a — read | 🔴 UNSAFE — no audit | 🔴 UNSAFE — anonymous count exposed | 🟢 STRONG — explicitly intentional per code comment | 🔴 **UNSAFE BY DESIGN** (intentional; out of W2-PR2B/Lock v2 scope) |
| **S11** | Middleware (W2-PR1A) — authorization layer | 🟢 CERTIFIED — degraded-auth fail-closed verified by 50-case test suite | n/a | n/a | 🟢 CERTIFIED | 🟢 STRONG — `extractVerifierClaims` runtime validation | 🟢 **CERTIFIED** |
| **S12** | `auditService.ts` — tiered audit-write infrastructure (T0/T1/T2) | 🟢 CERTIFIED — `requireAuditBeforeResponse` (T1) + `prisma.$transaction` (T2) | n/a | 🟢 CERTIFIED — L1+L2; documented canonical-event path | 🟢 CERTIFIED — `hash` column populated; canonical-form input | 🟢 STRONG — file-header docs the contract | 🟢 **CERTIFIED** |

---

## 3. Aggregate distribution

| Status | Count | Surfaces |
|---|---|---|
| 🟢 **CERTIFIED** | 3 | S8 status, S11 middleware, S12 audit infrastructure |
| 🟡 **PARTIAL** | 5 | S1 accept, S2 confirm-start, S3 request-refresh, S4 route-to-review, S7 packet |
| 🟠 **UNVERIFIED → PARTIAL** | 1 | S5 share-packet |
| 🔴 **UNSAFE BY DESIGN** | 3 | S6 view, S9 acceptance-history, S10 refresh-requests |
| **TOTAL** | **12** | |

The 3 UNSAFE-BY-DESIGN surfaces are intentionally so:

- **S6 view:** anonymous telemetry; out of W2-PR2B/Lock v2 scope; reclassification is a separate wave with deprecation window.
- **S9 acceptance-history:** intentionally cross-employer anonymous read for clinician portability claims.
- **S10 refresh-requests:** intentionally anonymous per code comment ("NPI is already public").

These are NOT failures of the wave — they are design choices the wave leaves untouched. Reviewer should ensure no surface (UI, marketing, dossier) implies they have authorization.

---

## 4. Per-dimension aggregate

### 4.1 Runtime legitimacy

| Status | Count |
|---|---|
| 🟢 CERTIFIED | 3 (S8, S11, S12) |
| 🟡 PARTIAL | 4 (S1, S2, S3, S4) |
| 🟠 UNVERIFIED | 2 (S5, S7) |
| 🔴 UNSAFE BY DESIGN | 3 (S6, S9, S10) |

The PARTIAL handlers are at PARTIAL because per-org tenancy is deferred. They become CERTIFIED post-MIG-C.

### 4.2 Replay semantics

| Status | Count |
|---|---|
| 🟢 CERTIFIED | 0 |
| 🟡 PARTIAL | 5 (S1–S5, S7) | (post-Lock-v2)
| 🟠 UNVERIFIED | 1 (S5 share-packet has the strongest replay risk surface) |
| 🔴 UNSAFE | 0 |
| n/a (reads) | 5 (S6, S8, S9, S10, S11) |

Replay reaches PARTIAL post-Lock-v2 across all mutating handlers. CERTIFIED requires DB-enforced anchors (deferred to MIG-A).

### 4.3 Audit semantics

| Status | Count |
|---|---|
| 🟢 CERTIFIED | 5 (S1–S4 + S12) | (post-Lock-v2; 4 C-1 transactional handlers + audit infrastructure)
| 🟡 PARTIAL | 2 (S5, S7) | (C-2 cosmetic)
| 🟠 UNVERIFIED | 1 (S8 — no audit on read deferred) |
| 🔴 UNSAFE BY DESIGN | 3 (S6, S9, S10) — no audit |
| n/a (S11 not an audit-emitting surface) | 1 |

Audit is the wave's strongest dimension. 4 of 6 mutating handlers reach CERTIFIED.

### 4.4 Provenance semantics

| Status | Count |
|---|---|
| 🟢 CERTIFIED | 3 (S8, S11, S12) |
| 🟡 PARTIAL | 5 (S1–S4, S7) — actor + audit metadata; per-org deferred |
| 🟠 UNVERIFIED | 1 (S5 — token entropy not inspected) |
| 🔴 UNSAFE BY DESIGN | 3 (S6, S9, S10) |

### 4.5 Explainability quality

| Status | Count |
|---|---|
| 🟢 STRONG | 9 (S1–S4, S6, S8, S10, S11, S12) |
| 🟡 PARTIAL | 2 (S5, S7) |
| 🟠 UNVERIFIED | 0 |
| 🔴 WEAK | 1 (S9 acceptance-history — design intent could be more explicit in surfaces consuming it) |

Explainability is the wave's second-strongest dimension. Atomic-coupling, fail-closed, anonymous-by-design are well-documented in code comments + doctrine docs.

---

## 5. Surface-level adversarial findings

### 5.1 SF-1 — share-packet's NPI-match check is the only resource-ownership signal

`share-packet` (line 677) checks "body NPI matches resolved subject NPI" but does NOT check that the actor owns the entityId. An actor with a leaked entityId UUID can issue a share token for a clinician they have no authority over.

**Disposition:** UNVERIFIED today; PARTIAL post-Lock-v2 (Lock v2 adds role-gate but not ownership compare). Full closure deferred to MIG-C.

### 5.2 SF-2 — `view` recording untrusted reviewerClerkId

`view` records `metadata.reviewerClerkId` from `req.headers['x-clerk-user-id']` (line 174 of pilotKpi.ts) — but `view` does NOT call `requireClerkUserId`, so the header is OPTIONAL and UNTRUSTED. The advisory event metadata records whatever the client sent.

**Disposition:** UNSAFE for any forensic claim about who viewed; the field MUST be labeled "untrusted client claim" in any consumer.

### 5.3 SF-3 — acceptance-history anonymous cross-employer read

`acceptance-history` returns ALL acceptances for a subject NPI across all employers. This is by design (clinician portability claim — "carry your packet forward"), but a UI surface that labels it as "your team's acceptance history" would fundamentally misrepresent.

**Disposition:** UNSAFE BY DESIGN — must NOT be relabeled as authorization-protected without re-architecture.

### 5.4 SF-4 — refresh-requests count exposed anonymously

NPI-keyed GET returns count of recent refresh requests across all employers. Per code comment "NPI is already public; the response contains no PII beyond count."

**Disposition:** UNSAFE BY DESIGN — the design tradeoff is documented; UI surfaces consuming it must label cross-employer aggregation explicitly.

### 5.5 SF-5 — `view` is anonymous and writes no audit

A POST mutation that anonymously fires telemetry without an audit row is a unique posture in the surface. Any UI that classifies "view" as an audit-coupled action would be wrong.

**Disposition:** UNSAFE BY DESIGN — out of Lock v2 scope; future reclassification wave required for tightening.

### 5.6 SF-6 — middleware fail-closed is the strongest single guarantee

W2-PR1A's `/api/verifier/**` namespace protection is the most defensible runtime guarantee in the entire surface. 50-case test suite verifies degraded-auth fail-closed; cross-org 404; constant-time compare; runtime claim validation.

**Disposition:** CERTIFIED. Use as the gold standard for what "certifiable runtime guarantee" looks like.

---

## 6. Coverage delta — Pre-Lock-v2 vs Post-Lock-v2

| Surface | Pre-Lock-v2 aggregate | Post-Lock-v2 aggregate | Δ |
|---|---|---|---|
| S1 accept | 🟠 UNVERIFIED | 🟡 PARTIAL | improved |
| S2 confirm-start | 🟠 UNVERIFIED | 🟡 PARTIAL | improved (despite race window) |
| S3 request-refresh | 🟠 UNVERIFIED | 🟡 PARTIAL | improved |
| S4 route-to-review | 🟠 UNVERIFIED | 🟡 PARTIAL | improved (with breadcrumb) |
| S5 share-packet | 🔴 UNSAFE | 🟠 UNVERIFIED → PARTIAL | improved |
| S6 view | 🔴 UNSAFE BY DESIGN | 🔴 unchanged | (out of scope) |
| S7 packet | 🟠 UNVERIFIED | 🟡 PARTIAL | improved |
| S8 status | 🟢 CERTIFIED | 🟢 CERTIFIED | unchanged |
| S9 acceptance-history | 🔴 UNSAFE BY DESIGN | 🔴 unchanged | (deferred reclassification) |
| S10 refresh-requests | 🔴 UNSAFE BY DESIGN | 🔴 unchanged | (deferred) |
| S11 middleware | 🟢 CERTIFIED | 🟢 CERTIFIED | unchanged |
| S12 audit infrastructure | 🟢 CERTIFIED | 🟢 CERTIFIED | unchanged |

**Delta:** 6 surfaces improve from UNVERIFIED/UNSAFE → PARTIAL. 0 surfaces regress. 3 unsafe-by-design surfaces unchanged (intentional). 3 certified surfaces preserved.

---

## 7. Aggregate certification

The bundle's overall certification:

| Class | Pre-Lock-v2 count | Post-Lock-v2 count |
|---|---|---|
| 🟢 CERTIFIED | 3 | 3 |
| 🟡 PARTIAL | 0 | 5 |
| 🟠 UNVERIFIED | 6 | 1 |
| 🔴 UNSAFE BY DESIGN | 3 | 3 |

**Movement:** 6 surfaces shift from UNVERIFIED to PARTIAL. The wave delivers REAL movement on the certifiability axis.

---

## 8. Track E determination

| Question | Answer |
|---|---|
| Are 3 surfaces fully CERTIFIED today? | YES — middleware, audit infrastructure, status |
| Does Lock v2 move 6 surfaces from UNVERIFIED to PARTIAL? | YES — when implementation lands |
| Are the 3 UNSAFE-BY-DESIGN surfaces appropriately scoped (out of wave) or properly disclaimed? | YES — explicitly out of Lock v2's allowed file list |
| Are PARTIAL surfaces convertible to CERTIFIED with named follow-up waves? | YES — MIG-A (replay anchors) + MIG-C (per-org tenancy) close the gap for S1–S5, S7 |
| Does the matrix preserve lexicon-aligned wording? | YES — every status / cell uses lexicon-aligned descriptions |

**Track E classification:** **PARTIAL — CERTIFIABLE-IN-CONTRACT for the post-Lock-v2 transition; CERTIFIABLE-IN-IMPLEMENTATION pending parallel-wave diff inspection.**

---

## 9. Closing principle (Track E)

The trust-surface certification matrix is the single-glance answer to "which parts of the platform are trust-certifiable?" The wave moves 6 surfaces toward certification, preserves 3 already-certified surfaces, and leaves 3 unsafe-by-design surfaces to their intentional posture.

**The wave is certifiable when its lock + lexicon + per-handler atomicity ship together.** No single artifact is enough; the bundle is. Reviewers verify that all four (Lock v2 + lexicon + tests + Codex audit) are merged before signing.
