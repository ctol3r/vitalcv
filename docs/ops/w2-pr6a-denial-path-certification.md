# W2-PR6A — Denial-Path Certification (Track C)

**Wave:** Wave 2, PR 6A — operational audit spine, denial-path certification · **Date:** 2026-05-08 · **Status:** certification only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `w2-pr6a-audit-spine-certification.md`, `MUTATION_GATE_SEQUENCE.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc certifies the **denial-path observability** posture of the audit spine. It identifies silent denials, attribution loss on denial, telemetry fragmentation, and audit omissions.

The central thesis: **pre-Lock-v2, denied requests on the employer-review surface emit ZERO audit rows. Post-Lock-v2 mandates emission for Step-2+ denials. Step-1 (pre-auth) denials remain audit-invisible by design.**

---

## 1. The denial taxonomy

Per `MUTATION_GATE_SEQUENCE.md` §2, the 6-step canonical sequence has 6 distinct denial origins:

| Step | Denial origin | Audit visibility |
|---|---|---|
| **Step 1** Authenticate | No Clerk session | 🔴 **NEVER AUDITED** — no actor to record |
| **Step 2** RBAC | Missing `org_id` (post-Lock-v2: missing `team_role`) | 🟡 PRE-LOCK-V2: not emitted; 🟢 POST-LOCK-V2: emitted |
| **Step 2** RBAC | Insufficient role (e.g., readonly POST) | Same |
| **Step 3** Derive ownership | n/a (server-side derivation; no denial) | n/a |
| **Step 4** Validate ownership | Resource missing OR cross-tenant (deferred) | 🟡 PRE-LOCK-V2: 404 emitted but no audit; 🟢 POST-LOCK-V2: emitted |
| **Step 5** Workflow gate | Wrong state, CRS<80, no prior acceptance, etc. | 🟡 PRE-LOCK-V2: HTTP wire emitted but typically no audit (one exception: existing acceptance-blocked at line 195); 🟢 POST-LOCK-V2: emitted |
| **Step 6** Atomic write | DB transaction failure | 🔴 **NEVER AUDITED** — partial state must roll back; nothing to record |

---

## 2. Pre-Lock-v2 denial-path coverage

### 2.1 Today's emission

A scan of the routes for `prisma.auditEvent.create` (or the service-function audit writer) on denial paths:

| Handler | Denial cases that emit audit today |
|---|---|
| `accept` | NONE — duplicate-check (line 175) returns 409 without audit; passport-blocked check returns 422 without audit; the `recordEmployerReviewAcceptance` only fires on success |
| `confirm-start` | NONE — body validation, acceptance-not-found, all return without audit |
| `request-refresh` | NONE |
| `route-to-review` | NONE |
| `share-packet` | NONE — NPI-mismatch returns 400 without audit |
| `packet` | NONE — entity-not-found returns 404 without audit |
| `view` | n/a — no audit on success either |
| `acceptance-history` | n/a — public read |
| `status` | n/a — read |
| `refresh-requests` | n/a — public read |

**Track C finding DC-1:** **PRE-LOCK-V2: zero denied-path audit emission.** A SOC analyst querying audit rows sees ONLY successful mutations. Denied attempts are visible only in web-layer access logs (and only if the access logger captures them).

### 2.2 What's lost without denied-path emission

| Lost forensic capability | Impact |
|---|---|
| Probing detection (cross-tenant lookups, role-denied attempts) | Cannot detect attacker reconnaissance from audit alone |
| Replay-attempt detection | Pre-Lock-v2 has no correlationId; even if it did, denied replays would be invisible |
| Workflow-rejection clustering | Cannot detect "actor X tries acceptance 50 times for clinician Y who is BLOCKED" |
| Role-mismatch detection | Cannot detect "readonly user trying mutations" without web-layer log analysis |
| Authentication-failure trend (post-auth — i.e., expired/missing org_id) | Cannot detect Clerk-session anomalies post-auth |

**Track C finding DC-2:** the pre-Lock-v2 gap is operationally significant. Denied paths are where attacker patterns first appear; their invisibility to the audit spine is a defensive blind spot.

---

## 3. Post-Lock-v2 mandate

Per Lock v2 §8 + §9 + `w2-pr2b-audit-coupling.md` §3.3 + `TRUST_GUARANTEE_LEXICON.md` §4: **every denied attempt that reached at least Step 2 (auth-present) writes a denied audit row** with:

- `metadata.outcome: 'denied'`
- `metadata.action: '<base>.<reason>'`
- `metadata.actorId` (= Clerk userId from header)
- `metadata.subjectId` (= entityId or NPI from URL)
- `metadata.correlationId`
- `metadata.payloadHash` (per ML-Rec-1 extending to denied path)
- standard fields (`type`, `referenceId`, `clinicianId`, `hash`)

### 3.1 Per-handler denied-path coverage post-Lock-v2

| Handler | Denied paths emitting audit |
|---|---|
| `accept` | role_denied, no_org_context, acceptance_blocked, already_accepted, entity_not_found, malformed_resource_id, duplicate_request |
| `confirm-start` | role_denied, no_org_context, no_prior_acceptance, entity_not_found, malformed_resource_id, duplicate_request, body_validation |
| `request-refresh` | role_denied, no_org_context, archived_review (if introduced), entity_not_found, duplicate_request |
| `route-to-review` | role_denied, no_org_context, wrong_review_state (if introduced), entity_not_found, duplicate_request |
| `share-packet` | role_denied, no_org_context, archived_review, entity_not_found, NPI_mismatch, duplicate_request |
| `packet` (GET) | role_denied (if added), entity_not_found |

**Track C finding DC-3:** post-Lock-v2 denied-path coverage is comprehensive for Step-2+ denials. Code-review must verify the implementation PR emits an audit row on EACH of the listed reasons.

---

## 4. The Step-1 silent gap (intentional)

Pre-auth denials (no Clerk session at all) intentionally do NOT emit audit rows. Rationale per `w2-pr2c-runtime-truth-boundary.md` §5.2 + lexicon §1.1:

- There is no `actorId` to record (the request never authenticated).
- Recording "anonymous request denied" rows would inflate audit volume to bot-traffic scale.
- Web-layer access logs cover the visibility need.

**Track C finding DC-4:** Step-1 silent-gap is acceptable IF disclosed in surfaces that describe audit coverage. A reader who sees "every denied attempt writes a denied audit row" might infer pre-auth coverage; the qualifier "for Step-2+ denials" is mandatory per lexicon.

---

## 5. Readonly-path observability

Lock v2 introduces explicit readonly POST denial:

- Web layer (`employerReviewLegitimacyGate.ts`) denies + emits audit.
- Backend layer (defense-in-depth) denies + emits audit.

**Path tracing for a readonly user attempting `accept`:**

```
1. Web layer: extractVerifierClaims sees team_role=readonly + verb=POST → 403 + audit-emit("employer_review.accept.role_denied")
2. (Backend never reached because proxy returns 403)
```

If the proxy is bypassed (T2 topology breach):

```
1. Backend: requireClerkUserId reads x-clerk-user-id (forged) → ok
2. Backend: reads x-vitalcv-team-role header (forged) → if forged to "admin", denial NOT triggered; if absent or readonly, 403 + audit-emit
3. Mutation either succeeds (forged admin) or denied (correct readonly)
```

**Track C finding DC-5:** readonly-path observability is **CERTIFIED post-Lock-v2 IF the proxy is in the trust path.** Under T2 breach, defense-in-depth helps ONLY if the attacker doesn't forge the team_role header to "admin." This is a topology dependency, not an enforcement.

---

## 6. Attribution loss on denial

Even when denied paths emit audit rows, attribution can be incomplete:

| Denial scenario | actorId on audit row |
|---|---|
| no_org_context (org_id missing) | actorId = Clerk userId (from session) |
| role_denied (readonly) | actorId = Clerk userId |
| entity_not_found | actorId = Clerk userId |
| acceptance_blocked | actorId = Clerk userId |
| duplicate_request | NO new audit row (prior row stands) |
| malformed_resource_id | actorId = Clerk userId |

**Track C finding DC-6:** all Step-2+ denials successfully record `actorId`. The `duplicate_request` path is the exception — by design, no new row is written (the prior row IS the record). This is correct IF documented in the runbook.

---

## 7. Telemetry fragmentation (denied-path)

Denied paths can fragment telemetry across:

- Web access logs (every request, denied or not).
- Backend access logs (proxied requests).
- Audit rows (Step-2+ denials post-Lock-v2).
- SEAL captures (NOT fired on denial; only on success).
- Learning captures (NOT fired on denial).
- Recompute jobs (NOT fired on denial).

**Track C finding DC-7:** denied paths produce ONLY (a) web/backend access logs and (b) audit rows (post-Lock-v2). They do NOT produce SEAL/learning/recompute side effects. This is correct — denials should not train recommenders or update boost graphs.

The implementation PR must NOT accidentally fire side effects on denial paths.

---

## 8. Silent-denial detection (adversarial)

Scenarios where denials could SILENTLY occur (no wire, no audit, no log):

| Scenario | Severity |
|---|---|
| **SD-1** Tx aborts AFTER mutation insert succeeds but BEFORE audit insert | High — partial state risk; covered by Postgres ACID rollback (no actual mutation persists) |
| **SD-2** Backend route handler throws an uncaught exception | Medium — depends on backend's error handler catching + logging |
| **SD-3** Proxy regression silently returns 200 with empty body | High — caller sees success; backend was never called |
| **SD-4** Network drop between proxy and backend post-mutation-commit | Medium — backend wrote audit + mutation; caller doesn't know |
| **SD-5** Audit-write fails inside `requireAuditBeforeResponse` (T1) | LOW — throws; handler must propagate; well-handled |
| **SD-6** Audit-write fails inside `prisma.$transaction` (T2) | LOW — tx aborts; mutation rolls back; correct |
| **SD-7** Audit-write fails in fire-and-forget T0 path | High — mutation persists (via separate codepath); audit lost; CRITICAL log generated |

**Track C finding DC-8:** SD-1, SD-3, SD-4 are the un-mitigated silent-denial paths. SD-3 in particular is a deployment-correctness concern (proxy must not return 200 on backend errors).

---

## 9. Denial-path classifications

### 9.1 Per-property

| Property | Today | Post-Lock-v2 + recommendations |
|---|---|---|
| Denied audit rows for Step-2+ denials | 🔴 NONE | 🟢 CERTIFIED-IN-CONTRACT |
| Denied audit row for `acceptance_blocked` (existing 422 path) | 🔴 NONE | 🟢 CERTIFIED-IN-CONTRACT |
| Denied audit row for `already_accepted` | 🔴 NONE | 🟢 CERTIFIED-IN-CONTRACT |
| `payloadHash` on denied rows | 🔴 NOT MANDATED | 🟢 CERTIFIED-IN-CONTRACT (via ML-Rec-1) |
| `actorId` on denied rows | 🔴 NOT EMITTED | 🟢 CERTIFIED-IN-CONTRACT |
| Readonly POST denied at proxy | 🔴 NOT (no role-gate today) | 🟢 CERTIFIED-IN-CONTRACT |
| Readonly POST denied at backend (defense-in-depth) | 🔴 NOT | 🟢 CERTIFIED-IN-CONTRACT (if proxy in trust path) |
| Pre-auth denials (Step-1) audited | 🔴 NEVER (by design) | 🔴 UNCHANGED (by design) |
| Tx-rollback denials (Step-6) audited | 🔴 NEVER (no partial state to record) | 🔴 UNCHANGED (correct) |
| Side effects fire on denial | 🔴 NO (correct) | 🔴 NO (must verify implementation) |

### 9.2 Aggregate

**Denied-path observability:** 🟡 **PARTIAL today; CERTIFIED-IN-CONTRACT post-Lock-v2 for Step-2+ denials.** Pre-auth + tx-rollback denials remain audit-invisible by design.

---

## 10. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **DC-Rec-1** | Implementation PR must verify denied-path audit emission for ALL reasons in §3.1 | HIGH |
| **DC-Rec-2** | Mandate `payloadHash` on denied rows (extends ML-Rec-1) | HIGH |
| **DC-Rec-3** | Document Step-1 silent-gap explicitly in audit-row-schema doc | HIGH |
| **DC-Rec-4** | Document side-effects-do-not-fire-on-denial invariant | MEDIUM |
| **DC-Rec-5** | Add operational alerting for SD-3 (proxy returns 200 with empty body — possible regression) | LOW |
| **DC-Rec-6** | Add SD-7 (T0 fire-and-forget audit-write failure) to operational runbook | LOW |

---

## 11. Track C determination

| Question | Answer |
|---|---|
| Are denied attempts auditable today? | NO — pre-Lock-v2 has zero denied-path emission |
| Are denied attempts auditable post-Lock-v2? | YES for Step-2+; NO for Step-1 (by design) |
| Is attribution preserved on denied rows? | YES — `actorId` always recorded for Step-2+ |
| Is payloadHash preserved on denied rows? | NOT MANDATED in Lock v2; required per ML-Rec-1 + DC-Rec-2 |
| Are silent-denial scenarios bounded? | PARTIAL — SD-3 is the dominant un-mitigated path (deployment correctness) |
| Is readonly-path observability CERTIFIED? | YES post-Lock-v2 IF proxy is in trust path (T2 dependency) |

**Track C classification:** 🟡 **PARTIAL today; CERTIFIED-IN-CONTRACT post-Lock-v2 + DC-Rec-2.**

---

## 12. Closing principle (Track C)

Denial-path observability is the discipline of recording what was rejected. Pre-Lock-v2's gap (zero denied audit rows) is operationally significant; Lock v2 closes it for Step-2+ denials. Pre-auth and tx-rollback denials remain audit-invisible by design — and the design is correct provided the limitation is disclosed.

**Denial-path is CERTIFIABLE-IN-CONTRACT post-Lock-v2 IF (a) implementation emits all listed reasons + payloadHash, (b) Step-1 silent-gap is disclosed, (c) side-effects-do-not-fire-on-denial is documented as invariant.** Closing DC-Rec-1, DC-Rec-2, DC-Rec-3 advances denial-path from PARTIAL to CERTIFIED.
