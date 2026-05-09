# W2-PR3B — Audit Strength Review

**Wave:** Wave 2, PR 3B — adversarial trust governance, audit-strength focus · **Date:** 2026-05-08 · **Status:** review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** audit-legitimacy reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `MUTATION_GATE_SEQUENCE.md` §4, `w2-pr2c-audit-coupling-review.md`

This doc is the **audit-strength-focused adversarial review** of W2-PR3B's instrumentation work. It rates the audit guarantees the wave actually delivers vs. the inflated framings that would be unsafe to claim.

The central thesis: **the wave's audit-coupling work is genuinely strong for 4 handlers (transactional) and code-uniform for 2 (single-row tx wrap). It is NOT cryptographically attestable, NOT non-repudiable, NOT tamper-proof. The audit table is tamper-evident given DB integrity — no more.**

---

## 1. Audit-strength taxonomy

A platform's audit log can claim properties at five levels of strength. The wave's claims must stay at the level its substrate supports.

| Level | Property | Substrate required |
|---|---|---|
| **L1: Recorded** | An event was written to a table | A table + insert |
| **L2: Tamper-evident given DB integrity** | Modification is detectable IF one trusts the DB | SHA-256 `hash` column on rows; canonical-form hashing |
| **L3: Tamper-evident across DB compromise** | Modification is detectable EVEN IF DB is compromised | Append-only ledger + external anchoring (Merkle root anchored to blockchain or third-party timestamp service) |
| **L4: Cryptographically attestable (per row)** | Each row carries a signature that any third party can verify | Per-row signature by an issuer key |
| **L5: Non-repudiable** | The actor cannot reasonably deny having signed | Per-row signature using the ACTOR's private key, with verifiable proof of possession |

The platform's claims must be precise about which level applies.

---

## 2. The runtime substrate, level by level

### 2.1 L1 — Recorded

**Substrate:** `AuditEvent` table; every C-1 + C-2 handler writes a row.

**Status:** ✅ **DELIVERED** today. Lock v2 extends with denied-path emission.

**Lexicon-aligned wording:** "Audit-traceable" / "audit-coupled mutation."

### 2.2 L2 — Tamper-evident given DB integrity

**Substrate:** `AuditEvent.hash String` column (line 1480 of schema). Canonical-form input is hashed; downstream readers can re-canonicalize and re-hash to detect mutation of the row.

**Status:** ✅ **DELIVERED** today. The wave does not change this. The hash is computed from canonical content (`type, referenceId, metadata`). A row whose `hash` doesn't match a re-computation of its content is flagged tampered.

**Caveat:** the canonical-form algorithm must be deterministic across readers. If the canonicalization is implicit (different JSON serializers produce different bytes), the tamper-evidence depends on the canonicalizer being shared. Verifying the canonicalizer is part of the audit-strength claim.

**Lexicon-aligned wording:** "tamper-evident given DB integrity" (per `TRUST_GUARANTEE_LEXICON.md` §3 — must carry the qualifier).

**Adversarial finding AS-1:** the wave's PR description must not bare-mention "tamper-evident" — must always carry the qualifier "given DB integrity." Bare-form is forbidden.

### 2.3 L3 — Tamper-evident across DB compromise

**Substrate:** `AuditEvent.anchored Boolean @default(false)` and `AuditEvent.merkleRoot String?` columns (lines 1487–1488 of schema). The anchoring pipeline (if live) batches recent rows into a Merkle tree, computes the root, and submits to an external anchor (e.g., blockchain timestamp).

**Status:** ⚠️ **PARTIAL** — schema columns exist; live anchoring pipeline status NOT verified by this review. The `anchored` column defaults to `false`. Whether ANY mutation in the wave's scope produces `anchored: true` is unverified.

**Lexicon-aligned wording:** "anchored audit row" — ONLY when `anchored: true` AND the anchor is verifiable. "Merkle-rooted" — same condition.

