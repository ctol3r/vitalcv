# W2-PR2C — Runtime Truth Boundary (Track A)

**Wave:** Wave 2, PR 2C — adversarial legitimacy governance · **Date:** 2026-05-08 · **Status:** governance review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** adversarial systems architect / trust-boundary reviewer · **Authority:** subordinate to `MUTATION_GATE_SEQUENCE.md`, `OWNERSHIP_INVARIANTS.md`, `AUTHORIZATION_BASELINE_V1.md`, `w2-pr2b-implementation-lock-v2.md`

This doc draws the **runtime truth boundary** — the line between what the platform actually guarantees and what its instrumentation, marketing, and lock v2 contract might *imply* it guarantees. It is the adversarial counterpart to Lock v2's stable-guarantees list.

**Review-input gap declared up front:** the prompt's listed artifact bundle (`VitalCV.html`, `Wave Operating Stack.html`, `PR-B Crypto Receipt Verifier Decision.html`, `data-autopilot*.jsx`, `data-dossier*.jsx`, `data-inbox*.jsx`, `confidence.jsx`, `app.jsx`, `components-shared.jsx`) is **NOT actually attached** to this conversation. This review is bounded to the runtime worktree (`/tmp/vitalcv-w2pr2b`), the doctrine docs already in PR #277, and the live vitalcv.com surface. The missing artifacts are themselves a governance finding (see `w2-pr2c-legitimacy-risk-register.md` R0).

---

## 1. The four-tier truth taxonomy

A platform claim falls into one of four tiers. The boundary between Tier-2 and Tier-3 is where adversarial review focuses — that is where instrumentation theater lives.

| Tier | Definition | Verifiable how |
|---|---|---|
| **T1 — Actual runtime guarantee** | A property the runtime enforces today; a violation is observable as a 4xx/5xx wire OR an audit row that contradicts the claim | Code inspection + automated test |
| **T2 — Operational invariant the wave depends on** | A property NOT enforced by code but assumed by the wave (e.g., deployment topology) | Topology audit |
| **T3 — Aspirational guarantee** | A property the wave INTENDS to deliver but the current implementation does not yet enforce | Schema + diff inspection |
| **T4 — Unsafe implied guarantee** | A property the marketing / lock v2 / instrumentation language could be read as promising but neither runtime, topology, nor implementation provides | Adversarial paraphrase test |

The wave's safety is bounded by how rigorously it keeps T2/T3/T4 separate from T1.

---

## 2. T1 — Actual runtime guarantees (post-Lock v2)

These properties hold today on `origin/main` after W2-PR1A merged at `caa01cd9`. Lock v2 preserves and extends them; it does NOT introduce them.

| Guarantee | Source | Evidence |
|---|---|---|
| **G-T1.1** Degraded auth fails closed on `/api/verifier/**` | W2-PR1A merged | `apps/web/middleware.ts` Step-0; `__tests__/verifier-rbac-enforcement.test.ts` (50 cases) |
| **G-T1.2** Verifier API namespace never becomes public | W2-PR1A merged | `isVerifierApiRoute` namespace predicate |
| **G-T1.3** Cross-org access on `/api/verifier/**` returns 404 | W2-PR1A merged | `cross-org access returns 404` suite |
| **G-T1.4** Constant-time org-id compare (Edge-safe) | W2-PR1A merged | `timingSafeEqualStrings` test suite |
| **G-T1.5** Atomic mutation+audit in `prisma.$transaction` for accept / refresh / routing / confirm-start | Existing `recordEmployerReview*` + `confirm-start` inline tx | `apps/api/backend/src/services/entity/employerReviewActions.ts:738/846/927`; `apps/api/backend/src/routes/employerActions.ts:863` |
| **G-T1.6** Body validation on web layer rejects unknown keys | W2-PR1 / earlier | `parseAcceptBody`, `parseRefreshBody`, etc. (lines 113–275) |
| **G-T1.7** Web layer requires Clerk session for AUTHENTICATED_MUTATION_ACTIONS | W2-PR1 | `auth()` line 362 |
| **G-T1.8** `EmployerAcceptance` duplicate-check fires before insert | Existing | `routes/employerActions.ts:175` (caveat: TOCTOU; see §4) |

