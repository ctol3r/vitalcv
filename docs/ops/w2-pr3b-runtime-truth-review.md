# W2-PR3B — Runtime Truth Review

**Wave:** Wave 2, PR 3B — adversarial trust governance, runtime truth · **Date:** 2026-05-08 · **Status:** review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** runtime-truth reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `AUTHORIZATION_BASELINE_V1.md`, `w2-pr2b-runtime-mutation-audit.md`

This doc reviews the **runtime/UI truth divergence** risks for W2-PR3B's instrumentation work. It catalogues where the runtime delivers less than what UI surfaces (dossier, autopilot, inbox, confidence, marketing) might imply.

**Inspection scope (declared honestly):**

- ✅ Runtime worktree at `/tmp/vitalcv-w2pr2b` (cut from `9eb5cdee`).
- ✅ Doctrine docs in PR #277 (`AUTHORIZATION_BASELINE_V1.md`, `TRUST_GUARANTEE_LEXICON.md`, etc.).
- ✅ Live vitalcv.com (extracted via WebFetch for `w2-pr2c-truth-alignment-governance.md`).
- ❌ Listed JSX/HTML artifact bundle (`data-autopilot*.jsx`, `data-dossier*.jsx`, `data-inbox*.jsx`, `confidence.jsx`, `app.jsx`, `components-shared.jsx`, `VitalCV.html`, `Wave Operating Stack.html`, `PR-B Crypto Receipt Verifier Decision.html`) — **NOT actually attached** to this conversation.

The missing artifacts limit this review's UI-runtime alignment claims. This is itself a governance finding: an "adversarial trust governance" wave that cannot inspect the trust UI surfaces is, by definition, governance-incomplete on those surfaces. The review proceeds with explicit speculation flags where the artifacts would inform the answer.

---

## 1. The runtime/UI divergence axis

UI and runtime can diverge along three axes:

| Axis | Runtime says | UI says (potentially) | Damage |
|---|---|---|---|
| **Strength of guarantee** | "best-effort idempotency" | "replay-protected" | User trusts a property that doesn't hold |
| **Scope of guarantee** | "per-actor scoped" | "your organization's resources" | User believes org-isolation that doesn't exist |
| **Provenance of guarantee** | "audit row recorded" | "issuer-signed receipt" | User believes cryptographic attestation that doesn't exist |

The wave's runtime work touches strength + provenance dimensions narrowly (hardens audit coupling, adds correlationId, denies readonly). It does NOT touch scope (no org enforcement). Each axis is reviewed below.

---

## 2. Strength-of-guarantee divergence

### 2.1 Risk RT-S1 — UI implies replay protection

**UI surface (speculative — pending artifact attachment):** an autopilot or inbox view that shows "your refresh request was sent (cannot be duplicated)" or similar.

**Runtime delivers:** correlationId observability + best-effort dedup. Not replay protection.

**Damage:** user double-clicks; UI says "sent"; runtime processes both due to TOCTOU race; user sees one log entry but two side effects fired (notifications, learning captures, etc.).

**Mitigation:** UI must say either (a) "your refresh request was recorded" (strict runtime truth), or (b) "your refresh request was deduplicated within 24h via correlationId" (lexicon-aligned).

### 2.2 Risk RT-S2 — Dashboard implies atomic mutation+audit

**Surface:** a "system health" dashboard showing "0 audit-orphan mutations."

**Runtime delivers:** atomic mutation+audit holds for the four C-1 handlers. For share-packet + packet (C-2 single-row tx wrap), the audit IS the persistence record — there's no companion mutation to be orphaned. The metric is vacuously true for these branches.

**Damage:** dashboard appears to verify a property that for two of the six branches is meaningless to verify. Operators infer "we have full atomicity" when they have it for 4 of 6.

**Mitigation:** dashboard segments per-branch; shows "atomicity coverage: 4/6 transactional, 2/6 single-row tx wrap."

### 2.3 Risk RT-S3 — Confidence semantic claim

**UI surface (speculative):** a `confidence.jsx` component showing T1–T4 tier badges.

**Runtime delivers:** confidence tiers from source adapters (per `OIG MatchConfidence` work in W1.2, et al.). Tiers can flip when source state changes (e.g., a license revocation flips T4→T2).

**Damage:** if UI snapshots a tier at decision time and renders it as if static, a stale T4 badge persists after the underlying source state degraded.