**Adversarial finding AS-2:** the wave SHOULD verify whether the existing anchoring pipeline covers the C-1 + C-2 audit rows it touches. If yes, the L3 claim becomes available (with qualifier). If no, the wave's claims must stay at L2.

**Recommended verification:** query production / staging audit table for `SELECT COUNT(*) WHERE type IN ('EMPLOYER_REVIEW_ACCEPTED', 'EMPLOYER_REVIEW_REFRESH_REQUESTED', 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW', 'START_ATTESTED', 'EMPLOYER_PACKET_SHARED', 'ARTIFACT_EXPORTED') AND anchored = true GROUP BY type;`. If the count is zero or near-zero, L3 is not deliverable.

### 2.4 L4 — Cryptographically attestable (per row)

**Substrate:** would require a signing key (issuer-side or platform-side) and a per-row signature column.

**Status:** ❌ **NOT DELIVERED.** No row-level signature column on `AuditEvent`. TRUST-PERSIST-1 introduces issuer-signed receipts (a separate artifact), not per-audit-row signatures.

**Lexicon-aligned wording:** N/A — the claim is forbidden today per `TRUST_GUARANTEE_LEXICON.md` §1.2.

### 2.5 L5 — Non-repudiable

**Substrate:** would require the actor's key + proof-of-possession.

**Status:** ❌ **NOT DELIVERED.** Actor attribution is via `requireClerkUserId` (header trust). No actor key, no proof-of-possession.

**Lexicon-aligned wording:** N/A — forbidden per `TRUST_GUARANTEE_LEXICON.md` §1.1.

**Pre-existing exception:** the code comment for `START_ATTESTED` says "non-repudiation event." This is grandfathered IN CODE COMMENTS but **must not propagate to PR descriptions, audit-row labels, dashboards, marketing.**

---

## 3. The wave's audit-strength delta

| Property | Pre-Lock-v2 | Post-Lock-v2 | Strength level |
|---|---|---|---|
| Mutation row recorded | YES | YES | L1 |
| Audit row recorded on success | YES | YES | L1 |
| Audit row recorded on denial | NO (most paths) | YES (after Step 2; per Lock v2 §8) | L1 (extended) |
| `metadata.correlationId` | NO | YES | L1 (extended) |
| `metadata.actorId` (vs. `metadata.employerId`) | EXISTING (`employerId`) | NEW (`actorId`) | redundant; lexicon recommends one canonical |
| `metadata.payloadHash` | partial (existing on some types) | YES (mandated by RG-Rec-2) | L2 (extended) |
| `hash` column populated | YES | YES | L2 |
| Canonical-form hash algorithm | YES (existing) | unchanged | L2 |
| Atomic with mutation in `prisma.$transaction` (4 C-1 handlers) | YES | YES | L1 + atomic |
| Single-row tx wrap (2 C-2 handlers) | NO | YES (cosmetic) | L1 + uniform code |
| Anchored to external service | UNVERIFIED | UNVERIFIED (AS-2) | L3 if pipeline live |
| Per-row signature | NO | NO | L4 absent |
| Actor key + PoP | NO | NO | L5 absent |

**Net delta:** the wave moves audit strength **from L1 to L1+L2+atomicity-uniformity** for all 6 in-scope branches. L3 status is unchanged (depends on existing anchoring pipeline). L4 + L5 unaffected.

---

## 4. Adversarial findings (audit strength)

### 4.1 AS-A — "Atomic mutation+audit" used unqualified

**Scenario:** the implementation PR description says "atomic mutation+audit on every employer-review handler."

**Reality:** atomic for 4 of 6; single-row-tx-wrap-cosmetic for 2 of 6. Bare claim inflates against C-2 handlers.

**Lexicon disposition:** §3 conditional phrase — must be qualified.

**Severity:** MEDIUM.

### 4.2 AS-B — "Tamper-proof audit log"

**Scenario:** dashboard or marketing surface uses "tamper-proof."

