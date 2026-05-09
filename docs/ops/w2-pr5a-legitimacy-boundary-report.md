# W2-PR5A — Legitimacy Boundary Report

**Wave:** Wave 2, PR 5A — runtime legitimacy certification, boundary report · **Date:** 2026-05-08 · **Status:** consolidated certification report only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** runtime trust certifier · **Authority:** consolidates Tracks A (`w2-pr5a-runtime-certification.md`), B (`w2-pr5a-replay-certification.md`), C (`w2-pr5a-audit-certification.md`), D (this doc), E (`w2-pr5a-trust-surface-certification-matrix.md`)

This doc is the **Track D consolidation + final boundary report.** It draws the line: **everything inside the boundary is certifiable; everything outside is either explicitly unverified, deferred, or forbidden by lexicon.**

The boundary is the platform's honest legitimacy posture. Marketing surfaces, dossier UX, autopilot semantics, confidence semantics, and runtime telemetry must align to it.

---

## 1. Track D — Runtime Truth Alignment

This track compares (a) runtime behavior, (b) telemetry semantics, (c) dossier semantics (speculative — JSX not attached), (d) UX semantics (speculative), and (e) lexicon guarantees. Identifies overstatements, understatements, ambiguous guarantees, and unverifiable guarantees.

### 1.1 Comparison axes

| Axis | What I can inspect | Posture |
|---|---|---|
| Runtime behavior | Worktree at `/tmp/vitalcv-w2pr2b` | INSPECTED |
| Telemetry semantics | `auditService.ts` + `recordEmployerReview*` + audit-row schema | INSPECTED |
| Dossier semantics | JSX artifacts NOT attached | NOT INSPECTABLE |
| UX semantics | JSX artifacts NOT attached | NOT INSPECTABLE |
| Lexicon guarantees | `TRUST_GUARANTEE_LEXICON.md` (this PR) | INSPECTED |

**Track D finding TD-1:** dossier + UX semantics certification is bounded by the artifact bundle's actual attachment. The wave is governance-incomplete on these surfaces until artifacts arrive.

### 1.2 Overstatements (claims exceeding runtime)

| # | Claim source | Claim | Actual runtime | Disposition |
|---|---|---|---|---|
| TD-OS-1 | Lock v2 §1 — "Mutation Legitimacy Hardening" | Implies platform validates mutation legitimacy authoritatively | Validates input + actor authentication; per-org authority deferred | LEXICON-ENFORCEABLE: must be qualified |
| TD-OS-2 | Lock v2 §7.4 — "Replay resistance" | Implies replay-prevention | Replay observability + best-effort dedup | LEXICON-ENFORCEABLE: forbidden phrase |
| TD-OS-3 | Lock v2 §6 — "Atomic mutation+audit" applied to share-packet/packet | Implies multi-row atomicity | Single-row tx wrap (cosmetic) | LEXICON-ENFORCEABLE: per-handler qualification required |
| TD-OS-4 | Lock v2 §3 — "Defense in depth" role gate | Implies trust-signal redundancy | Code-path redundancy only; same proxy-derived signal | LEXICON-ENFORCEABLE |
| TD-OS-5 | vitalcv.com — "cryptographically-signed snapshot" | Implies platform-signature | Manifest hashed; share-token random; issuer-signing aspirational (TRUST-PERSIST-1) | OUT OF WAVE SCOPE; flagged for marketing-truth-alignment wave |
| TD-OS-6 | vitalcv.com — "T4 · Issuer-signed" | Implies live issuer signing | TRUST-PERSIST-1 in progress | OUT OF WAVE SCOPE; flagged |
| TD-OS-7 | Code comment `START_ATTESTED is one of the 5 canonical non-repudiation events` | Implies cryptographic non-repudiation | L5 substrate absent | GRANDFATHERED in code; FORBIDDEN in propagation |

### 1.3 Understatements (runtime delivers more than claimed)

