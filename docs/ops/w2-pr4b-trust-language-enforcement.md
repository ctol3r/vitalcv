# W2-PR4B — Trust Language Enforcement

**Wave:** Wave 2, PR 4B — trust language enforcement governance · **Date:** 2026-05-08 · **Status:** governance only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** semantic-inflation adversary / trust-language reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `vitalcv-public-claims-matrix.md` (2026-04-27), `VITALCV_OPERATING_DOCTRINE.md`, CLAUDE.md banned-strings list

This doc operationalizes `TRUST_GUARANTEE_LEXICON.md`. It defines **where** the lexicon applies, **who** enforces it, **how** violations are remedied, and **what mechanisms** detect violations programmatically.

The wave introduces NO product code. It establishes governance: a CI-grep proposal, a per-surface enforcement map, a reviewer playbook, and a remediation workflow. The lexicon itself is the durable rule; this doc is the operational scaffolding around it.

---

## 1. Existing precedent (acknowledgement)

Trust-language enforcement is NOT new in VitalCV. Prior precedent already in place:

| Precedent | Location | Status |
|---|---|---|
| Public claims matrix | `docs/ops/vitalcv-public-claims-matrix.md` (2026-04-27) | **LIVE** — governs marketing/buyer-facing surfaces; explicitly bans `tamper-proof`, `cryptographic audit trail`, `Merkle audit trail`, `self-sovereign`, `blockchain verified`, `SOC 2 certified`, etc. |
| Banned-phrase sentinel | `apps/web/lib/source-health/unavailableLane.ts:25–37` | **LIVE** — `BANNED_USER_FACING_PHRASES` exported constant; tested by `unavailableLane.bannedPhrases.test.ts` |
| Copy-truth invariants | `apps/web/__tests__/passport-copy-truth.test.ts`, `foundation-sweep-{2,3,4,5,6}.test.ts`, `clinician-profile-foundation.test.ts` | **LIVE** — 8 test files assert `expect(src).not.toContain('tamper-proof')` and similar |
| CLAUDE.md banned strings | `CLAUDE.md` | **LIVE** — `automatically verified`, `HIPAA compliant`, `SOC2 certified`, etc. |

