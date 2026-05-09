# W2-PR6A — Attribution Durability (Track D)

**Wave:** Wave 2, PR 6A — operational audit spine, attribution durability · **Date:** 2026-05-08 · **Status:** certification only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `w2-pr6a-audit-spine-certification.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc certifies **actor attribution durability** — the property that the audit spine retains a meaningful record of WHO acted, surviving common operational scenarios.

The wave brief explicitly distinguishes **attribution vs. ownership vs. certification.** This doc honors that distinction.

---

## 1. Attribution vs ownership vs certification

These three concepts are often conflated. The audit spine governs all three differently:

| Concept | Definition | Substrate today | Lexicon-aligned wording |
|---|---|---|---|
| **Attribution** | Who initiated the action | `metadata.actorId` (= Clerk userId) populated from `requireClerkUserId` | "actor-attributed" / "proxy-attributed actor" |
| **Ownership** | What entity has authority over the resource | NONE today on employer-review surface (per-actor scope only); deferred to MIG-C | "per-actor-scoped" — never "tenant-isolated" or "ownership-enforced" |
| **Certification** | Cryptographic attestation of an artifact's origin | Issuer-signed receipts (TRUST-PERSIST-1, in progress); audit rows are L1+L2 (recorded + tamper-evident given DB integrity) | "issuer-signed" only for receipts; "audit-traceable" / "tamper-evident given DB integrity" for audit rows |

**Track D finding AD-1:** the wave's mutation legitimacy hardening (Lock v2) operates on **attribution** — it does NOT advance **ownership** or **certification.** This is honest; the lexicon enforces the distinction.

---

## 2. Actor attribution chain

Per `w2-pr5a-runtime-certification.md` Track A:

```
Clerk JWT (signed by Clerk)
   ↓ web middleware (W2-PR1A) validates
   ↓ extracts session.userId
   ↓
Web route handler forwards `x-clerk-user-id: <userId>`
   ↓ PROXY-DEPENDENT (T2 topology assumption)
   ↓
Backend: requireClerkUserId(req) → userId
   ↓
