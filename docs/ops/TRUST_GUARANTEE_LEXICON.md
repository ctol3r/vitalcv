# Trust Guarantee Lexicon

**Status:** **CONSTITUTIONAL** — frozen reference for VitalCV trust language · **Date established:** 2026-05-08 · **Authority:** subordinate to `VITALCV_OPERATING_DOCTRINE.md`, `SECURITY_INVARIANTS.md`, `AUTHORIZATION_BASELINE_V1.md`; supersedes ad-hoc trust-language descriptions in PR descriptions, audit-row labels, dashboard copy, and marketing surfaces

This lexicon governs **what trust language the platform may use about itself, in any surface (commit messages, PR descriptions, audit rows, dashboards, UI copy, marketing).** It is the durable rule that prevents instrumentation theater: every phrase here is either gated to a specific runtime substrate or forbidden until the substrate exists.

**Update protocol:** a runtime change that satisfies a forbidden phrase's substrate must explicitly reference this doc, demonstrate the substrate, and propose the lexicon update in the same PR. The lexicon update is reviewed by founder + Codex SAFE.

This doc is companion to (and prerequisite for) the seven banned strings already in CLAUDE.md ("automatically verified," "guaranteed verification," "complete credentialing," etc.). The banned strings list addresses *credentialing inflation*; this lexicon addresses *trust-mechanism inflation*.

---

## 1. The seven forbidden phrases

The following phrases are **forbidden** in any platform surface UNLESS the listed runtime substrate is verifiably present.

### 1.1 "non-repudiable"

**Banned by default.** "Non-repudiation" in the cryptographic sense requires (a) a signature by a private key (b) the signer cannot reasonably deny signing (c) the signature is verifiable by anyone with the public key.

