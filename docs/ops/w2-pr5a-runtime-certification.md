# W2-PR5A — Runtime Certification (Track A: Mutation Attribution)

**Wave:** Wave 2, PR 5A — runtime legitimacy certification, attribution track · **Date:** 2026-05-08 · **Status:** certification analysis only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** runtime trust certifier / mutation-attribution certifier · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `AUTHORIZATION_BASELINE_V1.md`, `MUTATION_GATE_SEQUENCE.md`; uses `w2-pr2b-runtime-mutation-audit.md` as the empirical substrate

This doc certifies the **mutation attribution** posture of the employer-review surface as observed on `9eb5cdee` (origin/main HEAD) — and separately classifies post-Lock-v2 commitments where Lock v2 is approved but not yet merged.

**Inspection scope (declared honestly):** runtime worktree at `/tmp/vitalcv-w2pr2b`; constitutional doctrine bundle in PR #277; vitalcv.com (extracted earlier); listed artifact bundle (HTML/JSX) NOT actually attached. The parallel implementation diff for Lock v2 is NOT visible to this review. Certification therefore distinguishes `9eb5cdee`-as-merged (CERTIFIABLE today) from Lock-v2-as-described (CERTIFIABLE-IN-CONTRACT, pending implementation review).

---

## 1. Attribution model — what the runtime delivers

The mutation attribution chain on the employer-review surface as it exists today:

```
Clerk JWT (signed by Clerk)
   ↓
Web middleware (W2-PR1A) — validates JWT, extracts session.userId
   ↓
Web route handler (apps/web/app/api/employer-review/[entityId]/[action]/route.ts)
   ↓ forwards `x-clerk-user-id: <userId>` (string header)
   ↓
Backend handler (apps/api/backend/src/routes/employerActions.ts)
   ↓ requireClerkUserId(req) reads `x-clerk-user-id`
   ↓
Service function (recordEmployerReview*) — passes employerId through
   ↓
Persistence: EmployerAcceptance.employerId = <userId>
              AuditEvent.metadata.employerId = <userId>
```

Key facts:

- **Trust anchor:** the Clerk JWT, validated at the web middleware (W2-PR1A).
- **Propagation primitive:** `x-clerk-user-id` HTTP header (proxy → backend).
- **Backend trust posture:** `requireClerkUserId(req)` reads the header and trusts unconditionally — there is NO independent JWT verification on the backend.
- **Persistent attribution column:** `EmployerAcceptance.employerId String?` (= Clerk userId) and `AuditEvent.clinicianId` (= subject NPI; not actor).
- **Authoritative org concept:** **NONE today.** No `tenantId UUID` column on any of the touched tables; the `EmployerAcceptance.organization String` text column is descriptive, not enforcement.

---

## 2. Per-handler attribution (today, on origin/main)

| Handler | Source of `actorId` | Stored where | Derived how |
|---|---|---|---|
| `accept` | `requireClerkUserId(req)` (line 166) | `EmployerAcceptance.employerId`; `AuditEvent.metadata.employerId` | Header `x-clerk-user-id` |
| `confirm-start` | `requireClerkUserId(req)` (line 805) | `StartAttestation.metadata.employerId` (in audit metadata, not row); `AuditEvent.metadata.employerId` | Same |
| `request-refresh` | `requireClerkUserId(req)` (line 304) | `AuditEvent.metadata.employerId` (audit-only persistence) | Same |
| `route-to-review` | `requireClerkUserId(req)` (line 407) | `HITLReviewItem.employerId`; `AuditEvent.metadata.employerId` | Same |
| `share-packet` | `requireClerkUserId(req)` (line 663) | `AuditEvent.metadata.employerId` (audit-only persistence) | Same |
| `packet` (audit-emitting GET) | `requireClerkUserId(req)` (line 564) | `AuditEvent.metadata.employerId` | Same |
| `view` (POST telemetry, in `pilotKpi.ts`) | `req.headers['x-clerk-user-id']` (line 174) — recorded as metadata only | `metadata.reviewerClerkId` in advisory event | Header (NOT required; absent → null) |
| `acceptance-history` (GET) | NONE — no auth required | n/a | — |
| `refresh-requests` (NPI-keyed GET, sibling) | NONE — explicitly anonymous | n/a | — |
| `status` (GET) | `requireClerkUserId(req)` (line 504) — used for SCOPE | `loadEmployerReviewStatus({employerId, ...})` filter | Same |