Lock v2 adds:

| Guarantee | Source | Evidence (planned) |
|---|---|---|
| **G-T1.9** Readonly POST denied at proxy AND backend | Lock v2 §3, §6 | New helper `employerReviewLegitimacyGate.ts`; backend reads `x-vitalcv-team-role` |
| **G-T1.10** correlationId echoed in proxy response header `x-correlation-id` | Lock v2 §3 | Proxy stamping |
| **G-T1.11** Single-row `prisma.$transaction` wrap on `share-packet` and `packet` audit writes | Lock v2 §6 | Wrap existing standalone audit insert |
| **G-T1.12** Denied-path audit row on `entity_not_found`, `role_denied`, `no_org_context`, etc. | Lock v2 §8, §9 | New denied-path emission |

These are the T1 guarantees a SOC analyst or merge reviewer can reasonably rely on. Anything beyond this list is T2 or below.

---

## 3. T2 — Operational invariants the wave depends on

These properties are NOT enforced by code in this wave. Lock v2 §10 codifies them. A breach of any T2 invariant collapses one or more T1 guarantees.

| T2 invariant | Consequence of breach |
|---|---|
| Backend reachable ONLY by web proxy (VPC-locked, IP-allowlisted) | A direct backend caller forges `x-clerk-user-id` and impersonates any user; G-T1.7, G-T1.9 collapse |
| `x-clerk-user-id` set ONLY by proxy from validated JWT | Header injection makes actor attribution arbitrary |
| `x-vitalcv-team-role` set ONLY by proxy from validated JWT | Role gate at backend becomes attacker-controlled; G-T1.9's defense-in-depth becomes single-point |
| `x-correlation-id` validated as UUID format by proxy | Replay key becomes attacker-chosen; idempotency surface narrows |
| Clerk JWT validation continues at web middleware | Any forged JWT propagates forged `userId` + `team_role` downstream |

**Adversarial finding T2-A:** the wave introduces NEW headers (`x-vitalcv-team-role`, `x-correlation-id`) but does NOT introduce signing or HMAC on the inter-tier hop. The web→backend trust is implicit (network topology). If this topology assumption ever breaks (e.g., backend exposed via a misconfigured ingress), every T2 invariant collapses simultaneously. There is no in-code defense.

This is acceptable IF the topology assumption is documented in deployment runbooks AND verified at deploy time. Lock v2 §10 documents it. The runbook update is OUT OF SCOPE for the implementation PR — flagged here as a deploy-time gate.

---

## 4. T3 — Aspirational guarantees in Lock v2's wording

These are properties Lock v2's wording could be read as promising but where the implementation will NOT fully deliver them. They are not deceptive — they are incrementally true (better than v1 but not absolute).

### 4.1 "Replay resistance"

**Lock v2 wording (§7):** "Replay resistance via correlationId UNIQUE per `(actorId, 24h)`."

**Adversarial paraphrase:** "if I replay the same request, the platform refuses the second one."

**Runtime reality:** the implementation is expected to query `AuditEvent` (or the metadata-keyed lookup) for an existing `(actorId, correlationId)` row before inserting. This is **TOCTOU** — between the read and the write, a concurrent retry can pass the check. There is no DB-level UNIQUE constraint on `(metadata.correlationId, actorId)` because the lock forbids schema migration. Lock v2 §6 also declines to add such a constraint.

The honest framing: **best-effort replay observability + best-effort application-layer dedup**. NOT "replay resistance" in the cryptographic / DB-enforced sense.

