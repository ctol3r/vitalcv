# W2-PR4B — Inflation Detection Register

**Wave:** Wave 2, PR 4B — trust language enforcement, detection register · **Date:** 2026-05-08 · **Status:** detection register only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` and `w2-pr4b-trust-language-enforcement.md`

This doc enumerates **every observed instance** of the seven lexicon-banned phrases in the VitalCV runtime worktree as of `9eb5cdee`, and classifies each as one of:

- **ALLOWED** — the substrate exists; the phrase is correctly used.
- **GRANDFATHERED** — pre-existing instance; the lexicon does not retroactively force re-write; permitted on a CI-grep allowlist with reason.
- **FORBIDDEN** — must be remediated; appears in a non-grandfathered surface.
- **MISLEADING** — the phrase is technically present but in a context that an outside reader could misinterpret; clarification recommended.
- **CONTEXTUALLY UNSAFE** — the phrase is in a controlled context today (e.g., archive/sandbox) but is one wave away from leaking into a live surface.

Detection method: `grep -rn -i` on the runtime worktree at `/tmp/vitalcv-w2pr2b`.

---

## 1. Phrase: `non-repudiable` / `non-repudiation`

### 1.1 Hits

| Location | Context | Classification |
|---|---|---|
| `packages/audit/AuditEvent.ts:55` — `const NON_REPUDIATION_EVENTS = new Set<AuditEventType>([...])` | Set literal of audit event types treated as "canonical non-repudiation events" | **GRANDFATHERED** — frozen YC MVP code (file-header: "behavior frozen"); Set is functional, not user-facing |
| `packages/audit/AuditEvent.ts:144` — `if (!NON_REPUDIATION_EVENTS.has(event_type))` | Set membership check inside `emitDurableAuditEvent` | **GRANDFATHERED** — same |
| `apps/api/backend/src/routes/employerActions.ts:799` — `// non-repudiation event).` | Code comment for `START_ATTESTED` block | **GRANDFATHERED** — code comment; noted in `TRUST_GUARANTEE_LEXICON.md` §1.1 grandfathering |
| `apps/api/backend/src/routes/employerActions.ts:861` — `// AUDIT: START_ATTESTED is one of the 5 canonical non-repudiation events.` | Same context, second occurrence | **GRANDFATHERED** |
| `apps/api/backend/src/services/audit/auditService.ts:75, 113` — code comments | Documents the canonical-non-repudiation-event pattern | **GRANDFATHERED** |
| `apps/api/backend/src/services/ingest/ingestOrchestrator.ts:422` — code comment | Same pattern for `NPI_INGESTED` | **GRANDFATHERED** |
| `apps/api/backend/src/routes/passportEntity.ts:233` — code comment | Same pattern for `PASSPORT_SHARED` | **GRANDFATHERED** |
| `apps/api/backend/src/routes/employer-action.ts:8` — `* - AuditEvent (non-repudiable)` | File-header code comment | **MISLEADING** — older sibling file; bare adjective without scope; recommend rewriting to `* - AuditEvent (audit-traceable; tamper-evident given DB integrity)` |
| `apps/api/backend/src/routes/employer-action.ts:79` — `// Write non-repudiable audit event` | Single-line code comment | **MISLEADING** — same |
| `apps/web/lib/crypto/receiptCandidateSigner.ts:30` — `* non-repudiation. Callers should use SHA-256 of the serialized` | docstring fragment | **GRANDFATHERED** — code comment; describes what the signer would provide IF persisted (TRUST-PERSIST-1) |
| `packages/domain-common/__tests__/adversarial.frozen.test.ts:13` — `*   F. Non-repudiation under denial` | Test description | **GRANDFATHERED** — test file frozen; describes the test category |
| `packages/domain-common/__tests__/adversarial.frozen.test.ts:479,482,539` — test setup + comment | Same | **GRANDFATHERED** |
| `docs/CRED0_DOCTRINE.md:70` — `**Non-Repudiable:**` | Doctrine doc heading | **CONTEXTUALLY UNSAFE** — doctrine doc may be quoted in marketing or PR descriptions; needs review |