---

## 3. Attribution reliability — adversarial pressure

### 3.1 Reliability dimensions

| Dimension | Question | Posture |
|---|---|---|
| **Source authenticity** | Can the attribution source be forged? | The JWT cannot be forged without Clerk's private key. The `x-clerk-user-id` header CAN be forged by anyone with backend network access. **Therefore: posture depends on T2 deployment-topology assumption (backend reachable only by the proxy).** |
| **Propagation integrity** | Can the attribution be modified mid-flight? | No HMAC, no signing, no proof-of-possession on the proxy→backend hop. **Posture: trust-by-topology.** |
| **Persistence durability** | Can the attribution column be modified post-write? | Audit row's `hash` is computed from canonical content; modification is tamper-evident given DB integrity (L2). |
| **Per-actor uniqueness** | Two requests claiming the same `actorId` — are they distinct? | Yes IF correlationId differs (post-Lock-v2). Today, no per-actor request-fingerprinting. |
| **Per-org grouping** | Can attribution be aggregated by org? | **NO** — there is no trusted org column today. |

### 3.2 Attribution downgrade scenarios

| Scenario | Today's behavior | Audit visibility |
|---|---|---|
| **D-1: T2 topology breach (backend reachable from public internet)** | A direct call with forged `x-clerk-user-id` writes a mutation attributed to the impersonated user | Audit row exists; attributes to victim; no signal of forgery |
| **D-2: Web proxy regression (forwards wrong userId)** | Mutation attributes to wrong user | Audit row consistent with proxy; downstream consumers see legitimate-looking row |
| **D-3: Clerk JWT compromise (key leak; user JWT theft)** | Attacker replays as victim; web middleware validates, proxy forwards, backend records | Indistinguishable from victim's real activity |
| **D-4: Stale Clerk session (user removed from org but JWT still valid)** | Mutation attributes to user; org membership lookup not performed | No org column; downgrade invisible |
| **D-5: Header injection in middleware (e.g., bug echoes a user-supplied header)** | If middleware regression echoes `x-clerk-user-id` from request header instead of JWT, attribution becomes attacker-controlled | Audit row attributes to forged userId |
| **D-6: Race between session refresh and request** | Two concurrent requests with old + new JWT for the same user could both succeed | Attribution consistent (same userId either way) |

The wave does NOT close any of D-1 through D-5. D-6 is benign. D-1 + D-3 + D-5 are the dominant attribution-downgrade vectors.

### 3.3 Lock v2's attribution improvements

Lock v2 (NOT yet merged; under review) adds:

- **`metadata.actorId`** as a canonical field name (vs. existing `metadata.employerId`).
- **`x-vitalcv-team-role`** header forwarded by proxy (NEW).
- **`x-correlation-id`** header forwarded by proxy (NEW).
- **Defense-in-depth role gate** at backend (consults proxy-derived header).

These improve **observability + role-gate enforcement**. They do NOT improve attribution-source authenticity (still trust-by-topology) and do NOT introduce per-org tenancy (deferred).

---

## 4. Attribution survivability

A mutation's attribution must survive over time so that forensics 6 months later can answer "who did this?"

| Survivability dimension | Substrate | Posture |
|---|---|---|
| **Audit row exists 6 months later** | `AuditEvent` table; no documented retention SLA | UNVERIFIED |
| **Attribution column not GC'd** | Same | UNVERIFIED |
| **Hash recomputable from current canonical algorithm** | `auditService.ts` canonicalization | CERTIFIED if canonicalization is stable |
| **Attribution maps to a knowable user** | Clerk userId persistence at Clerk's end | DEPENDS on Clerk retention |
| **Org membership at the time of mutation is recoverable** | NO column today; deferred to MIG | NOT AVAILABLE |
| **Role at the time of mutation is recoverable** | Lock v2 adds `metadata.actorRoleAtDecision` (recommended); not in v1 | PARTIAL (post-Lock-v2) |