| Required runtime substrate to use this phrase | Status today |
|---|---|
| Issuer-private-key signing of the artifact | **Partially present** — ES256 stack (#203, #204) exists; persistence (TRUST-PERSIST-1) in progress |
| Public-key verification path that any third party can run | **Partial** — verifier code exists; not yet end-to-end persisted |
| Audit row that includes the signature (not just a hash) | **NOT present** — audit rows record `manifestHash` (SHA-256), not signatures |

**Allowed alternative wording:**
- "audit-traceable" — for audit-row evidence.
- "issuer-signed" — ONLY for receipts after TRUST-PERSIST-1 lands AND only for the receipt artifact, NOT for audit rows.
- "tamper-evident given DB integrity" — for hash-based artifacts.

**Pre-existing exception:** the audit-event type literal `'START_ATTESTED'` predates this lexicon. The COMMENT in `apps/api/backend/src/routes/employerActions.ts:798–800` says "non-repudiation event." That string is grandfathered IN CODE COMMENTS but **must not propagate to surfaces this lexicon governs** (PR descriptions, dashboards, UI, marketing). A future wave is welcome to update the comment.

### 1.2 "cryptographically guaranteed"

**Banned by default.** "Guarantee" in cryptographic context implies a security parameter (e.g., 128-bit security against forgery). Marketing or audit language using this phrase implies that level of assurance.

| Required runtime substrate to use this phrase | Status today |
|---|---|
| A specific cryptographic primitive (signature, MAC, encryption) with a documented security parameter | **Partial** — ES256 receipts when persisted; SHA-256 hashes are tamper-EVIDENT, not tamper-PROOF |
| Threat model documenting what is and isn't guaranteed (e.g., "guarantees integrity against attackers without DB write access") | **NOT present** — no per-feature threat-model doc |
| Independent review of the cryptographic implementation | **NOT present** for the platform overall |

**Allowed alternative wording:**
- "hashed" / "hash-checked" — for SHA-256 manifest hashes.
- "signed by issuer" — ONLY for receipts after TRUST-PERSIST-1.
- "tamper-evident given <substrate>" — with the substrate specified.

### 1.3 "replay protected"

**Banned by default.** "Replay protected" implies that replays are prevented at the wire — typically by a cryptographic nonce + server-side state.

| Required runtime substrate to use this phrase | Status today |
|---|---|
| Server-minted, single-use nonce per request | **NOT present** — correlationId is client-supplied (or proxy-generated); not single-use server-minted |
| DB-enforced UNIQUE constraint on `(actor, nonce)` that fires before mutation | **NOT present** — Lock v2 explicitly defers DB UNIQUE to migration wave |
| Capture-replay defense (a captured request cannot be re-issued) | **NOT present** — capture-replay with attacker-chosen correlationId succeeds |

**Allowed alternative wording:**
- "replay observability" — for correlationId clustering in audit metadata.
- "best-effort idempotency check" — for the application-layer duplicate-check.
- "correlationId-deduplicated within 24h" — with the window explicit.
- "DB-enforced replay prevention is deferred to W2-PR2B-MIG-A schema migration" — explicit deferral wording.

**Per Track B of W2-PR2C governance review:** the wave under review uses `correlationId` for replay observability + best-effort dedup. It is NOT replay protection.

### 1.4 "signed mutation"

**Banned by default.** A signed mutation would carry a signature attesting either (a) the actor's authority to mutate (b) the platform's confirmation of the mutation. Neither exists today.

| Required runtime substrate | Status |
|---|---|
| Signature by actor's key OR platform's key, attached to the mutation row | **NOT present** — mutation rows carry `id`, `acceptedAt`, etc.; no signature column |
| Verifier code that validates the signature on read | **NOT present** |
| Public-key infrastructure for signature verification | **NOT present** for mutations (issuer-side PKI is in flight via TRUST-PERSIST-1; not the same PKI) |

**Allowed alternative wording:**
- "audit-coupled mutation" — for mutations with paired audit rows.
- "transactional mutation" — for `prisma.$transaction`-wrapped mutations.
- "actor-attributed mutation" — for mutations with `metadata.actorId` populated.

### 1.5 "tamper-proof"

**Banned by default.** "Tamper-proof" is a stronger claim than "tamper-evident." Proof requires that tampering is impossible, not just detectable.

| Required runtime substrate | Status |
|---|---|
| Append-only ledger with cryptographic chain (e.g., Merkle tree with anchored root) | **PARTIAL** — `AuditEvent.merkleRoot` and `anchored` columns exist (lines 1487–1488 of schema) but anchoring pipeline status not verified by this review |
| External anchor (blockchain, third-party timestamp service) verified at read time | **PARTIAL** — anchoring is the design; live anchoring status unverified |
| Read-side verification that confirms no row has been deleted or modified | **NOT present** — DB ACL is the only protection |

**Allowed alternative wording:**
- "tamper-evident given DB integrity" — for the default state.
- "anchored" — ONLY when the anchoring pipeline is live AND the audit row's `anchored: true`.
- "Merkle-rooted" — ONLY when `merkleRoot` is populated AND verifiable.

**Pre-existing exception:** the schema's `anchored Boolean @default(false)` and `merkleRoot String?` columns are part of the audit-event design. Use of these columns IS allowed; what's banned is the marketing-grade word "tamper-proof" without the columns being populated AND verified.

### 1.6 "trustless"

**Banned by default.** "Trustless" usually means "no trusted third party required." VitalCV is a trusted third party by design — it's a credentialing platform that operators trust to source-back claims.

| Required runtime substrate | Status |
|---|---|
| End-to-end verifiable claims that don't require trusting VitalCV (e.g., W3C Verifiable Credentials with issuer-side keys held by the credentialing authority, not the platform) | **PARTIAL** — VC 2.0 alignment is on the marketing surface; the runtime issuer-signing primitive exists but the platform IS the issuer for some artifacts |
| User-facing verification flow that does not contact VitalCV servers | **NOT present** — verification flows route through VitalCV |

**Allowed alternative wording:**
- "verifiable" — for artifacts that have a documented verification path.
- "issuer-signed" — for receipts under VC 2.0 alignment, post-TRUST-PERSIST-1.
- "third-party-verifiable" — when the verification can be performed without VitalCV's continued availability.

The platform's posture is **trusted intermediary**, not **trustless**. This is honest and accurate; "trustless" wording would falsely position the platform.

### 1.7 "provably secure"

**Banned by default.** "Provably secure" implies a formal security proof against a specific adversary model.

| Required runtime substrate | Status |
|---|---|
| A formal security analysis (paper / proof) for at least one platform mechanism | **NOT present** |
| A bug-bounty / external security-audit posture that surfaces and addresses provability claims | **NOT present** for the platform overall |
| A clear threat model bounding what's "secure" against | **PARTIAL** — `SECURITY_INVARIANTS.md` defines invariants; not a formal proof |

**Allowed alternative wording:**
- "fail-closed under degraded auth" — for the W2-PR1A invariant (verifiable by tests).
- "constant-time compared (Edge-safe)" — for `timingSafeEqualStrings` (verifiable).
- "designed against threat <X>" — when the threat is named and the design is documented.

Empirical claims (e.g., "deny readonly POST," "atomic mutation+audit on these handlers") are testable; they DO NOT require "provable" framing. Use the testable claim directly.

---

## 2. Substrate-allowed phrases (what the platform CAN say today)

These phrases ARE allowed because their runtime substrate exists today.

| Phrase | Substrate |
|---|---|
| **"source-backed"** | Source adapters in `packages/source-adapters` query NPPES, OIG, CMS PECOS |
| **"audit-traceable"** | Every mutation in scope of W2-PR1+ writes an `AuditEvent` row |
| **"transactional audit row"** | `prisma.$transaction` wrap on the four C-1 handlers (accept / refresh / routing / confirm-start) |
| **"role-gated"** | Lock v2 introduces readonly POST denial at proxy + backend |
| **"correlationId-stamped"** | Lock v2 adds `metadata.correlationId` to audit rows |
| **"fail-closed under degraded auth"** | W2-PR1A; verifiable via the 50-case verifier-rbac-enforcement test suite |
| **"namespace-protected"** | `/api/verifier/**` interception in middleware |
| **"constant-time-compared"** | `timingSafeEqualStrings` (Edge-safe TextEncoder XOR) |
| **"tiered observation"** | Confidence tiers in source adapters (T1–T4) |
| **"hash-checked manifest"** | SHA-256 `manifestHash` on packet exports |
| **"per-actor-scoped"** | Today's per-(employerId, clinicianNpi) scope on canonical-path mutations |
| **"deferred to <wave>"** | Use when an aspirational claim is being explicitly deferred (e.g., "per-org tenancy is deferred to W2-PR2B-MIG-C") |

Use these. They are accurate.

---

## 3. Conditional phrases (allowed ONLY with qualifier)

These phrases are allowed but MUST carry their qualifier in the same sentence:

| Phrase | Required qualifier |
|---|---|
| "atomic mutation+audit" | Must be qualified by "for the four `prisma.$transaction`-wrapped handlers (accept / refresh / routing / confirm-start)" — NOT used unqualified for share-packet/packet which are single-row tx wraps |
| "tamper-evident" | Must be qualified by "given DB integrity" or "given <substrate>" — never used standalone |
| "issuer-signed" | Must be qualified to refer to a specific artifact (receipt) AND only after TRUST-PERSIST-1 lands |
| "audit-coupled" | Must clarify "permitted-path AND denied-path emission" if both are claimed |
| "replay observability" | Must clarify "via correlationId clustering" — NOT shortened to "replay" alone |

These qualifiers prevent shortened forms from drifting into the forbidden phrases of §1.

---

## 4. Audit-row label discipline

The `metadata.action` literal in audit rows is **a surface** that this lexicon governs. The literal flows into forensic queries, dashboards, and downstream consumers. The discipline:

| Allowed format | Example |
|---|---|
| `<domain>.<verb>` for permitted | `'employer_review.accept'` |
| `<domain>.<verb>.<reason>` for denied | `'employer_review.accept.cross_tenant'` (when ownership lands; today: `'employer_review.accept.role_denied'`) |
| `<domain>.<verb>.<idempotency_signal>` for dedup | `'employer_review.accept.duplicate_request'` |

| Forbidden in literals | Why |
|---|---|
| `signed_*` | Implies signing |
| `verified_*` | Banned per CLAUDE.md |
| `non_repudiable_*` | Per §1.1 |
| `proven_*` | Per §1.7 |
| `secured_*` | Same |
| `cryptographic_*` | Per §1.2 |

Existing literals containing `START_ATTESTED` predate this lexicon and are grandfathered as event-type literals (vs. action-reason suffixes). Future event types must conform.

---

## 5. UI / marketing alignment rule

The marketing surface (vitalcv.com extracted on 2026-05-08) contains aspirational claims:

- "cryptographically-signed snapshot"
- "T4 · Issuer-signed"
- "Audit-ready receipts"

These are NOT the runtime's voice; they are the marketing surface's voice. The platform's *runtime* surface MUST use this lexicon. The marketing surface is a separate concern and is governed by:

1. CLAUDE.md banned-strings list (already in force).
2. Future "marketing-claim alignment review" wave (not this wave; tracked as deferred).

**This lexicon does NOT veto the marketing surface.** It governs the platform-internal trust language: the language the runtime, audit table, dashboards, PR descriptions, and code surfaces use.

---

## 6. Enforcement

This lexicon is enforced at:

| Enforcement point | What is checked |
|---|---|
| **PR description / commit messages** | Codex SAFE audit prompt scans for §1 phrases (without the substrate) |
| **Audit-row literal labels** | Schema doc + code-review check |
| **Dashboard copy / admin UI** | Reviewer pass on each new dashboard |
| **Documentation in `docs/ops/**`** | Reviewer pass on each new doc |
| **Code comments** | Allowed grandfathering for existing comments; new comments must conform |

A PR that introduces any §1 phrase without the substrate, OR introduces a §3 phrase without the qualifier, is rejected at review.

---

## 7. Update history

| Date | Change | Wave |
|---|---|---|
| 2026-05-08 | Lexicon established | W2-PR3B governance |

Future updates land via the Update Protocol (top of doc).

---

## 8. Closing principle

A platform's trust language is its public contract. Words like "non-repudiable," "tamper-proof," "trustless," "replay-protected" carry technical and regulatory weight beyond casual use. Using them without the substrate is **instrumentation theater** — saying the platform is more than it is.

This lexicon is the discipline of refusing to inflate. Every phrase it forbids has an alternative that says exactly what is true. Every phrase it allows is verifiable.

**The platform is what the lexicon allows it to claim — no more, no less. When the runtime grows, the lexicon grows with it. When the lexicon grows, founder + Codex SAFE confirm the substrate exists.**
