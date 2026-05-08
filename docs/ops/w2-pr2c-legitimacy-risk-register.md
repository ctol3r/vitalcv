# W2-PR2C — Legitimacy Risk Register

**Wave:** Wave 2, PR 2C — adversarial legitimacy governance, consolidated risk register · **Date:** 2026-05-08 · **Status:** governance review only; **NO product code, NO runtime modification, NO merge** · **Authority:** consolidates findings from Tracks A–E

This is the consolidated risk register for the W2-PR2C adversarial review. Each row is a discrete risk with severity, source, scope, mitigation, and merge-gate disposition. Rows are sorted by severity (CRITICAL → HIGH → MEDIUM → LOW), then by track.

---

## 1. Risk register

| # | Risk | Track | Severity | Source | Mitigation required | Merge gate |
|---|---|---|---|---|---|---|
| **R0** | The listed artifact bundle (`*.html`, `*.jsx` files) was NOT actually attached to this conversation. UI-runtime alignment cannot be verified. | D / meta | **CRITICAL** | Prompt named files; conversation contains none | Reviewer obtains the artifacts BEFORE founder approval; this review is incomplete on UI semantics until then | **HARD GATE — must close** |
| **R1** | The parallel implementation diff for W2-PR2C is not visible in this conversation. The lock + scaffolding can be reviewed; the implementation cannot. | meta | **CRITICAL** | Prompt assumes parallel Codex wave is implementing | Reviewer (or Codex SAFE) inspects the diff at PR-open before merge | **HARD GATE — diff inspection required** |
| **R2** | "Replay resistance" wording in Lock v2 inflates beyond best-effort observability. TOCTOU race + capture-replay both unaddressed. | A, B | HIGH | Lock v2 §1, §7; runtime audit §2.6 | Lock-v2 wording fix + Codex audit prompt scans for "replay-resistant" language | **HARD GATE — language must qualify** |
| **R3** | "Mutation legitimacy" semantically overloaded — could be read as "platform validates legitimacy." | A | HIGH | Lock v2 §1 | Disclose in PR description: "input legitimacy + actor legitimacy + audit coupling — NOT authority over resource" | Documentation gate |
| **R4** | "Cryptographically-signed snapshot" marketing claim risks cross-contamination with W2-PR2C audit-coupling work. If wave's PR description says "signed audit," inflation lands. | D | HIGH | vitalcv.com extraction; runtime substrate | Forbidden lexicon check on PR description (per Track D §14) | **HARD GATE — Codex scans wording** |
| **R5** | "T4 · Issuer-signed" marketing claim is incrementally true (TRUST-PERSIST-1 in progress). Wave must not appear to deliver issuer-signing. | D | HIGH | vitalcv.com; memory `pr_b_crypto_decision.md` | Wave's PR description explicitly disclaims it does NOT add cryptographic signatures | Documentation gate |
| **R6** | B2 (`confirm-start`) deprecation window for fallback-to-most-recent leaves replay risk HIGH for ≥ 1 release. | B, E | HIGH | Lock v2 §6; runtime audit §2.7 | Track deprecation closure as a launch-blocker; close window with a hard cut, not soft | Launch-blocker tracking |
| **R7** | B5 (`share-packet`) does NOT add ownership compare; cross-tenant token-issuance escape persists. | E | HIGH | Lock v2 (deferred); runtime audit B5 | Document residual risk; reviewer confirms wave's wording does NOT claim cross-tenant share is closed | Documentation gate |
| **R8** | B7 (`packet`) does NOT add ownership compare; cross-tenant evidence-packet export persists. | E | HIGH | Lock v2 (deferred); runtime audit B7 | Document residual risk; future-migration wave addresses | Documentation gate |
| **R9** | Backend trusts `x-clerk-user-id` + (NEW) `x-vitalcv-team-role` headers without independent JWT verification. T2 topology breach collapses both. | A, C | HIGH | Lock v2 §10 (codifies as operational invariant) | Deploy-time gate verifies VPC/network topology before each release | Deploy-time gate |
| **R10** | Audit-coupling work for B5/B7 (single-row tx wrap) is **cosmetic** — does not provide additional rollback semantics. Wording inflates. | A, C | MEDIUM | Lock v2 §6, §8; Track C §3.2.1 | Lock-v2 wording fix: "code-uniformity contract; not additional rollback safety" | Documentation gate |
| **R11** | "Defense in depth" backend role gate consults the same proxy-derived signal as web layer; same trust-signal, different code-paths. | A | MEDIUM | Lock v2 §3, §3.4 | Wording fix: "defense-in-depth code paths; trust-signal redundancy deferred to backend JWT verification wave" | Documentation gate |
| **R12** | TOCTOU race on application-layer correlationId duplicate-check. No DB UNIQUE anchor. | B, C | MEDIUM | Lock v2 §7.4 (single-threaded test); Track B §5 | Either defer to future-migration's DB anchor (preferred) OR document race in §12 (rollback triggers) | Documentation gate |
| **R13** | 24-hour duplicate-check window is arbitrary; long-lived clients can replay correlationId after window expires. | B | MEDIUM | Lock v2 §7.4; Track B §6 | Document the window choice + the long-lived-client cliff | Documentation gate |
| **R14** | `metadata.organizationContextId` is untrusted client input but recorded in audit metadata. Forensic queries that join on it reach forged values. | C | MEDIUM | Track C §5 | Wave adds explicit audit-row label / disclaimer; forensic playbooks updated | Documentation gate |
| **R15** | Multiple attribution fields per audit row (`employerId`, `actorId`, `attribution.organizationId`, `organizationContextId`, etc.) — drift risk. | C | MEDIUM | Track C §5 | Pick one canonical "actor-id" field; deprecate redundant; enforce via audit-row-metadata schema check | Documentation gate |
| **R16** | `tenantId` always-NULL in v1 audit rows is overloaded with "row is broken." | C | MEDIUM | Track C §5.3 | Either populate with sentinel string OR add explicit code comment + audit-row schema doc | Documentation gate |
| **R17** | correlationId propagation has 5 hops; silent-drop risk at each. Tests cover Hop 4 only. | C | MEDIUM | Track C §4 | Add tests for Hops 1, 2, 3 propagation | Test-coverage gate |
| **R18** | Pre-tx side-effect reads (passport, snapshot, duplicate-check) are NOT atomic with the mutation. Audit row records pre-race state as if commit-time. | C | MEDIUM | Track C §2.2.1 | Disclose in PR description and audit-coupling doc | Documentation gate |
| **R19** | Side-effect coupling (SEAL captures, learning captures, recompute jobs) is fire-and-forget; not coupled to mutation atomicity. | C | LOW (intentional) | Side-effect inventory; Track C §6.1 | Disclose in PR description that "all-or-nothing" applies only to mutation+audit | Documentation gate |
| **R20** | B4 (`route-to-review`) HITL silent-degrade is auditable but not currently alertable. Lock v2 promises Sentry breadcrumb. | E | LOW (resolvable) | Lock v2 §6; Track E §2.4 | Sentry breadcrumb MUST land — if not, observability score drops | **HARD GATE — breadcrumb required** |
| **R21** | "Audit-ready receipts" marketing claim conflates audit rows with receipts (W3C VC 2.0 sense). Wave's audit-coupling work might be construed as advancing this. | D | LOW (wave-bounded) | vitalcv.com; CLAUDE.md doctrine | Wave's PR description explicitly disclaims | Documentation gate |
| **R22** | Pre-auth probing is invisible to audit forensics (Step-1 denials write NO audit row). | A, C | LOW | Lock v2 §8 | Disclose in PR description | Documentation gate |
| **R23** | UI artifacts (autopilot/dossier/inbox/confidence) cannot be reviewed without attachment. Speculative risks documented in Track D §10–§13. | D | (subsumed by R0) | Same as R0 | Same as R0 | Same as R0 |
| **R24** | Stable-guarantees list in `AUTHORIZATION_BASELINE_V1.md` may need re-examination after Lock v2 ships, to ensure no stable guarantee silently weakens. | A | LOW | Track A §7 | Post-merge: review baseline; bump to v2 if any change | Post-merge gate |
| **R25** | Audit-retention policy not formalized; B5/B7 use audit-as-persistence and depend on retention covering token TTL. | E | LOW | Track E §2.7 | Future-wave: define retention SLA; for now, document assumption | Documentation gate (future) |