| # | Claim source | Claim | Actual runtime | Disposition |
|---|---|---|---|---|
| TD-US-1 | Lock v2 mostly framing | "Best-effort idempotency" | Combined with existing `accept` duplicate-check (line 175) + Postgres ACID, the practical replay defense for `accept` is stronger than "best-effort" suggests for honest clients | NOTABLE — but lexicon prefers conservative framing |
| TD-US-2 | Doctrine docs | "Audit-traceable" | The audit-write infrastructure is tiered (T0/T1/T2 per `auditService.ts`); the wave operates at T2 (highest tier) — stronger than bare "traceable" | Recommend wording: "T2 atomic-with-mutation audit" |
| TD-US-3 | Lock v2 §3 | "Constant-time-compared org-id" | The W2-PR1A `timingSafeEqualStrings` is Edge-safe TextEncoder XOR over full byte length; this is a real constant-time primitive | Wording could be more specific |

### 1.4 Ambiguous guarantees (could be read multiple ways)

| # | Guarantee | Ambiguity |
|---|---|---|
| TD-AM-1 | "Atomic mutation+audit" | Atomic-with-each-other? Atomic-with-side-effects? Atomic-with-response-delivery? — only the first is true |
| TD-AM-2 | "Replay observability" | Observable to whom? SOC analyst with the runbook? — runbook deferred to publication |
| TD-AM-3 | "Tamper-evident" | Tamper-evident under what threat model? — only "given DB integrity"; the qualifier is mandated by lexicon §3 |
| TD-AM-4 | "Defense in depth" | Defense in code-path or in trust-signal? — only code-path |
| TD-AM-5 | "Per-actor scoped" | Scoped to whom can see vs. who can act? — actor scope on writes; reads vary per surface (per §S8/S9/S10 in Track E) |

### 1.5 Unverifiable guarantees (substrate not inspectable in this conversation)

| # | Guarantee | Why unverifiable |
|---|---|---|
| TD-UV-1 | L3 anchored audit rows | Pipeline coverage for the 6 in-scope event types not inspected |
| TD-UV-2 | Audit retention SLA | Not formalized; ops-discipline-bounded |
| TD-UV-3 | Deployment topology (backend reachable only by proxy) | Not inspected; assumed per Lock v2 §10 |
| TD-UV-4 | UI/dossier/autopilot/inbox/confidence rendering | JSX artifacts not attached |
| TD-UV-5 | Parallel implementation diff for Lock v2 | Not visible to this review |
| TD-UV-6 | Codex SAFE audit prompt extension | Implementation status of audit-prompt update not inspected |
| TD-UV-7 | CI-grep wiring for forbidden phrases | Proposal-only per `w2-pr4b-trust-language-enforcement.md` §3 |

---

## 2. The legitimacy boundary

A diagram of what's CERTIFIABLE vs. what's outside:

```
                 ┌──────────────────────────────────────────────┐
                 │                                              │
                 │   INSIDE THE LEGITIMACY BOUNDARY             │
                 │   (CERTIFIABLE post-Lock-v2 + lexicon)        │
                 │                                              │
                 │   • W2-PR1A middleware (degraded fail-closed,│
                 │     namespace protection, runtime claim     │
                 │     validation, constant-time compare)       │
                 │   • Audit-write infrastructure (T0/T1/T2)    │
                 │   • L1 (recorded) for all 6 in-scope branches│
                 │   • L2 (tamper-evident given DB integrity)  │
                 │   • Atomic mutation+audit for 4 C-1 handlers│
                 │   • Single-row tx wrap (cosmetic) for 2 C-2 │
                 │   • Denied-path audit emission post-auth     │
                 │   • correlationId observability + best-effort│
                 │     application-layer dedup                  │
                 │   • Readonly POST denial (proxy + backend)   │
                 │   • per-actor-scoped employer-review writes  │
                 │   • Forbidden-input discard (body tenantId,  │
                 │     orgId, organizationContextId, etc.)      │
                 │                                              │
                 └──────────────────────────────────────────────┘

                 ┌──────────────────────────────────────────────┐
                 │   AT THE BOUNDARY                            │
                 │   (PARTIAL / UNVERIFIED — needs follow-up)   │
                 │                                              │
                 │   • L3 anchored — pipeline coverage UNVERIFIED│
                 │   • Audit retention SLA — undocumented       │
                 │   • Deployment topology assumption — ops-only│
                 │   • Confirm-start fallback-to-most-recent    │
                 │     (1-release deprecation window risk)      │
                 │   • Share-packet token entropy (not inspected)│
                 │   • UI dossier/autopilot/inbox alignment     │
                 │     (JSX artifacts not attached)             │
                 │                                              │
                 └──────────────────────────────────────────────┘

                 ┌──────────────────────────────────────────────┐
                 │   OUTSIDE THE BOUNDARY                       │
                 │   (DEFERRED to future migration)             │
                 │                                              │
                 │   • Per-org tenancy (W2-PR2B-MIG-C)         │
                 │   • Backend JWT verification (W2-PR2B-MIG-B)│
                 │   • DB-enforced replay anchors (W2-PR2B-MIG-A)│
                 │   • Cross-tenant 404 wire on resource lookup │
                 │   • Issuer signing end-to-end (TRUST-PERSIST-1)│
                 │   • Stale session/role invalidation          │
                 │   • L4/L5 audit strength (per-row signature, │
                 │     non-repudiation)                          │
                 │                                              │
                 └──────────────────────────────────────────────┘

                 ┌──────────────────────────────────────────────┐
                 │   FORBIDDEN BY LEXICON                       │
                 │   (SUBSTRATE ABSENT — must not claim)        │
                 │                                              │
                 │   • "non-repudiable"                         │
                 │   • "cryptographically guaranteed"           │
                 │   • "replay protected"                       │
                 │   • "signed mutation"                        │
                 │   • "tamper-proof"                           │
                 │   • "trustless"                              │
                 │   • "provably secure"                        │
                 │                                              │
                 └──────────────────────────────────────────────┘
```