### 1.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 0 | n/a |
| GRANDFATHERED | 11 | CI-grep allowlist entry; `TRUST_GUARANTEE_LEXICON.md` §1.1 already pre-classifies |
| FORBIDDEN | 0 | n/a (none in user-facing UI today) |
| MISLEADING | 2 | Recommend in-file rewrite of `apps/api/backend/src/routes/employer-action.ts:8, 79` to use lexicon-aligned wording (NOT in this PR — separate cleanup wave) |
| CONTEXTUALLY UNSAFE | 1 | `docs/CRED0_DOCTRINE.md:70` review for inflation; not in scope of this PR |

---

## 2. Phrase: `tamper-proof`

### 2.1 Hits

| Location | Context | Classification |
|---|---|---|
| `apps/web/__tests__/foundation-sweep-{2,3,4,5,6}.test.ts` (5 hits) | `expect(src).not.toContain('tamper-proof')` style assertions | **GRANDFATHERED (test sentinels)** — tests that ASSERT the phrase is absent from production copy; must contain the phrase to test for it |
| `apps/web/__tests__/clinician-profile-foundation.test.ts:281` | Same pattern | **GRANDFATHERED (test sentinel)** |
| `apps/web/__tests__/passport-copy-truth.test.ts:87` | Same pattern | **GRANDFATHERED (test sentinel)** |
| `apps/web/__tests__/foundation-sweep-6-analytics-status.test.ts:263` | Same pattern | **GRANDFATHERED (test sentinel)** |
| `apps/web/lib/source-health/unavailableLane.ts:34` — `'tamper-proof',` in `BANNED_USER_FACING_PHRASES` | Banned-phrase sentinel array | **GRANDFATHERED (sentinel)** — the banned-phrase enforcement primitive |
| `apps/web/lib/source-health/README.md:43` — `- \`tamper-proof\`` | README line documenting the banned list | **GRANDFATHERED (doc)** |
| `docs/ops/vitalcv-public-claims-matrix.md:33, 62` (2 hits) | Banned-list enumeration in claims matrix | **GRANDFATHERED (doc)** — defines the ban |

### 2.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 0 | The phrase has no allowable substrate today |
| GRANDFATHERED | 10 | All test sentinels + banned-list literals + doc references |
| FORBIDDEN | 0 | The phrase does NOT appear in any live UI / marketing surface |
| MISLEADING | 0 | n/a |
| CONTEXTUALLY UNSAFE | 0 | n/a |

**Aggregate:** the platform is **already conformant** on `tamper-proof`. Existing copy-truth infrastructure successfully prevents leakage. The lexicon ratifies the existing posture.

---

## 3. Phrase: `replay protected` / `replay protection`

### 3.1 Hits

| Location | Context | Classification |
|---|---|---|
| `apps/docs/api-security-profiles.md:89, 109` | DPoP nonce + jti replay protection in OAuth 2.0 / RFC 9449 context | **ALLOWED (substrate present)** — DPoP `iat` window + jti UNIQUE is a real cryptographic primitive; RFC-9449 names this exact mechanism |
| `apps/api/backend/src/services/oid4vp/presentationServer.ts:51` — `/** Nonce for replay protection */` | OID4VP nonce field doc | **ALLOWED (substrate present)** — OID4VP requires a nonce for replay protection per spec |
| `apps/authz/README.md:82` — `Replay protection: DPoP iat must be within skew window` | DPoP server doc | **ALLOWED (substrate present)** — DPoP is the substrate |
| `apps/authz/src/index.ts:350` — `// B118A-TBIND-002: Validate jti (JWT ID) for replay protection` | DPoP jti validation code comment | **ALLOWED (substrate present)** |
| `docs/plans/2026-02-24-auth-rbac-implementation.md:1354` — `// - Replay protection` | Auth-RBAC plan doc | **ALLOWED** — context is OAuth/DPoP planning |
| `docs/certification/PROJECT_POLICIES.md:35` — `## 5. Replay Protection` | Certification policy doc | **ALLOWED** — context is OAuth-conformance certification |
| `docs/certification/gap-analysis.md:11` — `mTLS, JTI replay protection, and sender-constrained token binding` | Gap-analysis doc | **ALLOWED** — describes existing substrate |