| What the lock says | What the runtime delivers |
|---|---|
| "Replay resistance" | Replay *observability*: same `(actorId, correlationId)` produces a denied audit row that a SOC analyst can cluster |
| "409 duplicate_request" | Best-effort 409 — TOCTOU race exists |
| Test §7.4 asserts "duplicate `(actorId, correlationId, 24h)` returns 409 + writes NO new audit row" | This holds in single-threaded test; under concurrent retry, the second insert may sneak through if no DB unique anchor |

**Lock v2 wording fix (recommended):** "Replay observability + best-effort idempotency check. DB-enforced replay prevention is deferred to the future migration wave."

### 4.2 "Mutation legitimacy hardening"

**Lock v2 wording (§1):** "Mutation Legitimacy Hardening (employer-review)."

**Adversarial paraphrase:** "the platform now ensures every mutation is legitimate."

**Runtime reality:** the wave does NOT make mutations legitimate. It tightens input validation, adds replay observability, denies readonly POST at two layers, and couples audit writes atomically. A mutation is "legitimate" in the sense that *the actor was Clerk-authenticated and not readonly* — not in the sense that the actor has actual authority over the resource (per-org tenancy is deferred).

The honest framing: **input legitimacy + actor legitimacy + audit-coupling integrity**. NOT "mutation legitimacy" without qualification.

The term "legitimacy" itself is overloaded. In governance language, a "legitimate" decision usually means "the decider had authority." In this wave, "legitimate" means "the request was well-formed and the actor was authenticated." Reviewer should ensure the implementation PR + commit messages do not conflate these.

### 4.3 "Atomic mutation+audit"

**Lock v2 wording (§6, §8):** "wrap audit insert in `prisma.$transaction((tx) => ...)` — single-write tx is acceptable — establishes the contract that share-packet's audit row is the persistent record AND is rollback-safe."

**Adversarial paraphrase (for share-packet / packet):** "atomic mutation and audit guarantee that you never see an audit row without a paired mutation."

**Runtime reality:** for `share-packet` and `packet`, the audit row IS the persistent record — there is NO companion mutation row. Wrapping a single audit insert in `prisma.$transaction` is **cosmetic atomicity** in functional terms: there is nothing to roll back besides the single insert that already has all-or-nothing semantics from the database itself. The wrap does not deliver "rollback-safe" beyond what `prisma.auditEvent.create` already delivers.

The wrap MAY be useful as a code-uniformity contract (every audit-emitting handler uses `prisma.$transaction`), but the GUARANTEE the wrap implies (atomic-with-mutation) does not exist for these branches because no mutation companion exists.

**Lock v2 wording fix (recommended):** "For share-packet and packet, the wave establishes a `prisma.$transaction` wrap as a code-uniformity contract. The underlying single-insert atomicity is unchanged; this is NOT an additional rollback guarantee."

### 4.4 "Defense in depth" role gate at backend

**Lock v2 wording (§3, reconciliation §3.4):** "The backend rejects readonly POST early with 403 + denied audit row. The web layer also rejects readonly POST. Both layers enforce the same rule. Defense in depth means: a misconfigured proxy that fails to deny readonly does not produce a successful mutation; the backend would still deny."

**Adversarial paraphrase:** "if the proxy fails to deny readonly, the backend will catch it."

**Runtime reality:** the backend's readonly check reads `x-vitalcv-team-role` — a header **set by the proxy**. If the proxy fails to set the header correctly (e.g., a regression that forwards "admin" for everyone), the backend has no independent path to discover the JWT-actual `team_role`. The "defense in depth" becomes "defense in same-depth" because both layers consult the same proxy-derived signal.

True defense in depth would require the backend to independently verify the JWT (deferred per Lock v2 §10). What the wave delivers is **redundancy of code path**, NOT **redundancy of trust signal**.

**Lock v2 wording fix (recommended):** "Defense-in-depth code paths: both layers contain readonly-denial code; both layers consult the same proxy-derived team_role signal. True trust-signal redundancy requires backend JWT verification (deferred)."