---

## 5. Attribution ambiguity

A SOC analyst querying audit rows can reach the WRONG attribution conclusion in these cases:

| Ambiguity | What query shows | What may have actually happened |
|---|---|---|
| **AT-AMB-1** | `metadata.employerId = userX` for an unexpected mutation | Could be: legitimate user activity; OR forged header (D-1, D-5); OR JWT theft (D-3); OR proxy regression (D-2) |
| **AT-AMB-2** | Same `userX` from two different IPs in same hour | Could be: legitimate user on phone+laptop; OR JWT theft + concurrent use; OR session refresh during travel |
| **AT-AMB-3** | `metadata.organizationContextId = orgY` (untrusted body field) | Could be: actor's actual org; OR forged client claim |
| **AT-AMB-4** | `metadata.attribution.organizationId = orgZ` (attribution-resolver derived) | Could be: actor's primary org per Clerk; OR a stale snapshot if attribution lookup is cached |
| **AT-AMB-5** | NO `tenant_org_id` column on the row | Could be: pre-MIG row (intentional NULL); OR post-MIG row that should have had org but didn't |

**Adversarial finding AT-1:** the audit log currently does NOT carry signals to disambiguate D-1 through D-5. There's no source IP, no JWT fingerprint, no proof-of-possession artifact. Forensic disambiguation requires correlating against external systems (Clerk audit log, web access logs, network flow logs).

---

## 6. Attribution Certification Track classifications

### 6.1 Per-property classification (today on origin/main)

| Property | Classification | Reason |
|---|---|---|
| Mutation produces an audit row with actor identity | **CERTIFIED** | Every C-1 + C-2 handler writes `metadata.employerId` populated from `requireClerkUserId` |
| Audit row's actor identity matches the JWT subject | **CERTIFIED — conditional on T2 topology** | Web middleware validates JWT; proxy forwards `x-clerk-user-id` derived from validated JWT; backend trusts header |
| Two concurrent mutations with same actor are distinguishable | **PARTIAL** | Each row has its own `id` and `createdAt`; no per-request fingerprint until Lock v2's correlationId lands |
| Audit row attributes to a canonical org tenant | **UNVERIFIED — deferred** | No org column; deferred to MIG |
| Attribution survives 6+ months for forensic recovery | **UNVERIFIED** | No documented retention SLA |
| Attribution is cryptographically attestable (per row signature) | **UNSAFE to claim** | L4/L5 substrate absent (see audit-strength taxonomy in `w2-pr3b-audit-strength-review.md`) |
| Attribution is non-repudiable | **UNSAFE to claim** | L5 substrate absent; existing code-comment usage is grandfathered (lexicon §1.1) |
| Attribution survives Clerk degradation | **CERTIFIED via fail-closed** | W2-PR1A's degraded-auth-fails-closed posture; mutation cannot proceed without valid session |
| Attribution survives proxy regression that drops `x-clerk-user-id` | **PARTIAL** | `requireClerkUserId` throws 401 if header absent; legitimate UX degradation, not a silent failure |

### 6.2 Per-handler classification