---

## 3. The certification gates

For the wave to advance from CERTIFIABLE-IN-CONTRACT to CERTIFIED-IN-IMPLEMENTATION:

| Gate | Owner | Status |
|---|---|---|
| **G1: Lock v2 wording fixes per W2-PR2C R2/R10/R11** | Lock v2 author | ⚠ pending |
| **G2: TRUST_GUARANTEE_LEXICON.md adopted as constitutional** | This PR delivers | ✅ done at `efb75c8b` |
| **G3: W2-PR4B inflation enforcement bundle merged** | This PR delivers | ✅ done at `4763480d` |
| **G4: Codex SAFE audit prompt extended for 7 forbidden phrases** | Audit prompt author | ⚠ pending |
| **G5: Implementation diff inspected by Codex SAFE** | Codex SAFE | ⚠ pending (parallel implementation not visible) |
| **G6: Anchoring pipeline coverage VERIFIED for the 6 in-scope event types** | Ops + audit team | ⚠ pending (AS-Rec-1) |
| **G7: Audit retention SLA formalized** | Ops | ⚠ pending |
| **G8: Deployment topology runbook updated (backend reachable only by proxy)** | Ops | ⚠ pending |
| **G9: Artifact bundle attached + UI/dossier/autopilot inspection** | Reviewer | ⚠ pending (R0 from W2-PR2C still open) |
| **G10: B4 Sentry breadcrumb on HITL silent-degrade** | Implementation PR | ⚠ pending |
| **G11: B2 confirm-start deprecation closure tracked as launch-blocker** | Wave owner | ⚠ pending |