---

## 2. Severity rollup

| Severity | Count | Closure type |
|---|---|---|
| **CRITICAL** | 2 | Hard gates (R0 artifact bundle, R1 diff inspection) |
| **HIGH** | 7 | Mostly documentation / language fixes; one launch-blocker (R6); one deploy-time gate (R9) |
| **MEDIUM** | 8 | All resolvable via documentation, additional tests, or canonicalization |
| **LOW** | 8 | Minor disclosures + one hard gate (R20) |
| **TOTAL** | **25** | |

**Of the 25 risks, 4 are hard merge gates (R0, R1, R2, R20).** The rest are addressable via Lock v2 wording fixes + Codex audit prompt extension + minor test additions.

---

## 3. Pattern observations

### 3.1 The dominant risk class is language inflation

R2, R3, R4, R5, R10, R11, R14, R16, R19, R21, R22 — eleven of 25 risks (44%) are language / documentation issues, not code or architecture defects. The wave's contract is sound; its **describing surface** is the risk axis.

This is consistent with the "instrumentation theater" risk Track 9 of the prompt asked to detect: instrumentation that exists is not necessarily a problem; instrumentation that is described as more than it is, IS a problem.

### 3.2 The hard-gate-blocking risks are inspection gaps, not code issues

R0 (artifact bundle missing) and R1 (parallel implementation diff invisible) are about what reviewers can SEE. Until both close, the review is incomplete. The wave is not unsafe BECAUSE of these risks; the wave's safety has not been ESTABLISHED because of these gaps.