`TRUST_GUARANTEE_LEXICON.md` (this PR's contribution) is the **engineering counterpart** to `vitalcv-public-claims-matrix.md`'s buyer-facing counterpart. The matrix governs marketing surfaces; the lexicon governs internal trust language (PR descriptions, code comments, audit-row labels, dashboards).

The two are **complementary, not redundant**. Both must be enforced.

---

## 2. Per-surface enforcement map

Each platform surface has a designated enforcement mechanism. Where mechanisms overlap, both apply.

| Surface | Primary enforcement | Secondary enforcement | Owner |
|---|---|---|---|
| **Marketing copy (vitalcv.com, marketing app)** | `vitalcv-public-claims-matrix.md` allowlist + banned-list | CLAUDE.md banned-strings | Marketing + founder |
| **PR descriptions** | Codex SAFE audit prompt scans for §1 lexicon phrases | Reviewer manual check | PR author + reviewer |
| **Commit messages** | Codex SAFE audit at merge gate | git history review | PR author |
| **Code comments** | grep-based CI scan (proposed §3) | Reviewer manual check | PR author + reviewer |
| **Audit-row literal labels (`metadata.action`, event-type strings)** | Schema doc (`audit-row-schema.md`) + lexicon §4 | Code review | Wave owner |
| **Dashboard / admin UI copy** | Reviewer manual check + `audit-row-schema.md` reference | n/a | Dashboard owner |
| **Documentation in `docs/ops/**`** | Reviewer manual check | grep-based CI scan | Doc author |
| **User-facing UI copy (apps/web/components/**)** | Existing copy-truth tests + claims matrix | Reviewer | UI dev |
| **External-facing API responses** | API contract review | Code review | API owner |

The wave does NOT add new copy-truth tests in this doc; that's a separate implementation wave. This doc enumerates WHERE enforcement applies; the implementer wave wires up the mechanisms.

---

## 3. CI-grep proposal (proposed; not implemented in this PR)

A CI step that fails the build if any of the seven lexicon-banned phrases appears in a controlled set of paths.

### 3.1 Banned-phrase regex set

Per `TRUST_GUARANTEE_LEXICON.md` §1:

```
non.?repudiab(le|ility)
non.?repudiation
cryptographically.guarantee(d|s)
replay.protect(ed|ion)
signed.mutation(s)?
tamper.?proof
trustless
provably.secure
```

### 3.2 Scan scope (proposed)

| Path | Scan? | Notes |
|---|---|---|
| `apps/web/app/**` (live UI) | YES | Already partial via `passport-copy-truth.test.ts` etc.; extend |
| `apps/web/components/**` | YES | Same |
| `apps/marketing/**` | YES | Excluded historically per launch-blocker brief; needs separate wave but should be included here |
| `apps/api/backend/src/**` | **CONDITIONAL** — exclude grandfathered locations (§4 below); scan everywhere else | Existing `START_ATTESTED` "non-repudiation event" comments are grandfathered |
| `packages/audit/AuditEvent.ts` | EXCLUDE | Frozen YC MVP code per file-header comment; `NON_REPUDIATION_EVENTS` Set literal grandfathered |
| `packages/domain-common/__tests__/adversarial.frozen.test.ts` | EXCLUDE | Frozen test description text grandfathered |
| `apps/web/__tests__/**` (banned-phrase sentinels themselves) | EXCLUDE | Test files contain the phrases as sentinels for negation tests |
| `apps/web/lib/source-health/unavailableLane.ts` | EXCLUDE the `BANNED_USER_FACING_PHRASES` literal | Test sentinel pattern |
| `docs/**` | YES, EXCEPT `docs/CRED0_DOCTRINE.md` (review legacy doc separately) | Docs propagate framing |
| `docs/ops/TRUST_GUARANTEE_LEXICON.md` (the lexicon itself) | EXCLUDE | Defines the phrases |
| `docs/ops/w2-pr2c-*`, `w2-pr3b-*`, `w2-pr4b-*` (governance docs) | EXCLUDE | Discuss the phrases |
| `apps/web/app/_archive/**` | EXCLUDE | Archived; flagged for cleanup separately |
| `apps/web/components/sandbox/**` | CONDITIONAL — flag with `// SANDBOX` | Per claims matrix §Skipped |

### 3.3 CI-grep allowlist mechanism

A single file, `docs/ops/trust-language-allowlist.txt` (proposed; not in this PR), enumerates exact-string allowlists:

```
# Format: <file>:<line>:<exact_string>:<reason>
packages/audit/AuditEvent.ts:55:NON_REPUDIATION_EVENTS:Frozen YC MVP — Set literal of audit event types
packages/audit/AuditEvent.ts:144:NON_REPUDIATION_EVENTS:Frozen YC MVP — Set membership check
apps/api/backend/src/routes/employerActions.ts:799:non-repudiation event:Code comment grandfathered for START_ATTESTED context
apps/api/backend/src/routes/employerActions.ts:861:non-repudiation events:Code comment grandfathered
apps/api/backend/src/services/audit/auditService.ts:75:non-repudiation:Code comment grandfathered
apps/api/backend/src/services/audit/auditService.ts:113:non-repudiation events:Code comment grandfathered
apps/api/backend/src/services/ingest/ingestOrchestrator.ts:422:non-repudiation events:Code comment grandfathered
apps/api/backend/src/routes/passportEntity.ts:233:non-repudiation events:Code comment grandfathered
apps/api/backend/src/routes/employer-action.ts:8:non-repudiable:Code comment grandfathered for AuditEvent context
apps/api/backend/src/routes/employer-action.ts:79:non-repudiable:Code comment grandfathered
apps/web/lib/crypto/receiptCandidateSigner.ts:30:non-repudiation:Code comment grandfathered
```

A grep-violation that doesn't appear on the allowlist fails the build. Adding to the allowlist requires founder + Codex SAFE approval (per lexicon §6 "Update protocol").

### 3.4 Sub-string vs whole-word

The CI grep uses **whole-word** matching (`\b`) to avoid false positives. E.g., "non-repudiable" matches but "anti-non-repudiation-conspiracy" does not. The phrase set is intentionally simple; complex variants are caught at code review.

### 3.5 OAuth/DPoP "replay protection" disambiguation

`replay protection` appears legitimately in OAuth 2.0 / DPoP / RFC-9449 contexts (`apps/authz/**`, `apps/docs/api-security-profiles.md`, `apps/api/backend/src/services/oid4vp/presentationServer.ts`). These are **technically correct** uses of the cryptographic primitive (DPoP nonce + jti UNIQUE).

The CI grep allowlist explicitly permits `replay protection` in:

```
apps/authz/**
apps/docs/api-security-profiles.md
apps/api/backend/src/services/oid4vp/**
docs/certification/**
docs/plans/2026-02-24-auth-rbac-implementation.md
```

The lexicon's §1.3 ban is bounded to surfaces that lack DPoP-style nonce mechanisms (i.e., the employer-review mutation surface this wave touches). DPoP-bearing surfaces have substrate.

---

## 4. Grandfathering decision matrix

A pre-existing instance of a forbidden phrase is one of:

| Class | Disposition | Why |
|---|---|---|
| **A. Frozen-MVP code (file-header says "behavior frozen")** | Grandfathered | Modifying violates a frozen contract; rename in a future de-freeze wave |
| **B. Code comment that documents an architectural intent** | Grandfathered IF correctly bounded; remediated otherwise | E.g., "START_ATTESTED is one of the 5 canonical non-repudiation events" — true intent, but the phrase carries weight |
| **C. Test description / sentinel** | Grandfathered | Test files testing for the phrase MUST contain it |
| **D. Doctrine doc that defines the term** | Grandfathered | The lexicon itself contains the phrases |
| **E. Archive / sandbox code** | Flagged for cleanup wave | Not user-facing today but discoverable via grep |
| **F. Live user-facing UI copy** | Forbidden | Must be remediated immediately |
| **G. Marketing copy** | Forbidden per claims matrix | Same |
| **H. PR description / commit message** | Forbidden | Even if shipping a fix, the description mustn't use the phrase to describe what's NOT delivered |

---

## 5. Reviewer playbook

When reviewing a PR, reviewer asks the following sequence:

### 5.1 Did the PR add any new instance of a banned phrase?

`grep` the diff for the seven phrases. If a hit, classify per §4. If class F/G/H, BLOCK merge.

### 5.2 Did the PR description use any banned phrase?

The PR description is governed by the lexicon. If a hit, BLOCK merge until rewritten.

### 5.3 Did the PR add new audit-row literals or event-type names?

Cross-check against `TRUST_GUARANTEE_LEXICON.md` §4. If a literal contains `signed_`, `verified_`, `non_repudiable_`, `proven_`, `secured_`, `cryptographic_` token, BLOCK.

### 5.4 Did the PR use a §3 conditional phrase (lexicon) without the qualifier?

E.g., "atomic mutation+audit" without "for the four C-1 handlers." BLOCK until qualifier added.

### 5.5 Did the PR add a stable-guarantee claim that requires substrate?

If the PR adds a claim, the substrate must be demonstrated in the same PR. E.g., adding "anchored audit row" requires the anchoring pipeline to cover the touched event types.

### 5.6 Final cross-check

Codex SAFE audit prompt explicitly:
1. Scans the diff for the seven phrases.
2. Scans the PR description.
3. Scans new audit-row literals.
4. Scans for missing qualifiers.
5. Scans for substrate claims without substrate.

If all five pass, the wave's trust language is conformant.

---

## 6. Remediation workflow

When a violation is detected (whether at code review, CI grep, or post-hoc):

| Step | Action |
|---|---|
| 1 | Identify class (§4): A–E grandfathered/cleanup; F–H must remediate |
| 2 | If F (UI copy): replace with substitution per `w2-pr4b-safe-wording-substitutions.md` |
| 3 | If G (marketing): refer to `vitalcv-public-claims-matrix.md` for allowed wording; if no allowed wording, omit |
| 4 | If H (PR description): rewrite |
| 5 | If E (archive/sandbox): file follow-up cleanup wave; do not block current PR |
| 6 | Add CI-grep allowlist entry with reason (for grandfathered) |
| 7 | Add a test if the phrase introduction was a regression of a copy-truth test |

---

## 7. Audit-row literal discipline (operational)

Per `TRUST_GUARANTEE_LEXICON.md` §4, audit-row event-type strings and `metadata.action` literals are governed.

### 7.1 Existing event-type literals (grandfathered)

The following already exist in `packages/audit/AuditEvent.ts:5–35`:

```
NPI_INGESTED, NPI_VALIDATION_FAILED, FILE_INGESTED,
INGEST_PARSE_SUMMARY, INGEST_CONFLICT_DETECTED, INGEST_ERROR,
VERIFICATION_REQUESTED, VERIFICATION_COMPLETED, VERIFICATION_FAILED,
EMPLOYER_ACCEPTANCE_REJECTED, START_REJECTED, PSV_RECEIPT,
RECOGNITION, ACCEPTANCE, EMPLOYER_ACCEPTANCE, START,
[plus the EMPLOYER_REVIEW_* family and START_ATTESTED, EMPLOYER_PACKET_SHARED, ARTIFACT_EXPORTED]
```

These are grandfathered. New types must conform to lexicon §4.

### 7.2 Action-reason suffixes (Lock v2 introduces these)

Per `w2-pr2b-implementation-lock-v2.md` §8 + `w2-pr2b-audit-coupling.md` §3.3, denied-path action literals follow `<base>.<reason>`:

- `<base>.role_denied` ✓ allowed
- `<base>.no_org_context` ✓ allowed (until org_id is propagated; then becomes meaningful)
- `<base>.cross_tenant` ✓ allowed (becomes meaningful when ownership lands)
- `<base>.entity_not_found` ✓ allowed
- `<base>.duplicate_request` ✓ allowed
- `<base>.malformed_resource_id` ✓ allowed
- `<base>.wrong_review_state` ✓ allowed
- `<base>.acceptance_blocked` ✓ allowed (existing `accept` 422 reason)
- `<base>.no_prior_acceptance` ✓ allowed
- `<base>.archived_review` ✓ allowed

Forbidden suffixes per lexicon §4:

- `<base>.signed_*`
- `<base>.verified_*` (banned per CLAUDE.md)
- `<base>.non_repudiable_*`
- `<base>.proven_*`
- `<base>.secured_*`
- `<base>.cryptographic_*`

The wave's implementation PR must not introduce any of these.

---

## 8. Marketing-surface coordination

`TRUST_GUARANTEE_LEXICON.md` governs internal trust language. The marketing surface (`vitalcv.com`, `apps/marketing/**`) is governed by `vitalcv-public-claims-matrix.md`. Where the two intersect (e.g., "cryptographically-signed snapshot" appears on vitalcv.com hero copy AND could leak into wave PR descriptions):

| Coordination point | Owner | Mechanism |
|---|---|---|
| Marketing-claim alignment | Marketing + founder | Claims matrix |
| Internal trust language | Engineering + reviewer | Lexicon |
| Cross-contamination check | Codex SAFE audit | Scan both surfaces during merge gate |

A future "marketing-truth alignment" wave (NOT this wave; tracked as deferred) reconciles the live `vitalcv.com` aspirational claims (`cryptographically-signed snapshot`, `T4 · Issuer-signed`) with TRUST-PERSIST-1's actual delivery state. That wave is gated on TRUST-PERSIST-1 landing.

---

## 9. Lexicon adoption checklist (this PR's contribution)

For Lock v2 / W2-PR2C implementation PR + future waves to claim "lexicon-conformant":

- [ ] PR description scanned for the 7 forbidden phrases (none present, OR allowlist entry added).
- [ ] PR description uses lexicon §3 conditional phrases with required qualifiers.
- [ ] No new audit-row literals contain banned tokens (`signed_`, `verified_`, etc.).
- [ ] No new substrate-claim introduced without substrate demonstration.
- [ ] Codex SAFE audit transcript shows the lexicon scan (when CI-grep lands, this is automated).
- [ ] If any grandfathered location was touched, the touch did NOT propagate the phrase to a non-grandfathered surface.

When all 6 pass, the wave's trust language is conformant.

---

## 10. Closing principle (enforcement)

A lexicon without enforcement is a wishlist. Enforcement comes from three layers:

1. **Code-time:** copy-truth tests + CI-grep (when implemented).
2. **Review-time:** reviewer playbook + Codex SAFE audit prompt.
3. **Merge-time:** PR-description and commit-message scan.

The wave introduces the GOVERNANCE for all three layers. The IMPLEMENTATION (CI-grep wiring, Codex prompt extension, allowlist file) is a follow-up engineering wave.

**Without enforcement, the lexicon is theater. With enforcement, the lexicon is durable.** This wave is the bridge between the lexicon's existence and its operational reality.