**Mitigation:** UI must surface the source-time of the tier (e.g., "T4 as of <timestamp>, sources re-checked every <interval>"). The wave doesn't introduce this; an existing UI bug if present.

**Inspection deferred — JSX not attached.**

---

## 3. Scope-of-guarantee divergence

### 3.1 Risk RT-SC1 — UI implies organizational scope

**UI surface (speculative):** a "your team's accept history" view showing acceptances across the actor's org.

**Runtime delivers:** per-actor scope. `loadEmployerAcceptanceHistory` queries by clinicianNpi (cross-employer). `loadEmployerReviewStatus` queries by `(employerId, clinicianNpi)`. There is NO org-scoped read query.

**Damage:** if UI labels per-actor history as "your team's history," other org members' acceptances are missing AND the actor's removed-from-org acceptances disappear after JWT rotation.

**Mitigation:** UI must say "your acceptances" (per-actor truth). The wave does NOT change this. Future migration wave will introduce org scope.

**Inspection deferred — JSX not attached.**

### 3.2 Risk RT-SC2 — UI implies tenant isolation

**UI surface (speculative):** any text saying "secure to your organization" or similar.

**Runtime delivers:** zero org-scope enforcement on the employer-review surface today. Lock v2 explicitly defers cross-tenant 404.

**Damage:** marketing-grade implication that doesn't hold runtime-side.

**Mitigation:** UI must NOT use "tenant" or "organization-scoped" framing in this domain. The wave's PR description explicitly disclaims (per Track D §7 of W2-PR2C governance review).

**Inspection deferred — JSX not attached.**

### 3.3 Risk RT-SC3 — Inbox aggregation across employers

**UI surface (speculative):** an inbox view showing "<X> pending refresh requests" derived from the sibling NPI-keyed `refresh-requests` GET.

**Runtime delivers:** the GET is intentionally anonymous + cross-employer. The count includes refresh-requests issued by ANY employer.

**Damage:** clinician sees a count that conflates requests from multiple employers; can't distinguish "Hospital A asked me twice" from "Hospital A and Hospital B each asked once."

**Mitigation:** UI either (a) surfaces the per-employer breakdown (would require backend change — out of scope), or (b) labels the count as "across all employers." The wave does NOT touch this.

**Inspection deferred — JSX not attached.**

---

## 4. Provenance-of-guarantee divergence

### 4.1 Risk RT-P1 — UI implies issuer-signed for share-packet

**UI surface (speculative):** a share-packet flow saying "Your share is cryptographically signed."

**Runtime delivers:** share-token is a 128-bit-ish random string (per `buildShareToken`). Manifest hash is SHA-256 (tamper-evident, not signed). Issuer signing is in TRUST-PERSIST-1 (in progress).

**Damage:** user believes their share carries an issuer signature; the share is unsigned at the platform layer; the manifest's tamper-evidence is hash-based.

**Mitigation:** UI must use lexicon-aligned wording. "Your share token is unique and expires in <TTL>" is true. "Your share is cryptographically signed" is forbidden per `TRUST_GUARANTEE_LEXICON.md` §1.2.

**Inspection deferred — JSX not attached.**

### 4.2 Risk RT-P2 — Dossier implies audit = receipt

**UI surface (speculative):** a dossier showing "audit-ready receipts" with audit-row count as the metric.

**Runtime delivers:** audit rows are forensic events; receipts are W3C VC 2.0 issuer-signed credentials. Different concepts (per `w2-pr2c-truth-alignment-governance.md` D-1).

**Damage:** dossier conflates two trust artifacts. Counting audit rows as receipts inflates the receipt count (which is operationally smaller).

**Mitigation:** dossier separates "audit events recorded" (per-mutation count) from "issuer-signed receipts" (per-credential issuance count). The two never aggregate into a single number.

**Inspection deferred — JSX not attached.**

### 4.3 Risk RT-P3 — Autopilot implies decision authority

**UI surface (speculative):** an autopilot view labeled "Auto-decision: ACCEPT" with a button to confirm.

**Runtime delivers:** autopilot is (presumably) a recommender / ranking system. The actual mutation requires the `accept` POST with role admin+. Autopilot does NOT execute the mutation.

**Damage:** UI implies autopilot has authority to mutate; user is confused about who-acted (autopilot suggestion vs. their click); audit trail attributes to the user but UI suggests autonomous decision.