### 3.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 7 | All instances are in OAuth/DPoP/OID4VP context where the substrate (DPoP nonce, jti UNIQUE) actually exists |
| GRANDFATHERED | 0 | n/a |
| FORBIDDEN | 0 | The phrase does NOT appear in the employer-review domain (where Lock v2 explicitly defers DB-enforced replay prevention) |
| MISLEADING | 0 | n/a — the OAuth surfaces are correct |
| CONTEXTUALLY UNSAFE | 0 | n/a |

**Aggregate:** the platform uses `replay protection` correctly in the OAuth/DPoP authz surface. The lexicon's §1.3 ban applies to the employer-review wave's surface (where DPoP-style nonces are NOT used), not to the authz surface. CI-grep allowlist must reflect this distinction (per `w2-pr4b-trust-language-enforcement.md` §3.5).

---

## 4. Phrase: `cryptographically guaranteed`

### 4.1 Hits

| Location | Context | Classification |
|---|---|---|
| `apps/web/app/_archive/wave119/trust/page.tsx:134` — `mathematically verifiable and cryptographically secured. Time-locked snapshots guarantee complete traceability...` | ARCHIVED page | **CONTEXTUALLY UNSAFE** — archived (`_archive/wave119/`) so not user-routable today, but the inflated language is grep-discoverable and could be revived; flagged for cleanup |
| `packages/trust-contract/src/system-coherence.ts:125` — `'One or more CHECKED claims lack a cryptographic receipt. Manifest integrity cannot be guaranteed.'` | Error message | **ALLOWED** — error message stating the NEGATION (i.e., "cannot be guaranteed"); this is correct truth-telling |

### 4.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 1 | The negation in `system-coherence.ts` is exemplary — explicitly disclaims the guarantee |
| GRANDFATHERED | 0 | n/a |
| FORBIDDEN | 0 | n/a (archived page is not routable) |
| MISLEADING | 0 | n/a |
| CONTEXTUALLY UNSAFE | 1 | Archive cleanup recommended |

---

## 5. Phrase: `trustless`

### 5.1 Hits

NONE.

### 5.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 0 | n/a |
| GRANDFATHERED | 0 | n/a |
| FORBIDDEN | 0 | n/a |
| MISLEADING | 0 | n/a |
| CONTEXTUALLY UNSAFE | 0 | n/a |

**Aggregate:** the platform is **clean** on `trustless`. The lexicon ban is preventive.

---

## 6. Phrase: `provably secure`

### 6.1 Hits

NONE.

### 6.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 0 | n/a |
| GRANDFATHERED | 0 | n/a |
| FORBIDDEN | 0 | n/a |
| MISLEADING | 0 | n/a |
| CONTEXTUALLY UNSAFE | 0 | n/a |

**Aggregate:** clean.

---

## 7. Phrase: `signed mutation`

### 7.1 Hits

NONE.

### 7.2 Disposition

| Class | Count | Action |
|---|---|---|
| ALLOWED | 0 | n/a |
| GRANDFATHERED | 0 | n/a |
| FORBIDDEN | 0 | n/a |
| MISLEADING | 0 | n/a |
| CONTEXTUALLY UNSAFE | 0 | n/a |

**Aggregate:** clean.

---

## 8. Aggregate inflation surface

| Phrase | Total hits | ALLOWED | GRANDFATHERED | FORBIDDEN | MISLEADING | CONTEXTUALLY UNSAFE |
|---|---|---|---|---|---|---|
| `non-repudiable` / `non-repudiation` | 14 | 0 | 11 | 0 | 2 | 1 |
| `tamper-proof` | 10 | 0 | 10 | 0 | 0 | 0 |
| `replay protected` / `replay protection` | 7 | 7 | 0 | 0 | 0 | 0 |
| `cryptographically guaranteed` | 2 | 1 | 0 | 0 | 0 | 1 |
| `trustless` | 0 | 0 | 0 | 0 | 0 | 0 |
| `provably secure` | 0 | 0 | 0 | 0 | 0 | 0 |
| `signed mutation` | 0 | 0 | 0 | 0 | 0 | 0 |
| **TOTAL** | **33** | **8** | **21** | **0** | **2** | **2** |