---

## 5. T4 — Unsafe implied guarantees the wave must explicitly disclaim

These are the guarantees an external observer (marketing, customer, journalist, regulator) might infer from the wave's instrumentation that the runtime does NOT deliver. They are the riskiest category because they leak through copy, dashboards, audit-row labels, and PR descriptions.

### 5.1 "Tenant isolation"

A reader who sees "mutation legitimacy hardening on employer-review" may infer "tenants are isolated." They are NOT. v2 is per-actor-scoped; cross-tenant 404 is deferred. Two users in different orgs can both accept the same clinician.

**Disclaimer required:** any marketing copy, dashboard label, or PR description that emerges from this wave MUST NOT use the word "tenant," "organization-scoped," or "cross-tenant protected." The wave does not deliver these.

### 5.2 "Audit-coupled denial"

A reader who sees "every denied attempt writes a denied audit row" may infer "we have full forensics on probing." Lock v2 §8 covers permitted + denied paths after auth, but **denials at Step 1 (no auth at all)** intentionally write NO audit row — there is no actor to record. A probe that doesn't authenticate is invisible to audit forensics.

**Disclaimer required:** denial-path audit visibility starts at Step 2 (auth-present). Pre-auth probing is bounded by web-layer logs only, not audit rows.

### 5.3 "Replay-resistant"

Per §4.1 above. If the implementation PR's commit message, README, or audit-coupling doc says "replay-resistant," the wording inflates beyond the runtime. Best-effort observability is the truth.

### 5.4 "Issuer-signed receipts"

vitalcv.com surface (extracted from live site): "T4 · Issuer-signed: Cryptographically signed by the issuing authority" and "Board-issued VC 2.0 receipt."