### 3.3 Three branches resist full reduction (B2, B5, B7)

Per Track E §3, the same three branches that stay HIGH on the governance matrix correspond to R6, R7, R8 here. They reduce when the future-migration wave delivers ownership compare. The wave under review delivers HALF the closure.

---

## 4. Required actions before founder approval

| # | Action | Owner | Gate |
|---|---|---|---|
| **A-1** | Reviewer obtains the artifact bundle and certifies UI-runtime alignment (closes R0) | Founder / requester | HARD |
| **A-2** | Codex SAFE inspects the parallel implementation diff (closes R1) | Codex | HARD |
| **A-3** | Lock v2 wording fixes for R2, R3, R10, R11 (4 documentation gates) | Author of Lock v2 | HARD |
| **A-4** | Codex audit prompt extended to scan PR description / commit messages / audit-row literals for inflation patterns (closes R4, R5, R21) | Author of merge gate | HARD |
| **A-5** | Track B2 deprecation closure as a launch-blocker (closes R6) | Wave owner | LAUNCH-BLOCKER |
| **A-6** | Sentry breadcrumb on B4 HITL silent-degrade (closes R20) | Implementation PR | HARD |
| **A-7** | Lock v2 wording fix: residual risk disclosure for B5 + B7 (closes R7, R8) | Author of Lock v2 | HARD |
| **A-8** | Deploy-time topology audit + runbook update (closes R9) | Ops | DEPLOY-TIME |
| **A-9** | Test coverage for correlationId hops 1, 2, 3 (closes R17) | Implementation PR | TEST-GATE |
| **A-10** | Documentation gates for R12, R13, R14, R15, R16, R18, R19, R22, R24 | Lock v2 + audit-coupling doc updates | SOFT (documentation) |

**4 hard gates + 1 launch-blocker + 1 deploy-time + 1 test-gate + 9 documentation/lock-update gates.**

---

## 5. Final adversarial determinations

Per the prompt's required final outputs:

### 5.1 Highest-risk legitimacy gap

**B5 + B7 do NOT add cross-tenant ownership compare** (R7, R8). The wave is named "Mutation Legitimacy Hardening" but legitimacy in the *resource-authority* sense is precisely what is deferred for these two branches. The token-issuance + evidence-export surfaces remain cross-tenant-exposed. Lock v2 honestly acknowledges this; the risk is that downstream surfaces or PR descriptions paper over the gap with "legitimacy" wording.

### 5.2 Highest-risk replay weakness

**TOCTOU race on application-layer correlationId duplicate-check + capture-replay with attacker-chosen correlationId** (R2, R12). Lock v2's "replay resistance" wording implies a stronger property than the runtime delivers. The single recommended fix is the most leveraged: replace "replay resistance" with "replay observability + best-effort idempotency check." This costs nothing and prevents the wave's most dangerous semantic inflation.

### 5.3 Strongest runtime truth alignment

**The four C-1 transactional handlers (`accept`, `request-refresh`, `route-to-review`, `confirm-start`) maintain atomic mutation+audit in `prisma.$transaction`.** This is the wave's most defensible claim and the runtime's strongest existing property. Lock v2 preserves it correctly and adds denied-path emission to extend coverage. Per Track C §2, this is the wave's strongest commitment.

### 5.4 Strongest audit-coupling guarantee

**Atomic mutation+audit for the four C-1 handlers, with paired success-path AND denied-path audit-row emission.** Combined with the new `correlationId` field on every audit row (permitted + denied), this gives forensics a per-actor, per-action, per-attempt clustering primitive that did not previously exist. Per Track C §2.1.