**Reality:** L3 is partial-or-absent; L2 is live (tamper-EVIDENT given DB integrity).

**Lexicon disposition:** "**tamper-proof**" forbidden by §1.5.

**Severity:** HIGH.

### 4.3 AS-C — "Cryptographically attested mutation"

**Scenario:** PR description or audit-row label uses "cryptographically attested."

**Reality:** no L4 substrate.

**Lexicon disposition:** "**cryptographically guaranteed**" / "**signed mutation**" forbidden by §1.2 / §1.4.

**Severity:** HIGH.

### 4.4 AS-D — "Non-repudiable" in PR description

**Scenario:** PR description echoes the grandfathered code comment for `START_ATTESTED` and uses "non-repudiable" for the wave's mutation work.

**Reality:** L5 substrate absent.

**Lexicon disposition:** "**non-repudiable**" forbidden by §1.1.

**Severity:** HIGH (and high-temptation due to existing code comment).

### 4.5 AS-E — "Audit-ready receipts" conflation

**Scenario:** the wave's audit-coupling work is described as advancing toward marketing's "audit-ready receipts" claim.

**Reality:** audit rows ≠ receipts. Audit row is a forensic event; receipt is an issuer-signed credential.

**Lexicon disposition:** the conflation pattern is implicit; defended by maintaining the audit/receipt distinction (per `TRUST_GUARANTEE_LEXICON.md` §1.1 surrounds receipts with their substrate).

**Severity:** HIGH.

### 4.6 AS-F — "Audit row provides legal evidence" without qualification

**Scenario:** marketing or sales surface implies audit rows are admissible as legal evidence of an actor's intent.

**Reality:** audit rows are tamper-evident given DB integrity. Their admissibility depends on (a) DB integrity claims (L3 anchoring not verified), (b) actor-attribution claims (L5 PoP absent), (c) chain-of-custody documentation.

**Lexicon disposition:** "legal evidence" claims are governed by CLAUDE.md banned strings (e.g., "legally accepted") AND the lexicon's general spirit.

**Severity:** HIGH.

### 4.7 AS-G — Audit-row-as-persistence pattern dependency

**Scenario:** `share-packet` and `packet` use audit rows as the persistent record. Audit retention policy directly affects share-token TTL and export receipts.

**Reality:** no audit-retention SLA documented. If audit rows are GC'd before token expiry, share-resolution silently breaks.

**Severity:** MEDIUM (operational, not language).

### 4.8 AS-H — `metadata.organizationContextId` recorded but untrusted

**Scenario:** audit row records `metadata.organizationContextId` from request body. Forensic queries that join on this field reach forged client-supplied values.

**Reality:** Lock v2 §5.1 forbids using it as authorization key. Recording it as descriptive attribution echo is allowed but must be flagged.

**Lexicon disposition:** record with explicit `untrusted_attribution_echo: true` flag in metadata.

**Severity:** MEDIUM.

### 4.9 AS-I — Multiple attribution fields drift

**Scenario:** `employerId`, `actorId`, `attribution.organizationId`, `organizationContextId` all carry related-but-not-identical attribution. Future schema changes may break forensic queries that pick the wrong field.

**Reality:** redundant fields are a forensic-debt problem, not a wave-introduced one.

**Severity:** MEDIUM.

### 4.10 AS-J — `tenantId` always-NULL audit interpretation

**Scenario:** `audit.organizationId / tenantId` is NULL in v1. Reader sees NULL; interprets as "no tenant" or "row is broken."

**Reality:** NULL is deliberate per Lock v2 §8.

**Mitigation:** sentinel value (e.g., `'__pre_org_migration__'`) OR explicit doc.

**Severity:** LOW.

---

## 5. Per-handler audit-strength (post-Lock-v2)