**Gate status:** 2 of 11 closed (this PR's contributions). 9 of 11 pending. 4 are doc/wording (closeable in days). 5 are operational (require ops team + parallel implementation merge + Codex audit).

---

## 4. Required disclaimers (consolidated)

Per Tracks A, B, C, D, the wave's surfaces must include the following disclaimers:

1. **Trust anchor:** Clerk JWT + web middleware (W2-PR1A) + proxy `x-clerk-user-id` header. Backend trusts proxy. Deployment topology assumption: backend reachable only by proxy.
2. **Org scope absent:** per-actor scoped (Clerk userId), not per-org. Per-org tenancy deferred to W2-PR2B-MIG-C.
3. **Cryptographic attestation absent:** L4 (per-row signature) + L5 (non-repudiation) absent. Audit rows are L1+L2 (recorded + tamper-evident given DB integrity).
4. **L3 (anchored) UNVERIFIED:** schema columns exist; live pipeline coverage for the 6 in-scope event types not confirmed by this review.
5. **Replay observability ≠ replay prevention:** correlationId observability + best-effort idempotency check. Capture-replay / cross-actor / long-window / fingerprint-substitution NOT defended.
6. **Atomic mutation+audit per-handler-qualified:** transactional for 4 C-1 handlers; cosmetic single-row tx wrap for 2 C-2 handlers (audit IS persistence; no companion mutation).
7. **Defense-in-depth code paths:** readonly denial enforced at proxy + backend; trust-signal redundancy via independent backend JWT verification deferred to MIG-B.
8. **Pre-tx side-effect dependency:** snapshot/passport/lookup reads happen BEFORE tx; race window between snapshot-time and commit-time; audit records snapshot-time.
9. **Side effects are fire-and-forget:** SEAL captures, learning captures, recompute jobs run post-commit; failures do NOT roll back audit; do NOT claim end-to-end-atomic.
10. **Confirm-start deprecation window:** 1-release window for fallback-to-most-recent; race risk extends through the window.

Any surface (PR description, audit-row label, dashboard, marketing, dossier) describing the wave's work must respect all 10.

---

## 5. Final boundary determination

### 5.1 Inside the boundary (CERTIFIABLE)

- All Track A claims at PARTIAL or higher (post-Lock-v2 contract certifiable).
- All Track B claims at PARTIAL or higher (replay observability certifiable; prevention NOT).
- All Track C claims at L1+L2+atomic-coupling for 4 C-1 handlers; L1+L2+cosmetic for 2 C-2; denied-path emission certifiable.
- 3 of 12 Track E surfaces are CERTIFIED outright; 5 reach PARTIAL post-Lock-v2.

### 5.2 At the boundary (PARTIAL — needs follow-up)

- L3 anchoring pipeline verification.
- Audit retention SLA.
- Deployment topology runbook.
- B2 deprecation window closure.
- Share-packet token entropy verification.
- UI/dossier/autopilot certification (artifact bundle).

### 5.3 Outside the boundary (DEFERRED / NOT CERTIFIABLE)

- Per-org tenancy (MIG-C).
- Backend JWT verification (MIG-B).
- DB-enforced replay (MIG-A).
- L4 / L5 audit strength.
- Capture-replay / cross-actor / long-window replay defense.
- Issuer signing end-to-end (TRUST-PERSIST-1).
- Stale session/role invalidation.

### 5.4 Forbidden (SUBSTRATE ABSENT)

- 7 lexicon-banned phrases.
- Bare "verified" (CLAUDE.md).
- "Tamper-proof" without anchoring substrate (lexicon §1.5).

---

## 6. Final certification disposition

The wave is **CERTIFIABLE-IN-CONTRACT** for:

- ✅ Mutation Attribution at PARTIAL (proxy-bounded; lexicon-enforceable)
- ✅ Replay Observability (correlationId-stamped; runbook deferred)
- ✅ Audit Coupling at L1+L2+atomic-for-4-C-1-handlers
- ✅ Trust-Surface Matrix at 3 CERTIFIED + 5 PARTIAL
- ✅ Lexicon-conformant wording (with enforcement gates closed)

The wave is **NOT CERTIFIABLE** for:

- ❌ Per-org tenancy (deferred)
- ❌ Capture-replay defense (out of any wave)
- ❌ L4/L5 audit strength (substrate absent)
- ❌ End-to-end atomic with side effects (intentionally fire-and-forget)
- ❌ UI/dossier/autopilot certification (artifacts not attached)

The wave's overall posture: **CERTIFIABLE — CONDITIONAL on the 11 gates in §3.**

Of the 11 gates, 2 are closed by this PR; 4 are quick doc/wording tasks (days); 5 are operational + parallel-implementation gates (weeks). When all 11 close, the wave can transition from CERTIFIABLE-IN-CONTRACT to CERTIFIED-IN-IMPLEMENTATION.

---

## 7. Closing principle (boundary report)

The legitimacy boundary is the line between honest claims and inflated claims. The wave's runtime work pushes the boundary outward — REAL movement on 6 of 12 surfaces. The wave's risk is exclusively in describing-language; the lexicon + Codex audit prompt extension are the discipline that prevents inflation.

**The platform is CERTIFIABLE inside the boundary defined here. Outside, it is either explicitly deferred (with named follow-up waves), unverified (with named verification gates), or forbidden (with lexicon-enforced wording discipline).**

This is the honest legitimacy posture. Anything more is inflation; anything less is understatement.