Service: persists as actorId in audit metadata + employerId in mutation row
```

### 2.1 Attribution durability per-step

| Step | Durability | Failure mode |
|---|---|---|
| Clerk-side JWT validation | 🟢 STRONG — cryptographic verification at web middleware | JWT theft / Clerk compromise |
| Proxy header forwarding | 🟡 PARTIAL — depends on proxy correctness | Proxy regression / config |
| Backend header read | 🟡 PARTIAL — trusts proxy unconditionally | T2 topology breach (forged header) |
| Service function persistence | 🟢 STRONG within tx (C-1); CERTIFIED L1+L2 | DB outage covered by tx semantics |
| Audit-row write | 🟢 STRONG via `prisma.$transaction` (T2) for C-1 handlers | Same |
| Postgres durability | 🟢 STRONG (ACID) | Disk failure / regional outage |
| Forensic recovery 6 months later | 🟠 UNVERIFIED | Audit retention SLA undocumented |

**Track D finding AD-2:** attribution is **STRONG at write-time** (Clerk JWT + W2-PR1A + atomic persistence). It is **WEAK against topology breach** (T2 dependency) and **UNVERIFIED against retention** (gate G7).

---

## 3. Attribution downgrade scenarios

| # | Scenario | Effect on attribution |
|---|---|---|
| **AD-D-1** | T2 topology breach (backend reachable directly) | Attacker forges `x-clerk-user-id`; mutation attributes to victim; AUDIT ROW LOOKS LEGITIMATE |
| **AD-D-2** | Web proxy regression (forwards wrong userId) | Same — attribution silently incorrect |
| **AD-D-3** | Clerk JWT compromise (key leak; user JWT theft) | Web middleware validates forged JWT (if attacker has Clerk key) OR victim's stolen JWT; attribution to victim |
| **AD-D-4** | Stale Clerk session (user removed from org but JWT still valid) | Attribution to user; org membership change not visible to backend (no membership lookup) |
| **AD-D-5** | Header injection bug (middleware echoes user-supplied header) | Attribution becomes attacker-controlled |
| **AD-D-6** | `requireClerkUserId` reads wrong header (e.g., a typo regression to `x-user-id`) | All requests fail 401; UX visible — NOT silent |
| **AD-D-7** | Audit row's `metadata.actorId` field is renamed in a future schema change (per ML-6) | Old forensic queries silently miss data |
| **AD-D-8** | Audit retention shorter than forensic-recovery window | Attribution data GC'd; queries return nothing |

### 3.1 Downgrade mitigation status

| Downgrade | Mitigated today? | Mitigation owner |
|---|---|---|
| AD-D-1 | NO — topology dependency | Ops (deploy runbook G8) |
| AD-D-2 | NO — proxy correctness | Ops + reviewer |
| AD-D-3 | PARTIAL — Clerk's responsibility for key + session security; platform's responsibility for not exposing JWTs in logs | Clerk + Ops |
| AD-D-4 | NO — stale-session window is a known deferred risk per `AUTHORIZATION_BASELINE_V1.md` §5.1 | Future session-revocation wave |
| AD-D-5 | YES — W2-PR1A's `extractVerifierClaims` reads from JWT, not from request headers | W2-PR1A |
| AD-D-6 | YES — UX visible; not silent | n/a |
| AD-D-7 | PARTIAL — `audit-row-schema.md` deprecation timeline mitigates | Ops + this wave's recommendation |
| AD-D-8 | NO — retention SLA undocumented | Ops (gate G7) |

**Track D finding AD-3:** AD-D-1, AD-D-3, AD-D-4, AD-D-7, AD-D-8 are the un-mitigated attribution-downgrade vectors. AD-D-1 (topology breach) is the most consequential because attribution silently appears legitimate.

---

## 4. Attribution ambiguity

A SOC analyst querying audit rows for attribution can reach the WRONG conclusion in these cases:

| Ambiguity | What query shows | What may have happened |
|---|---|---|
| **AD-AMB-1** | `metadata.actorId = userX` for unexpected mutation | Legitimate user activity, OR forged header (AD-D-1, AD-D-5), OR JWT theft (AD-D-3) |
| **AD-AMB-2** | Same `userX` from two different IPs in same hour | Legitimate user on phone+laptop, OR JWT theft + concurrent use |
| **AD-AMB-3** | `metadata.organizationContextId = orgY` (untrusted body field) | Actor's actual org, OR forged client claim (lexicon §5.1 forbids using as authorization) |
| **AD-AMB-4** | `metadata.attribution.organizationId = orgZ` (resolver-derived) | Actor's primary org per Clerk, OR stale snapshot if resolver caches |
| **AD-AMB-5** | NO `tenant_org_id` column on row | Pre-MIG row (intentional NULL), OR post-MIG row that should have had org but didn't |
| **AD-AMB-6** | `metadata.employerId` AND `metadata.actorId` both populated, both = userX | Lock v2 transition window (both fields carried), OR drift from inconsistent population |
| **AD-AMB-7** | Audit row has actorId but mutation row's `employerId` is null | Audit row written but mutation row didn't get employerId set (consistency bug) |

**Track D finding AD-4:** the audit log currently does NOT carry signals to disambiguate AD-D-1 through AD-D-3 (no source IP, no JWT fingerprint, no DPoP-style proof-of-possession). Forensic disambiguation requires correlating against external systems (Clerk audit log, web access logs, network flow logs).

---

## 5. Attribution survivability under degraded states

### 5.1 Degraded-auth fail-closed (W2-PR1A)

When Clerk is degraded:
- Web middleware returns 503 with `x-rbac-fail-closed: clerk_unavailable`.
- No mutation reaches the backend.
- No audit row is written.
- Attribution durability is preserved (no false attributions during degradation).

**Status:** 🟢 CERTIFIED via W2-PR1A's 50-case test suite.

### 5.2 Degraded-DB

When Postgres is degraded:
- T2 (`prisma.$transaction`) rolls back; mutation does NOT commit; caller receives 5xx.
- T1 (`requireAuditBeforeResponse`) throws; caller receives 5xx.
- T0 (`createAuditEvent` fire-and-forget) writes in-memory but `.catch` logs CRITICAL; audit lost in DB; mutation may have committed via separate codepath.

**Status:** 🟢 CERTIFIED for T1+T2; 🟡 PARTIAL for T0.

### 5.3 Degraded-proxy

When the web proxy degrades:
- Requests not reaching backend → no mutations → no audit; attribution-of-nothing preserved.
- Proxy returns 5xx → caller sees error → no false attribution.
- Proxy regression that drops `x-clerk-user-id` → backend `requireClerkUserId` throws 401 → caller sees error → no false attribution.

**Status:** 🟢 CERTIFIED — degraded proxy fails closed.

### 5.4 Degraded backend audit-write infrastructure

Per `auditService.ts:75–77`: "On DB failure: log CRITICAL but do not throw — do not break callers" (for T0 fire-and-forget path). Mutations using T0 audit could commit while audit fails.

The wave's 6 in-scope handlers use T2 (atomic-with-mutation) for the 4 C-1 handlers and cosmetic single-row tx for the 2 C-2 handlers. T0 fire-and-forget is NOT used by these handlers.

**Status:** 🟢 CERTIFIED for the 6 in-scope handlers (T2 / cosmetic-T2). T0 risk does not apply.

---

## 6. Attribution durability classifications

### 6.1 Per-property

| Property | Today | Post-Lock-v2 + recommendations |
|---|---|---|
| `metadata.actorId` populated on permitted-path audit | 🟡 PARTIAL — populated as `metadata.employerId`; rename per ML-6 | 🟢 CERTIFIED-IN-CONTRACT |
| `metadata.actorId` populated on denied-path audit | 🔴 NOT (no denied-path emission today) | 🟢 CERTIFIED-IN-CONTRACT |
| Attribution survives audit-write tx (atomic for C-1) | 🟢 CERTIFIED | 🟢 CERTIFIED |
| Attribution survives audit-write standalone (cosmetic for C-2) | 🟢 CERTIFIED at L1+L2 | 🟢 CERTIFIED |
| Attribution survives Postgres ACID | 🟢 CERTIFIED | 🟢 CERTIFIED |
| Attribution survives degraded auth | 🟢 CERTIFIED via W2-PR1A fail-closed | 🟢 CERTIFIED |
| Attribution survives degraded DB | 🟢 CERTIFIED for T1+T2 paths | 🟢 CERTIFIED |
| Attribution survives degraded proxy | 🟢 CERTIFIED | 🟢 CERTIFIED |
| Attribution survives T2 topology breach | 🔴 NO — silently falsified | 🔴 UNCHANGED |
| Attribution survives stale-session window | 🔴 NO — JWT outlives membership | 🔴 UNCHANGED — deferred |
| Attribution forensic recovery 6 months later | 🟠 UNVERIFIED | 🟠 UNCHANGED until SLA |
| Attribution is cryptographically attestable | 🔴 ABSENT (L4) | 🔴 ABSENT |
| Attribution is non-repudiable | 🔴 ABSENT (L5) | 🔴 ABSENT (lexicon-forbidden phrase) |

### 6.2 Aggregate

**Attribution durability:** 🟡 **PARTIAL** — strong against common operational scenarios; vulnerable to topology breach + stale session + retention undocumentation; lacks cryptographic provability.

---

## 7. Attribution vs ownership — explicit non-conflation

The wave's lexicon (`TRUST_GUARANTEE_LEXICON.md` §1) and earlier docs (`AUTHORIZATION_BASELINE_V1.md` §4.1) repeatedly distinguish:

| Question | Answer the audit spine gives |
|---|---|
| "Who acted?" | `metadata.actorId` (Clerk userId) — proxy-bounded |
| "What did they do?" | `type` + `metadata.action` — well-classified |
| "Did they have authority?" | **NOT ANSWERED** — per-org tenancy deferred; today, only role-gated (post-Lock-v2) and per-actor scoped |
| "Is this attribution cryptographically attestable?" | **NO** — L4/L5 absent |
| "Is it non-repudiable?" | **NO** — L5 absent; lexicon-forbidden phrase |

**Track D finding AD-5:** the wave's surfaces MUST distinguish attribution (who did it) from ownership (whether they had authority) from certification (cryptographic attestation). Conflating any two is an inflation hazard.

---

## 8. Attribution vs certification — explicit non-conflation

Receipts (TRUST-PERSIST-1, in progress) introduce a separate certification path:

- **Audit row attribution:** `metadata.actorId` — who acted on the platform.
- **Receipt attribution:** the receipt's `proof.signedBy` (when issuer signing lands) — who certified the underlying claim.

These are different. An audit row recording "user X performed `accept`" does NOT mean "user X is certified to perform accepts" — it means "user X performed an action the platform recorded." Certification is about the credentialing authority's signature, NOT about the actor's permission.

**Track D finding AD-6:** any UI / dossier / marketing surface that conflates "audit-recorded action" with "issuer-certified credential" is inflated. The audit spine records actions; receipts certify credentials. Two systems, two purposes.

---

## 9. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **AD-Rec-1** | Document attribution-vs-ownership-vs-certification distinction in `audit-row-schema.md` | HIGH |
| **AD-Rec-2** | Document T2 topology assumption in deploy runbook (gate G8) | HIGH |
| **AD-Rec-3** | Stale-session invalidation is deferred; do NOT claim it as a guarantee until session-revocation wave lands | HIGH |
| **AD-Rec-4** | Audit retention SLA must respect forensic-recovery horizon (≥ 6 months recommended) | HIGH (gate G7) |
| **AD-Rec-5** | `metadata.actorRoleAtDecision` field added (records team_role at decision time; survives role change) | MEDIUM |
| **AD-Rec-6** | `metadata.sourceIp` recorded (helps disambiguate AD-AMB-2; PII concern requires data-policy review) | LOW |

---

## 10. Track D determination

| Question | Answer |
|---|---|
| Is attribution durable at write-time? | YES — 🟢 CERTIFIED for C-1 handlers; CERTIFIED for cosmetic C-2 |
| Is attribution durable across operational degradations? | PARTIAL — 🟡 fail-closed against auth/DB/proxy; vulnerable to T2 topology breach + stale session |
| Is attribution survivable for forensic recovery? | UNVERIFIED — 🟠 retention SLA undocumented (gate G7) |
| Is attribution distinguished from ownership in surfaces? | DEPENDS on PR description discipline + lexicon enforcement |
| Is attribution distinguished from certification (issuer signing)? | YES in doctrine; depends on UI/marketing surfaces |
| Is attribution cryptographically attestable? | NO — L4/L5 absent; lexicon forbids the claim |

**Track D classification:** 🟡 **PARTIAL** — strong write-time; vulnerable to topology + stale-session + retention; explicitly NOT cryptographically attestable.

---

## 11. Closing principle (Track D)

Attribution is the answer to "who acted?" The audit spine answers it well, bounded by: the proxy is in the trust path; Clerk's JWT validation holds; audit retention covers the forensic horizon. Where any of these fails, attribution silently degrades.

**Attribution is CERTIFIABLE-IN-CONTRACT post-Lock-v2 + lexicon enforcement; UNVERIFIED for forensic survival until retention SLA formalizes; UNSAFE if conflated with ownership or certification.**

The wave's surfaces must speak narrowly: "who acted" — never "who has authority" (ownership), never "cryptographically signed" (certification). The lexicon enforces the narrow framing; reviewers + Codex SAFE check every PR for inflation.