| Handler | L1 | L2 | Atomic | L3 (anchored) | L4 | L5 | Aggregate |
|---|---|---|---|---|---|---|---|
| `accept` | ✅ | ✅ | ✅ tx | ⚠ partial-pending-pipeline | ❌ | ❌ | **STRONG** at L1+L2+atomic |
| `confirm-start` | ✅ | ✅ | ✅ tx | ⚠ partial | ❌ | ❌ | **STRONG** at L1+L2+atomic |
| `request-refresh` | ✅ | ✅ | ✅ tx | ⚠ partial | ❌ | ❌ | **STRONG** at L1+L2+atomic |
| `route-to-review` | ✅ | ✅ | ✅ tx | ⚠ partial | ❌ | ❌ | **STRONG** at L1+L2+atomic |
| `share-packet` | ✅ | ✅ | ✅ single-row tx (cosmetic) | ⚠ partial | ❌ | ❌ | **MODERATE** — audit IS persistence; L3 dependence is acute |
| `packet` (audit-emitting) | ✅ | ✅ | ✅ single-row tx (cosmetic) | ⚠ partial | ❌ | ❌ | **MODERATE** — same |

**Aggregate:** four handlers at STRONG L1+L2+atomic. Two handlers at MODERATE — same level technically, but the audit-as-persistence pattern increases their L3-pipeline-dependency. None at L3-confirmed, L4, or L5.

---

## 6. Recommendations

| # | Recommendation | Severity |
|---|---|---|
| **AS-Rec-1** | Verify the anchoring pipeline status for the 6 audit-event types in scope (per AS-2). Document live status. | HIGH |
| **AS-Rec-2** | If anchoring is NOT live for these types, do not use "anchored" or "Merkle-rooted" in any wave surface. | HIGH |
| **AS-Rec-3** | The wave's PR description must explicitly state: "audit rows are tamper-evident given DB integrity (L2). They are NOT signed (L4 absent). They are NOT non-repudiable (L5 absent)." | HIGH |
| **AS-Rec-4** | Mandate `metadata.payloadHash` on EVERY audit row (permitted + denied) per `w2-pr3b-replay-governance.md` RG-Rec-2. | HIGH |
| **AS-Rec-5** | Pick one canonical actor-attribution field (recommend `actorId`); add a deprecation note for `employerId`. | MEDIUM |
| **AS-Rec-6** | Add `untrusted_attribution_echo: true` flag to audit metadata when recording `organizationContextId`, `bundleId`, etc. | MEDIUM |
| **AS-Rec-7** | Document audit-retention SLA that respects share-token TTL (B5) and packet-export forensic horizon (B7). | MEDIUM |
| **AS-Rec-8** | For NULL `tenantId` on v1 audit rows, either populate with sentinel `'__pre_org_migration__'` OR add explicit comment in audit-row schema doc. | LOW |
| **AS-Rec-9** | Publish `docs/ops/audit-row-schema.md` documenting all metadata fields, their semantics, and which are trusted vs. echoed. | MEDIUM |

---

## 7. Closing principle (audit strength)

Audit strength is the discipline of stating exactly which guarantee level applies. The wave delivers L1 + L2 + atomic-coupling across all 6 in-scope branches. It does NOT deliver L3 (status unverified), L4 (no signing), or L5 (no PoP).

**The wave's audit work is genuinely strong at the levels it commits to. The risk is exclusively in language that implies higher levels.** The lexicon (§1.1, §1.2, §1.4, §1.5) forbids the four phrases that would inflate. The wave is safe IF the lexicon is enforced.

**Audit legitimacy assessment:** the wave moves audit strength from L1 toward L1+L2+atomic-coupling-uniform. This is real progress. It is honest progress. It is NOT progress toward L3/L4/L5 — those require separate substrate (anchoring pipeline verification; per-row signing; actor PoP) that the wave neither delivers nor claims.

The platform's audit log post-W2-PR3B is **strong at L2 (tamper-evident given DB integrity), atomic at the four C-1 handlers, code-uniform at the two C-2 handlers, and observability-rich via correlationId.** Anything beyond this description inflates.