---

## 9. Headline findings

### 9.1 Zero forbidden instances in live UI / marketing

The seven lexicon-banned phrases produce **ZERO live-UI / marketing hits**. The platform is **already trust-language-conformant** on its directly user-facing surfaces. This is a credit to the existing claims-matrix + copy-truth infrastructure.

### 9.2 The non-repudiation grandfathering is concentrated and bounded

11 of the 14 `non-repudiable`/`non-repudiation` hits are concentrated in:

- The frozen `packages/audit/AuditEvent.ts` (Set literal + check).
- Code comments in 5 backend files describing the canonical-non-repudiation-events architectural pattern.
- One docstring in receipt-candidate-signer (TRUST-PERSIST-1 forward-looking).
- Frozen test descriptions in `adversarial.frozen.test.ts`.

These are bounded: they do not propagate to any user-facing surface.

### 9.3 Two MISLEADING instances should be remediated

`apps/api/backend/src/routes/employer-action.ts:8, 79` use bare-adjective `non-repudiable` in code comments. These are NOT user-facing but ARE the most temptation-prone surface for future inflation propagation (a future PR author copying the comment into a description). Recommend in-file rewrite to lexicon-aligned wording.

**Action:** flag for a separate cleanup-wave (NOT this PR's scope).

### 9.4 Two CONTEXTUALLY UNSAFE instances should be cleaned

- `apps/web/app/_archive/wave119/trust/page.tsx:134` — archived but discoverable; "cryptographically secured" + "guarantee complete traceability."
- `docs/CRED0_DOCTRINE.md:70` — doctrine doc heading "**Non-Repudiable:**" — propagation risk if quoted.

**Action:** flag for a separate cleanup-wave.

### 9.5 OAuth-context "replay protection" is correct

7 hits in OAuth/DPoP/OID4VP code/docs are technically correct — DPoP nonce + jti UNIQUE IS the substrate for replay protection per RFC-9449. The lexicon's §1.3 ban does NOT apply to these surfaces.

**Action:** CI-grep allowlist must mirror this scope distinction (per `w2-pr4b-trust-language-enforcement.md` §3.5).

### 9.6 Three phrases (`trustless`, `provably secure`, `signed mutation`) are unhit

Preventive ban. The lexicon prevents future introduction; no current cleanup needed.

---

## 10. Detection register summary

| Status | Count |
|---|---|
| Total instances detected | 33 |
| Forbidden (must remediate now) | **0** |
| Grandfathered (allowlist) | 21 |
| Allowed (substrate present) | 8 |
| Misleading (cleanup-wave) | 2 |
| Contextually unsafe (cleanup-wave) | 2 |
| Phrases with zero hits | 3 of 7 |

**Aggregate posture:** the platform's trust-language hygiene is **STRONG** today. The lexicon's main contribution is preventive — locking in current discipline + extending it to new wave surfaces. Cleanup of the 4 misleading/unsafe instances is a separate, low-priority wave.

---

## 11. CI-grep allowlist (proposed file content)

For `docs/ops/trust-language-allowlist.txt` (proposed; not in this PR):

```
# Format: <file>:<phrase>:<reason>
# Frozen YC MVP code
packages/audit/AuditEvent.ts:NON_REPUDIATION_EVENTS:Frozen Set literal of audit event types
packages/audit/AuditEvent.ts:NON_REPUDIATION_EVENTS.has:Frozen Set membership check

# Code comments grandfathered for canonical-event documentation
apps/api/backend/src/routes/employerActions.ts:non-repudiation event:Documents START_ATTESTED canonical event
apps/api/backend/src/services/audit/auditService.ts:non-repudiation:Documents canonical events architecture
apps/api/backend/src/services/ingest/ingestOrchestrator.ts:non-repudiation events:Documents NPI_INGESTED canonical event
apps/api/backend/src/routes/passportEntity.ts:non-repudiation events:Documents PASSPORT_SHARED canonical event
apps/web/lib/crypto/receiptCandidateSigner.ts:non-repudiation:Documents intended TRUST-PERSIST-1 capability

# Frozen test descriptions
packages/domain-common/__tests__/adversarial.frozen.test.ts:Non-repudiation:Frozen test category description

# Test sentinels for negation tests
apps/web/__tests__/foundation-sweep-2.test.ts:tamper-proof:Negation test
apps/web/__tests__/foundation-sweep-3.test.ts:tamper-proof:Negation test
apps/web/__tests__/foundation-sweep-4.test.ts:tamper-proof:Negation test
apps/web/__tests__/foundation-sweep-5.test.ts:tamper-proof:Negation test
apps/web/__tests__/foundation-sweep-6-analytics-status.test.ts:tamper-proof:Negation test
apps/web/__tests__/clinician-profile-foundation.test.ts:tamper-proof:Negation test
apps/web/__tests__/passport-copy-truth.test.ts:tamper-proof:Negation test
apps/web/lib/source-health/unavailableLane.ts:tamper-proof:BANNED_USER_FACING_PHRASES sentinel
apps/web/lib/source-health/README.md:tamper-proof:Banned-list documentation

# Doctrine docs that define the phrases
docs/ops/vitalcv-public-claims-matrix.md:tamper-proof:Defines the ban
docs/ops/TRUST_GUARANTEE_LEXICON.md:*:Defines all 7 forbidden phrases
docs/ops/w2-pr2c-runtime-truth-boundary.md:*:Discusses the phrases adversarially
docs/ops/w2-pr2c-replay-governance-review.md:*:Discusses the phrases
docs/ops/w2-pr2c-truth-alignment-governance.md:*:Discusses the phrases
docs/ops/w2-pr2c-legitimacy-risk-register.md:*:Discusses the phrases
docs/ops/w2-pr3b-semantic-inflation-review.md:*:Discusses the phrases
docs/ops/w2-pr3b-runtime-truth-review.md:*:Discusses the phrases
docs/ops/w2-pr3b-replay-governance.md:*:Discusses the phrases
docs/ops/w2-pr3b-audit-strength-review.md:*:Discusses the phrases
docs/ops/w2-pr4b-trust-language-enforcement.md:*:Discusses the phrases
docs/ops/w2-pr4b-inflation-detection-register.md:*:This file (the register itself)
docs/ops/w2-pr4b-safe-wording-substitutions.md:*:Lookup of safe substitutions

# OAuth/DPoP context (substrate present)
apps/docs/api-security-profiles.md:replay-protection:DPoP nonce substrate
apps/docs/api-security-profiles.md:Replay Protection:DPoP nonce substrate
apps/api/backend/src/services/oid4vp/presentationServer.ts:replay protection:OID4VP nonce substrate
apps/authz/README.md:Replay protection:DPoP substrate
apps/authz/src/index.ts:replay protection:DPoP jti substrate
docs/plans/2026-02-24-auth-rbac-implementation.md:Replay protection:OAuth planning context
docs/certification/PROJECT_POLICIES.md:Replay Protection:OAuth certification policy
docs/certification/gap-analysis.md:JTI replay protection:Documents existing substrate

# Negation example (good)
packages/trust-contract/src/system-coherence.ts:Manifest integrity cannot be guaranteed:Truthful disclaimer

# Sibling file misleading (cleanup-wave target)
# apps/api/backend/src/routes/employer-action.ts:non-repudiable:CLEANUP-WAVE — bare adjective
# apps/api/backend/src/routes/employer-action.ts:non-repudiable audit event:CLEANUP-WAVE
```

---

## 12. Closing principle (detection register)

The detection register is the empirical foundation for enforcement. Without it, every reviewer must independently rediscover where the phrases live. With it, the CI grep + allowlist can mechanize the discipline.

**Aggregate posture: the platform is trust-language-conformant today on its user-facing surfaces. The lexicon's job is to keep it that way.**

The register should be re-run at every wave-merge gate; new instances flagged; allowlist updated only with founder + Codex SAFE approval.