### 5.5 Most dangerous semantic inflation risk

**"Cryptographically-signed snapshot" leakage from marketing surface into wave's audit-coupling description** (R4 + R5). vitalcv.com publicly claims signed snapshots; the wave's audit-coupling work could be described as "now produces signed audit-coupled records" — and that wording would be both technically wrong (no signatures) AND a step toward marketing-claim contamination. The most expensive failure mode of this wave is "we shipped audit-coupling that the marketing team described as the signed-receipt feature." Defense: the wave's PR description and audit-row labels MUST NOT use "signed" / "signature" / "issuer-signed" / "VC 2.0" wording.

### 5.6 Governance determination

**UNSAFE FOR MERGE** as currently constituted, BECAUSE:

1. **R0 (artifact bundle missing)** prevents UI-runtime alignment certification. Without it, Track D is incomplete.
2. **R1 (implementation diff invisible)** prevents implementation review. The contract (Lock v2) is reviewable; the diff is not.
3. **R2 / R10 / R11 (language inflation)** are addressable via Lock v2 wording fixes BEFORE the implementation PR opens.

**Pathway to SAFE:** close R0 (attach artifacts + reviewer certifies UI alignment) + close R1 (Codex SAFE inspects the diff at PR-open) + apply Lock v2 wording fixes per R2/R10/R11 + add R4/R5 to Codex audit prompt + commit to R6 launch-blocker tracking + R20 Sentry breadcrumb + R9 deploy-time topology audit.

When the four hard gates close + the launch-blocker is tracked + the documentation gates are merged, the wave can transition to **CONDITIONALLY SAFE** for implementation, with the parallel implementation PR's diff subject to its own SAFE audit at merge time.

**The wave is not architecturally unsafe.** It is operationally incomplete-of-review. Closing the inspection gaps and the language gaps would be sufficient to advance to SAFE.

---

## 6. Closing principle

A risk register's value is not in the count of risks; it is in the *traceability* of each risk to a closure path. Of 25 risks, 4 require hard inspection / implementation gates, 1 is a launch-blocker, 1 is a deploy-time gate, and the remaining 19 are language / documentation / test-coverage fixes that a well-disciplined wave already has muscle for.

**The wave's safety is co-extensive with the discipline of its describers and the visibility of its diff.** Both are addressable. Neither is yet established in this review.

---

## NON-NEGOTIABLE INVARIANTS — final attestation

Per the prompt's enumerated 10 invariants:

| # | Invariant | Wave honors? | Where it could break |
|---|---|---|---|
| 1 | Runtime guarantees may not be inflated | **AT RISK** (R2, R3, R10, R11) | Lock-v2 wording |
| 2 | Audit semantics may not imply impossible guarantees | **AT RISK** (R4, R10, R21) | PR description, audit-row labels |
| 3 | Replay instrumentation is NOT replay prevention | **AT RISK** (R2) | Any "replay-resistant" framing |
| 4 | Middleware authorization is NOT ownership authorization | **HONORED** (Lock v2 §1 explicitly classifies as legitimacy hardening) | Future PR descriptions |
| 5 | Actor attribution is NOT tenant ownership | **HONORED** (Lock v2 §2.1, §5.1 forbid fake org derivation) | Future migration must distinguish |
| 6 | Correlation propagation must remain observable | **AT RISK** (R17 — only Hop 4 covered by tests) | Test gaps |
| 7 | Degraded auth may never widen capability | **HONORED** (preserved from W2-PR1A; Lock v2 stable-mutation rule 4.3) | Topology assumptions (R9) |
| 8 | Dossier semantics must remain truthful | **NOT VERIFIABLE** (R0) | UI artifacts not visible |
| 9 | Confidence semantics must remain explainable | **NOT VERIFIABLE** (R0) | Same |
| 10 | Marketing semantics may not exceed backend truth | **AT RISK** (R4, R5, R21) | PR description / future surfaces |

**5 honored, 4 at risk (all addressable via documentation/wording fixes), 2 not verifiable (artifacts missing).**

The wave honors invariants 4, 5, 7 substantively. The at-risk invariants are at-risk because of describing-language, not enforcement-mechanism. The not-verifiable invariants will close when the artifact bundle is attached.

---

## DO NOT MERGE.
## DO NOT IMPLEMENT PRODUCT CODE.
## DO NOT EXPAND SCOPE.