**Mitigation:** autopilot UI must label output as "suggestion" / "ranking" / "highlighted candidate." Mutation ownership stays with the actor's click. The wave does NOT touch this.

**Inspection deferred — JSX not attached.**

### 4.4 Risk RT-P4 — Confidence overclaims trust tier

**UI surface (speculative):** a confidence badge "T4 · Issuer-signed."

**Runtime delivers:** TRUST-PERSIST-1 (issuer signing persistence) is in progress. "T4 · Issuer-signed" is aspirational on the live marketing surface; the wave's runtime does not advance this.

**Damage:** if confidence badges are flipped to "T4" without TRUST-PERSIST-1 being live for the underlying credential, the badge inflates against runtime.

**Mitigation:** confidence badges must derive from a live source-state lookup, not from a UI-toggleable mock. The wave does NOT introduce this.

**Inspection deferred — JSX not attached.**

---

## 5. Cross-cutting findings

### 5.1 Six speculative findings cannot be confirmed without artifacts

RT-S3, RT-SC1, RT-SC2, RT-SC3, RT-P1, RT-P2, RT-P3, RT-P4 — eight of the eleven runtime/UI risks are inspection-deferred. **The artifact bundle attachment closes them or surfaces them.**

### 5.2 The wave's PR description is the closest-controlled UI surface

The wave's own PR description, audit-row labels, and dashboard copy are what the wave's reviewers DIRECTLY control. UI artifacts are outside the wave's scope. The lexicon's enforcement at PR review covers what's directly controllable; UI alignment is a separate governance concern.

### 5.3 The wave does NOT introduce new UI surfaces

Lock v2 §3 lists the allowed files. None are JSX / UI components. So the wave does not ADD UI risk; it can only INHERIT existing UI inflation. Per `w2-pr2c-truth-alignment-governance.md` §10–§13, the existing autopilot/dossier/inbox/confidence UI risks are pre-existing — flagged for separate review.

---

## 6. Stable runtime guarantees post-Lock v2 (truthful inventory)

Per `TRUST_GUARANTEE_LEXICON.md` §2 (substrate-allowed phrases), the wave can truthfully claim:

| Truthful claim | Substrate |
|---|---|
| "Source-backed credential readiness" | NPPES + OIG + CMS PECOS adapters |
| "Audit-traceable mutations" | Every C-1 + C-2 handler writes an audit row |
| "Transactional audit row for the four C-1 handlers" | `prisma.$transaction` wrap |
| "Role-gated mutations" (post-v2) | proxy + backend readonly denial |
| "correlationId-stamped audit rows" (post-v2) | Lock v2 §8 |
| "Fail-closed under degraded auth" | W2-PR1A; 50-case test suite |
| "Namespace-protected (verifier API)" | W2-PR1A |
| "Constant-time-compared org-id" | `timingSafeEqualStrings` |
| "Tiered observation (T1–T4)" | confidence-tier code path |
| "Hash-checked manifest on packet exports" | SHA-256 manifestHash |
| "Per-actor-scoped (employer-review domain)" | Today's `(employerId, clinicianNpi)` keying |

Eleven truthful guarantees. The wave preserves all eleven and extends three (role-gated, correlationId-stamped, audit-traceable on denied paths).

---

## 7. Closing principle (runtime truth)

Runtime truth review is the discipline of checking that every UI / instrumentation surface narrates exactly what the runtime delivers. The wave's runtime work is honest; its UI-surface alignment is **not verifiable in this conversation** because the JSX artifacts are not attached.

**The wave is safe on runtime truth IF its directly-controlled surfaces (PR description, audit labels, dashboards) honor the lexicon, and if the deferred UI inspection (autopilot/dossier/inbox/confidence) lands before founder approval.**

The wave is NOT unsafe on runtime truth — it makes no false claims about the runtime in any surface this review can inspect. It is **review-incomplete on UI truth** until the artifacts are attached.

**Strongest truthful guarantee:** atomic mutation+audit in `prisma.$transaction` for the four C-1 handlers (accept / request-refresh / route-to-review / confirm-start), with paired permitted-path AND denied-path audit rows after Lock v2 lands. This is the wave's most defensible runtime claim. Substrate verifiable; lexicon-aligned wording exists; testable.