The runtime reality (per the memory note `pr_b_crypto_decision.md` and TRUST-PERSIST-1 in progress): the ES256 stack landed (#203, #204) but persistence (TRUST-PERSIST-1) is in progress. **Issuer-signed receipts exist as a primitive but are not yet persisted end-to-end.** A buyer reading the marketing surface today may believe every receipt is issuer-signed; the runtime is incrementally true on this claim.

**This is not W2-PR2C's wave to fix**, but it is a T4 risk that intersects: if W2-PR2C's `share-packet` + `packet` audit-coupling work is described as "now produces signed audit-coupled receipts," the language inflates. The audit row contains a `manifestHash` (SHA-256), NOT an issuer signature.

**Disclaimer required:** any PR description, audit-row label, or downstream UI surface that describes share-packet output as "signed" or "issuer-signed" is inflated. The token is random; the manifest is hashed; the issuer signature is a separate concern handled by the receipt persistence wave.

### 5.5 "Authoritative actor attribution"

A reader who sees `audit.metadata.actorId = userId` may infer "we know who acted." The runtime knows **who the proxy says acted**. If the proxy or the topology is breached (per §3 T2-A), the actor attribution becomes "whoever the breach controlled." The audit row does not contain a JWT signature, a re-verification artifact, or a proof-of-possession.

**Disclaimer required:** actor attribution is bounded by the proxy's correctness + the deployment topology. It is NOT cryptographically attributable in the wave's v2 form.

### 5.6 "Cryptographically-signed snapshot" (marketing → wave alignment)

vitalcv.com: "Share a cryptographically-signed snapshot with any employer, CVO, or locum tenens partner."

This claim is partially true — the manifest has a SHA-256 hash, and the future TRUST-PERSIST-1 introduces issuer-signed receipts. But **share-packet today writes only a 128-bit-ish random token** (no signature; no proof-of-possession), and the audit row's `manifestHash` is a hash, not a signature.

If the parallel implementation PR's surface communicates that its "audit coupling" produces a signed snapshot, that is inflation against this marketing claim. Audit rows are tamper-evident *given DB integrity*; they are not cryptographically signed by the platform.

**Wave-bounded disclaimer:** W2-PR2C does NOT add cryptographic signatures to any artifact. It adds correlation IDs, audit-coupling code, and replay observability. Any "signed" framing in W2-PR2C's PR description is unsafe.

---

## 6. The four-tier mapping for Lock v2's commitments

Each Lock v2 §1 commitment, classified:

| Lock v2 commitment | Tier | Adversarial concern |
|---|---|---|
| Wave name "Mutation Legitimacy Hardening" | T3 → T4 leak risk | "Legitimacy" overloaded — see §4.2 |
| Cross-tenant returns 404 | T3 (deferred) | Lock v2 explicitly defers; safe |
| Replay resistance via correlationId | T3 → T4 leak risk | "Resistance" inflates — see §4.1 |
| Atomic mutation+audit | T1 (for accept/refresh/routing/confirm-start) ; T3 → T4 leak risk for share-packet/packet | See §4.3 |
| Readonly cannot mutate | T1 (web layer) + T2-dependent (backend) | Defense-in-depth language inflates — see §4.4 |
| Forbidden-input discard | T1 | Genuine guarantee |
| Fail-closed mutation semantics | T1 | Genuine; preserved from W2-PR1A |
| Frozen blast radius | T1 | Verifiable via diff |
| `tenantId` in audit row | T3 (deferred) | Lock v2 explicitly NULL; safe |
| Defense in depth role gate | T1 (code path) + T2-dependent (signal) | See §4.4 |

The pattern: 5 of 10 commitments have T3→T4 leak risk via wording. None has a T4 leak that the lock itself enables — the leaks are at the level of "if the implementation PR or downstream surface uses inflated wording." This is a **language discipline** problem, not an architecture problem.

---

## 7. Adversarial findings (Track A)

| # | Finding | Severity |
|---|---|---|
| **A-1** | "Replay resistance" wording inflates beyond best-effort observability | MEDIUM |
| **A-2** | "Mutation legitimacy" wording inflates beyond input/actor validation + audit coupling | MEDIUM |
| **A-3** | "Atomic mutation+audit" wording for share-packet/packet inflates a single-insert wrap into a multi-write atomicity guarantee | LOW (cosmetic) |
| **A-4** | "Defense in depth" wording inflates code-path redundancy into trust-signal redundancy | MEDIUM |
| **A-5** | Pre-auth probing is invisible to audit forensics; if surface implies otherwise, T4 leak | MEDIUM |
| **A-6** | Marketing "cryptographically-signed snapshot" intersects with share-packet wording; T4 risk if conflated | HIGH |
| **A-7** | Marketing "T4 · Issuer-signed" is incrementally true (TRUST-PERSIST-1 in progress); audit-coupling work must not claim signing | HIGH |
| **A-8** | Actor attribution is proxy-bounded, not cryptographic; if any UI/audit surface implies otherwise, T4 leak | MEDIUM |
| **A-9** | Stable-guarantees list in `AUTHORIZATION_BASELINE_V1.md` should be re-examined for any of the §4 inflations after Lock v2 ships | MEDIUM |
| **A-10** | Missing artifact bundle (the listed `*.html` and `*.jsx` files) means review of the dossier/autopilot/inbox UI surface is **not possible** in this conversation; review is incomplete on UI-runtime alignment | HIGH |

---

## 8. Closing principle

The runtime truth boundary is the line between "what we enforce" and "what we instrument." Lock v2 does important work on the enforce side. Its risk is on the language side: words like "resistance," "legitimacy," "atomic," and "defense in depth" carry weight in governance contexts that exceeds what the runtime delivers.

**The wave is safe IF the implementation PR's commit messages, audit-row labels, dashboard copy, and downstream UI surfaces use the strict T1 framing — and explicitly disclaim T2/T3/T4 wording that the lock's contract terminology might invite.**

This boundary is enforced by reviewers. The wave's safety is co-extensive with the discipline of its describers.
