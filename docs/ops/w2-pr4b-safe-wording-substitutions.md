# W2-PR4B — Safe Wording Substitutions

**Wave:** Wave 2, PR 4B — trust language enforcement, substitution table · **Date:** 2026-05-08 · **Status:** lookup table only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` and `w2-pr4b-trust-language-enforcement.md`

This doc is the **substitution table**: when an author wants to express trust-language intent X, this table provides the lexicon-aligned wording. It is the practical companion to the lexicon and the detection register — designed for an author looking up "how do I say this safely?"

The table is grouped by intent. Each entry has:

- **Tempting (forbidden) wording** — the phrase the author may instinctively reach for.
- **Safe substitution** — what to say instead.
- **Substrate that would make the tempting wording allowed** — what would have to ship before the forbidden phrase becomes safe.

---

## 1. Audit and traceability intents

### 1.1 "I want to say the audit log records every action."

| Tempting | Safe substitution |
|---|---|
| "non-repudiable audit log" | **"audit-traceable mutations"** OR **"every mutation in scope writes a paired audit row in the same Prisma transaction"** |
| "tamper-proof audit trail" | **"tamper-evident audit row given DB integrity"** OR **"hash-checked audit row (SHA-256 of canonical content)"** |
| "cryptographic audit trail" | **"transactional audit row"** OR **"audit-coupled mutation record"** |
| "Merkle audit trail" | **"audit row with `merkleRoot` populated when anchored"** (only if anchoring pipeline is verified live) |
| "irreversible proof" | **"audit-traceable record"** OR **"hash-checked record (tamper-evident given DB integrity)"** |

**Substrate that would unlock the tempting wording:**

- For `tamper-proof` / `tamper-evident across DB compromise`: live external anchoring pipeline producing `anchored: true` rows with verifiable `merkleRoot`. Status today: schema columns exist; live pipeline coverage for in-scope event types unverified per `w2-pr3b-audit-strength-review.md` AS-2.
- For `non-repudiable`: actor-side cryptographic key + proof-of-possession + per-row signature. Status today: absent. Deferred indefinitely.

### 1.2 "I want to say the platform records who acted."

| Tempting | Safe substitution |
|---|---|
| "non-repudiable actor attribution" | **"audit-traceable actor attribution (proxy-derived from JWT)"** |
| "cryptographically attested actor" | **"actor-id-stamped audit row"** OR **"`metadata.actorId` populated from `requireClerkUserId(req)`"** |
| "signed-by-actor mutation" | **"actor-attributed mutation"** |
| "verified actor signature" | **"proxy-attributed actor identity"** |

**Substrate:** L4 / L5 in `w2-pr3b-audit-strength-review.md` taxonomy. Absent today.

### 1.3 "I want to say the audit row contains the request payload."

| Tempting | Safe substitution |
|---|---|
| "audit row preserves the signed request" | **"audit row records `metadata.payloadHash` (SHA-256 of redacted body)"** |
| "non-repudiable request capture" | **"hash-checked request fingerprint in audit metadata"** |
| "cryptographic request log" | **"hash-checked audit row with payloadHash"** |

---

## 2. Replay and idempotency intents

### 2.1 "I want to say the platform refuses duplicate requests."

| Tempting | Safe substitution |
|---|---|
| "replay-protected mutations" | **"replay observability + best-effort idempotency check via correlationId"** |
| "replay-resistant" | **"correlationId-deduplicated within 24h (best-effort; DB UNIQUE deferred)"** |
| "guaranteed dedup" | **"best-effort dedup against `(actorId, correlationId)` within 24h window"** |
| "atomic idempotency" | **"correlationId-stamped audit row with application-layer dedup check"** |
| "single-flight enforcement" | **"correlationId-deduplicated"** |

**Substrate that would unlock the tempting wording:**

- For `replay-protected`: server-minted nonce (single-use) + DB-enforced UNIQUE on `(actor, nonce)`. Status: deferred to `W2-PR2B-MIG-A` schema migration.
- For `guaranteed dedup`: same — DB-enforced uniqueness eliminates the TOCTOU race that today's application-layer check has.

### 2.2 "I want to say correlationId is on every audit row."

| Tempting | Safe substitution |
|---|---|
| "correlation-traceable mutations" | **"`metadata.correlationId`-stamped audit rows on permitted AND denied paths"** (use the explicit field name) |
| "request fingerprinted" | **"correlationId-clustered for forensic queries"** |

These are **safe today** as written.

### 2.3 "I want to say capture-and-replay attacks are mitigated."

| Tempting | Safe substitution |
|---|---|
| "capture-replay protected" | **(do not claim this)** — wave does not defend against capture-replay |
| "attack-resistant" | **(do not claim this)** |
| "replay-secure" | **(do not claim this)** |

**Honest framing:** "the wave does NOT defend against capture-replay where an attacker controls the correlationId. Forensic detection is possible via `metadata.payloadHash` clustering; prevention requires DB-enforced anchors deferred to migration wave."

---

## 3. Mutation legitimacy intents

### 3.1 "I want to say mutations are legitimate."

| Tempting | Safe substitution |
|---|---|
| "legitimate mutations" (unqualified) | **"input-validated + actor-authenticated + audit-coupled mutations"** OR **"role-gated mutations"** |
| "authoritative mutations" | **"actor-attributed mutations"** |
| "guaranteed valid" | **"input-validated"** |
| "verified mutation" | **"recorded mutation"** OR **"audit-coupled mutation"** (`verified` is banned per CLAUDE.md) |

**Substrate that would unlock "authoritative":** per-org tenancy enforcement (Layer 3 ownership). Deferred to `W2-PR2B-MIG-C`.

### 3.2 "I want to say readonly users cannot mutate."

| Tempting | Safe substitution |
|---|---|
| "non-mutable for readonly" | **"`readonly` POST denied at proxy AND backend (defense-in-depth code paths)"** |
| "read-only enforcement" | **"role-gated mutations: `readonly` users return 403 + denied audit row"** |
| "read-only secured" | **"role-gated"** |

These are **safe today** as written (post-Lock-v2).

---

## 4. Atomicity intents

### 4.1 "I want to say mutation and audit commit together."

| Tempting | Safe substitution |
|---|---|
| "atomic mutation+audit" (unqualified) | **"atomic mutation+audit for the four `prisma.$transaction`-wrapped handlers (accept / request-refresh / route-to-review / confirm-start)"** — must carry the qualifier |
| "transactional integrity" | **"both rows commit or both roll back"** |
| "all-or-nothing semantics" | **"atomic within `prisma.$transaction` for the four C-1 handlers"** (qualified) |
| "guaranteed coupling" | **"transactional coupling for C-1 handlers; single-row tx wrap (uniform code, no additional rollback) for C-2 handlers (`share-packet`, `packet`)"** |

### 4.2 "I want to describe share-packet's audit-as-persistence pattern."

| Tempting | Safe substitution |
|---|---|
| "atomic share-packet audit" | **"single-row `prisma.$transaction` wrap for code uniformity; the audit row IS the persistent share record (no companion mutation row to be atomic with)"** |
| "rollback-safe share token" | **"audit insert succeeds or returns 5xx; the persistent record is the audit row itself"** |

---

## 5. Cryptography and signing intents

### 5.1 "I want to say the share-packet token is unforgeable."

| Tempting | Safe substitution |
|---|---|
| "cryptographically signed share" | **"share token is randomly generated (~128 bits entropy) and bound to `(entityId, employerId)` with TTL"** |
| "tamper-proof share link" | **"single-use share token with expiry; downstream resolution checks token hash against audit row"** |
| "secured share" | **"token-bound share with `SHARE_TOKEN_TTL_MS` expiry"** |

**Substrate that would unlock "cryptographically signed":** issuer-private-key signing of the share artifact (NOT the same as ES256 receipt signing). Status: not on the roadmap.

### 5.2 "I want to say packets are signed."

| Tempting | Safe substitution |
|---|---|
| "cryptographically signed snapshot" (matches marketing surface) | **(do not echo into PR descriptions or audit-row labels)** — per `TRUST_GUARANTEE_LEXICON.md` §1.2; marketing claim is governed separately |
| "issuer-signed receipt" | **(only after TRUST-PERSIST-1 lands AND only for the receipt artifact, NOT for audit rows or share artifacts)** |
| "VC 2.0 receipt" | **(same as above)** |

### 5.3 "I want to say the manifest hash provides integrity."

| Tempting | Safe substitution |
|---|---|
| "cryptographically guaranteed manifest" | **"hash-checked manifest (SHA-256)"** OR **"manifest integrity verifiable via `manifestHash`"** |
| "signed manifest" | **"hash-checked manifest"** |
| "tamper-proof manifest" | **"tamper-evident manifest given DB integrity"** |

---

## 6. Trust-tier intents

### 6.1 "I want to say T4 confidence is the highest."

| Tempting | Safe substitution |
|---|---|
| "T4 verified" | **"T4 source-confirmed at <timestamp>"** OR **"T4 issuer-signed (post-TRUST-PERSIST-1)"** — explicit |
| "T4 cryptographically attested" | **"T4 issuer-signed (after TRUST-PERSIST-1 lands)"** OR **"T4 source-confirmed"** |
| "trustless T4" | **(do not claim this)** — platform is a trusted intermediary |

### 6.2 "I want to say tiers are reliable."

| Tempting | Safe substitution |
|---|---|
| "guaranteed tier accuracy" | **"tier reflects source-state at <timestamp>; refreshes on source re-check"** |
| "verified tier" | **"tier derived from source observation"** |

---

## 7. Confidence and decision intents

### 7.1 "I want to say the autopilot recommendation is reliable."

| Tempting | Safe substitution |
|---|---|
| "autopilot decision" | **"autopilot suggestion"** OR **"autopilot ranking"** — never "decision" (the actor's click is the decision) |
| "auto-verified candidate" | **"highlighted candidate"** OR **"top-ranked by recommender"** |
| "autopilot-attested" | **"autopilot-suggested"** |

### 7.2 "I want to say the dossier is comprehensive."

| Tempting | Safe substitution |
|---|---|
| "complete dossier" | **(banned per CLAUDE.md)** — use **"current source-backed snapshot"** |
| "verified dossier" | **(`verified` banned per CLAUDE.md)** — use **"source-confirmed at <timestamp>"** |
| "guaranteed dossier" | **"source-backed dossier (sources refreshed per cadence)"** |

---

## 8. Compliance intents

### 8.1 "I want to say we comply with X."

| Tempting | Safe substitution |
|---|---|
| "HIPAA compliant" | **(banned per CLAUDE.md)** — use **"HIPAA-aligned design intent (within roadmap context)"** OR omit |
| "SOC 2 certified" | **(banned per CLAUDE.md)** — omit |
| "NCQA verified" | **(banned per claims matrix)** — use **"NCQA CR §3 alignment in design"** |
| "fully audit-compliant" | **"audit-traceable mutations (L1+L2 per audit-strength taxonomy)"** |
| "certified secure" | **(banned)** — omit |
| "regulatorily proven" | **(banned)** — omit |

### 8.2 "I want to say we conform to W3C VC 2.0."

| Tempting | Safe substitution |
|---|---|
| "W3C VC issued" | **"W3C VC-compatible architecture (planned per claims matrix)"** OR **"VC 2.0-aligned design"** |
| "VC 2.0 receipt" | **"VC 2.0-aligned receipt schema"** — do not claim "issued" until TRUST-PERSIST-1 |

---

## 9. Authorization intents

### 9.1 "I want to say we enforce ownership."

| Tempting | Safe substitution |
|---|---|
| "tenant-isolated" | **(do not claim today)** — use **"per-actor scoped"** OR **"middleware-namespace-protected (`/api/verifier/**`)"** depending on which scope |
| "ownership-enforced" | **(do not claim today for employer-review)** — use **"actor-scoped (Clerk userId)"** OR **"role-gated"** |
| "organization-scoped" | **(do not claim today)** — deferred to `W2-PR2B-MIG-C` |
| "cross-tenant 404 enforced" | **(do not claim today for employer-review)** — only true for `/api/verifier/**` per W2-PR1A |

### 9.2 "I want to say RBAC is in place."

| Tempting | Safe substitution |
|---|---|
| "fully RBAC-enforced" | **"RBAC primitives + per-action role gate (admin+ for accept/confirm-start; member+ for others)"** |
| "role-secured" | **"role-gated mutations"** |
| "permission-verified" | **"role-checked"** |

These are **safe today** (post-Lock-v2).

---

## 10. Failure-mode intents

### 10.1 "I want to say the platform fails closed."

| Tempting | Safe substitution |
|---|---|
| "guaranteed fail-closed" | **"fail-closed under degraded auth (verifiable via the 50-case verifier-rbac-enforcement test suite)"** |
| "secure-by-default" | **"deny-by-default at the verifier API namespace"** |
| "always-secure" | **(do not claim this)** — use the testable property directly |

These are **safe today** (post-W2-PR1A) when paired with the substrate reference.

### 10.2 "I want to say degraded auth never widens capability."

| Tempting | Safe substitution |
|---|---|
| "degraded-auth secure" | **"degraded auth never widens capability (per AUTHORIZATION_BASELINE_V1.md §4.3)"** |
| "graceful degradation" | **"503 with `x-rbac-fail-closed` header on Clerk degradation"** |

---

## 11. Quick-reference cheat sheet

For authors in a hurry — most common intents and their safe substitutions:

| If you want to say… | Say this instead |
|---|---|
| "non-repudiable" | **"audit-traceable; tamper-evident given DB integrity"** |
| "cryptographically guaranteed" | **"hash-checked"** OR **"signed by issuer (only post-TRUST-PERSIST-1)"** |
| "replay protected" | **"replay observability + best-effort idempotency check via correlationId"** |
| "signed mutation" | **"audit-coupled mutation"** OR **"transactional mutation"** |
| "tamper-proof" | **"tamper-evident given DB integrity"** OR **"anchored (only when verifiable)"** |
| "trustless" | **"verifiable"** OR **"third-party-verifiable (where substrate)"** |
| "provably secure" | **(use the testable property directly: e.g., "fail-closed under degraded auth")** |
| "verified mutation" | **"recorded mutation"** (CLAUDE.md bans bare `verified`) |
| "complete credentialing" | **(banned per CLAUDE.md)** |
| "atomic mutation+audit" (unqualified) | **"atomic mutation+audit for the four C-1 handlers"** (must carry qualifier) |
| "tenant isolation" | **(do not claim today)** — use **"per-actor scoped"** OR **"middleware-namespace-protected"** |
| "ownership enforcement" | **(do not claim today for employer-review)** — use **"role-gated; tenant ownership deferred"** |

---

## 12. Closing principle (substitutions)

A substitution table is the practical bridge between the lexicon (rule) and the detection register (where rule violations live). It is the artifact an author actually consults when writing.

Every entry above expresses TRUE intent in lexicon-aligned wording. None requires a substrate the platform doesn't have. Where the safe substitution is "do not claim this," that is itself a valid answer — silence is honest when no truthful claim exists.

**The author's contract: when in doubt, omit. When in haste, look up. When committing the word: verify the substrate.** This table makes verification trivial.