| Handler | Today (`9eb5cdee`) | Post-Lock-v2 (under review) |
|---|---|---|
| `accept` | 🟡 **PARTIAL** — actor recorded; no role-gate; no correlationId | 🟢 **CERTIFIED-IN-CONTRACT** — adds role-gate + correlationId |
| `confirm-start` | 🟡 **PARTIAL** — actor + per-actor acceptance scope | 🟢 **CERTIFIED-IN-CONTRACT** |
| `request-refresh` | 🟡 **PARTIAL** — actor in audit metadata; no role-gate | 🟢 **CERTIFIED-IN-CONTRACT** |
| `route-to-review` | 🟡 **PARTIAL** | 🟢 **CERTIFIED-IN-CONTRACT** |
| `share-packet` | 🟡 **PARTIAL** | 🟢 **CERTIFIED-IN-CONTRACT** |
| `packet` (GET) | 🟡 **PARTIAL** — actor in audit metadata; no role-gate | 🟢 **CERTIFIED-IN-CONTRACT** |
| `view` (POST telemetry) | 🟠 **UNVERIFIED** — actor optional; anonymous-permitted | 🟠 **UNCHANGED** — out of Lock v2 scope |
| `acceptance-history` (GET) | 🔴 **UNSAFE** by design — anonymous + cross-tenant | 🟠 **OPTIONAL** Lock v2 reclassification (deferred) |
| `refresh-requests` (NPI-keyed GET) | 🟠 **UNVERIFIED** by design — anonymous | 🟠 **UNCHANGED** by design |
| `status` (GET) | 🟡 **PARTIAL** — actor scope on read | 🟡 **MARGINAL change in Lock v2** |

---

## 7. Lock v2 contract certification (CERTIFIABLE-IN-CONTRACT)

Lock v2 is a doc; the implementation PR is not visible. Therefore:

- **Lock v2's contract is itself CERTIFIABLE.** It correctly bounds attribution claims, defers org tenancy, and requires correlationId stamping. The reviewer can certify the contract.
- **Lock v2's implementation is UNVERIFIED.** Until the parallel implementation PR opens and Codex SAFE inspects the diff, the contract's actualization is unverified.

**Certification disposition:** the wave's attribution work can be certified at the contract level today. Implementation certification waits for diff inspection.

---

## 8. Required disclaimers (lexicon-aligned)

Any surface (PR description, audit-row label, dashboard, marketing, dossier) that describes the wave's attribution must include:

1. **Trust anchor:** "Clerk JWT, validated at the web middleware (W2-PR1A); backend trusts proxy-forwarded `x-clerk-user-id` header. Topology assumption: backend reachable only by proxy."
2. **Org scope absent:** "No per-org tenancy enforcement on the employer-review surface today; deferred to W2-PR2B-MIG-C."
3. **Cryptographic attestation absent:** "Attribution is proxy-bounded, not cryptographically attested (L4/L5 audit-strength absent per `TRUST_GUARANTEE_LEXICON.md`)."
4. **Non-repudiation forbidden phrase:** "do not use `non-repudiable` for the wave's attribution work."

---

## 9. Track A determination

| Question | Answer |
|---|---|
| Is the wave's attribution model coherent and deterministic? | **YES — certifiable** |
| Is attribution authentic (forge-resistant)? | **PARTIAL — depends on T2 topology** |
| Is attribution per-org? | **NO — per-actor only; deferred** |
| Is attribution L4/L5 (signed / non-repudiable)? | **NO — absent; lexicon forbids the claim** |
| Is attribution survivable for forensic recovery? | **PARTIAL — undocumented retention SLA** |
| Is attribution lexicon-conformant in description? | **DEPENDS on implementation PR's wording** |

**Track A classification:** **PARTIAL — CERTIFIABLE in contract; CERTIFIABLE-IN-IMPLEMENTATION pending Lock v2 diff inspection + topology-assumption documentation.**

The wave does NOT introduce attribution defects. The wave does not advance attribution beyond proxy-bounded. The wave's risk is exclusively in **describing-language inflation** (already addressed by `TRUST_GUARANTEE_LEXICON.md` + Codex audit prompt extension).

---

## 10. Closing principle (Track A)

Mutation attribution is the question "who did this?" The wave answers "the actor whose Clerk JWT the proxy validated, recorded as `userId` in `metadata.employerId` (and `metadata.actorId` post-Lock-v2)." This is a TRUE answer at L1+L2. It is NOT a CRYPTOGRAPHIC answer at L4/L5.

**The attribution is as strong as the topology + Clerk + the proxy. It is not stronger.** Certification is bounded by these three components. Where the wave's wording stays inside those bounds, attribution is certifiable. Where the wording exceeds the bounds, the wave is unsafe — not because of code, but because of inflation.
