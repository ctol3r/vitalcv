# W2-PR3B — Replay Governance

**Wave:** Wave 2, PR 3B — adversarial trust governance, replay focus · **Date:** 2026-05-08 · **Status:** review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** replay-risk reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` (§1.3 forbids "replay protected"); consolidates prior findings from `w2-pr2c-replay-governance-review.md` (Track B)

This doc is the **replay-focused adversarial review** of W2-PR3B's instrumentation work. It establishes whether the wave is replay-safe, identifies correlation-survivability gaps, and assesses replay ambiguity from the operator perspective.

The central thesis: **Lock v2's correlationId mechanism is REPLAY OBSERVABILITY + BEST-EFFORT IDEMPOTENCY CHECK. It is NOT REPLAY PROTECTION (banned phrase per lexicon §1.3).** The wave is safe IF this distinction is enforced at every surface.

---

## 1. Replay categories — what the wave addresses

| Category | Definition | Lock v2 stance |
|---|---|---|
| **R-CAT-1: Network-retry replay** | Same client retries due to network failure | **ADDRESSED** — correlationId clusters retries; best-effort dedup returns 409 on second |
| **R-CAT-2: Client-bug replay** | Same client retries due to UI bug or impatient double-click | **ADDRESSED** — same as R-CAT-1 |
| **R-CAT-3: Hostile capture-and-replay** | Attacker captures + re-issues a request | **NOT ADDRESSED** — see §2 |
| **R-CAT-4: Cross-actor replay** | Attacker captures from actor A and replays under stolen identity | **NOT ADDRESSED** — see §3 |
| **R-CAT-5: Long-window replay** | Honest client emits same correlationId after 24h window | **NOT ADDRESSED** — see §4 |
| **R-CAT-6: Fingerprint substitution** | Attacker replays with a fresh correlationId on captured body | **NOT ADDRESSED** — see §5 |

The wave is honest insofar as Lock v2 §6 names "correlationId" as the replay anchor. It is dishonest if marketed as "replay-protected" — that phrasing covers R-CAT-3..R-CAT-6 which the wave does NOT defend against.

---

## 2. Capture-and-replay (R-CAT-3) — uncovered

### 2.1 Threat steps

1. Attacker captures a complete `POST /api/employer-review/<entityId>/<action>` request (body, headers including `x-clerk-user-id`, `x-vitalcv-team-role`, `x-correlation-id`).
2. Attacker reaches the backend (assumes T2 deployment-topology breach OR proxy compromise).
3. Attacker re-issues the captured request with a **new** `x-correlation-id`.
4. Backend's duplicate-check fails to match (fresh correlationId).
5. Mutation commits with the captured `actorId`.

### 2.2 What's missing

| Defense | Present today? |
|---|---|
| Server-minted nonce per request (single-use) | NO |
| HMAC over request body keyed to actor's session | NO |
| Time-bounded request signature (e.g., AWS Signature v4-style) | NO |
| Network-bound trust (mutual TLS, cryptographic authentication of proxy→backend) | NOT VERIFIED — deployment topology |
| `payloadHash` UNIQUE on `(actorId, payloadHash, 24h)` | NO — schema migration deferred |

### 2.3 Forensic recovery

If the wave populates `metadata.payloadHash` on EVERY audit row (per `TRUST_GUARANTEE_LEXICON.md` §2 + `w2-pr2c-replay-governance-review.md` B-Rec-3), forensics can correlate captures by:

```sql
SELECT * FROM audit_events
WHERE metadata->>'actorId' = $1
  AND metadata->>'payloadHash' = $2
  AND created_at > now() - interval '24 hours';
```

Multiple rows for the same `(actor, payloadHash)` indicate likely capture-replay. This is **forensic detection, not prevention.**

**Adversarial finding RG-1:** the wave should make `payloadHash` mandatory on every audit row (permitted + denied) to provide forensic recovery. Lock v2 §8 references `payloadHash` for permitted rows; the implementation must extend to denied rows for capture-replay detection of *failed* probes.

---

## 3. Cross-actor replay (R-CAT-4) — uncovered

### 3.1 Threat

An attacker has stolen JWT or `x-clerk-user-id` of actor A. Replays request as A.

### 3.2 What's missing

| Defense | Present today? |
|---|---|
| Proof-of-possession on JWT (DPoP, mTLS-bound JWT) | NO |
| Backend independent JWT verification (catches forgeries) | NO — deferred to MIG-B |
| Client-side request signing | NO |
| Token rotation on suspicious activity | NO |

### 3.3 Forensic posture

If the actor's audit history shows mutations from atypical IPs or timing patterns, SOC analysts can detect post-hoc. This requires:

- Audit row carries source IP / user-agent / session-context.
- A baseline of normal behavior per actor.

The wave does NOT introduce these signals. They are operational concerns outside the lock.

**Adversarial finding RG-2:** cross-actor replay is fundamentally a JWT-stewardship concern (Clerk's responsibility for JWT secrecy + the platform's responsibility for not exposing JWTs in logs). The wave does not exacerbate the risk; it does not mitigate it either. Disclosure is required: "the wave's audit-coupling does NOT defend against stolen-JWT replay."

---

## 4. Long-window replay (R-CAT-5)

### 4.1 The 24h window

Lock v2 §7.4: duplicate `(actorId, correlationId, 24h)` returns 409.

A correlationId reused outside the window does not fire the duplicate check.

### 4.2 Honest-client cliff

A client that retains correlationId in retry buffers (mobile apps left open, browser tabs cached) might re-emit at the 24h+1m mark. The platform processes both requests. The honest client never knows.

### 4.3 Mitigations not provided

- Time-of-day rolling buckets (`actorId || correlationId || floor(now / 24h)`) — not in lock.
- Server-side mint with TTL — not in lock; defeats client-supplied idempotency intent.

**Adversarial finding RG-3:** the 24h window is arbitrary and produces honest-client false-negatives. Lock v2 should specify the rationale (likely: matches typical retry-buffer TTLs in fetch clients) AND document the cliff in operator-facing copy.

---

## 5. Fingerprint substitution (R-CAT-6)

### 5.1 The substitution

A captured request has body B with correlationId C. An attacker (with topology breach) submits the same body B with correlationId C' (fresh).

The wave's anchor is `(actorId, correlationId)`. New correlationId means no duplicate hit.

### 5.2 Detection only

If `payloadHash` is recorded on every audit row, forensic detection is possible (per §2.3 above). Prevention requires the anchor to include payloadHash:

```
fingerprint = (actorId, payloadHash, time_bucket)
```

This is NOT in the lock. Lock v2 uses `(actorId, correlationId, 24h)`.

**Adversarial finding RG-4:** the lock's fingerprint is client-controllable (client picks correlationId); a payloadHash-based fingerprint would be content-bound. Switching to a payloadHash-bound fingerprint is **a different design** than what the lock describes — flagged for the future migration wave.

---

## 6. Correlation-survivability gaps

The `correlationId` propagation chain has 5 hops (per `w2-pr2c-audit-coupling-review.md` §4):

```
Client → Web Proxy → Backend → Service Function → Audit Metadata
```

Each hop is a potential silent-drop.

### 6.1 Per-hop survivability

| Hop | Drop scenarios | Visibility |
|---|---|---|
| **H1: Client → Proxy** | Client doesn't send `x-correlation-id`; proxy generates fresh | Proxy log records the generation |
| **H2: Proxy → Backend** | Proxy regression / config breaks the forwarding | Backend audit row missing correlationId; visible |
| **H3: Backend route → Service** | Service signature doesn't accept correlationId param | Audit row missing correlationId; visible |
| **H4: Service → Audit metadata** | Metadata builder forgets the field | Audit row missing correlationId; visible |
| **H5: Audit metadata → Forensic query** | Query author doesn't know about field | Latent observability loss; invisible |

### 6.2 Survivability properties

- **Hops 1–4 are silent-drop-visible** (the audit row's missing field is a red flag).
- **Hop 5 is silent-drop-invisible** (a query that doesn't ask for the field doesn't know it exists).

**Adversarial finding RG-5:** the lock should mandate that every audit-row schema change is documented in `audit-row-schema.md` (a doc that does not yet exist) so forensic-query authors know what fields exist. Without this, H5 is the silent-drop frontier.

### 6.3 Test coverage

Lock v2 §7.4 tests Hop 4 (audit row contains correlationId on success and absence on duplicate). It does NOT explicitly test Hops 1–3.

**Adversarial finding RG-6:** test coverage gaps. Implementation PR must add tests:

- H1: proxy generates UUID when client absent; UUID is forwarded.
- H2: backend reads the proxy-forwarded value; confirms via audit-row presence.
- H3: service receives correlationId from route handler.

Without these, a regression at any of H1–H3 produces silent observability loss.

---

## 7. Replay observability metrics (operator-facing)

A SOC analyst should be able to answer:

| Question | Required query | Supported by Lock v2? |
|---|---|---|
| "How many duplicate retries hit our platform in the last hour?" | `COUNT(metadata->>'action' LIKE '%duplicate_request')` | YES |
| "Which actors have the highest retry rate?" | `actor_id, COUNT(*)` GROUP BY action LIKE '%duplicate%' | YES |
| "Are any captures-and-replays happening?" | `(actor_id, metadata->>'payloadHash')` with COUNT > 1 across different correlationIds | YES IF payloadHash is on every row |
| "Did the proxy fail to forward correlationId for any subset of requests?" | `COUNT(metadata->>'correlationId' IS NULL)` | YES |
| "Are there long-window replays past the 24h window?" | Cross-window query on `(actor_id, correlationId)` | YES IF audit retention covers > 24h |

The wave delivers the data shape for all of these. It does NOT pre-build dashboards. Operators must query.

**Adversarial finding RG-7:** the wave should publish a "replay-observability runbook" (`docs/ops/replay-observability-runbook.md`) with the 5 queries above. Without it, operational visibility is theoretical.

---

## 8. Replay ambiguity assessment

A SOC analyst querying audit rows can reach the WRONG conclusion in these cases:

| Ambiguous scenario | What query shows | What actually happened |
|---|---|---|
| **AMB-1** | 1 permitted row + 1 denied `duplicate_request` row for `(actor, correlationId)` | Honest-client retry; second was caught | Could ALSO be: capture-replay where attacker reused correlationId |
| **AMB-2** | 2 permitted rows for `(actor, correlationId)` | Two distinct logical operations | Could ALSO be: TOCTOU race produced duplicate |
| **AMB-3** | 1 permitted row, no denied row, but client says "I retried 3 times" | 2 retries silently dropped | Could ALSO be: client error retried but never reached the platform |
| **AMB-4** | 0 audit rows for `(actor, correlationId)` | Platform never received | Could ALSO be: H1–H4 propagation failure caused row to be written without correlationId |
| **AMB-5** | Multiple `payloadHash` rows for same actor, same hour, different correlationIds | Likely capture-replay | Could ALSO be: legitimate distinct requests that happened to hash identically (collision negligible at SHA-256) |

**Adversarial finding RG-8:** every ambiguity above produces "looks fine on the dashboard" outcomes. The replay-observability runbook (RG-7) should explicitly enumerate these and the disambiguating signals.

---

## 9. Future replay-collapse scenarios

Per `w2-pr2c-replay-governance-review.md` §7, scenarios where replay observability silently collapses:

| Scenario | Cause | Result |
|---|---|---|
| **F-1: Audit retention < 24h** | Compliance / cost decision | Duplicate-check window shrinks below intended |
| **F-2: Audit table partitioning rolls forward** | Postgres partition swap | Cross-partition queries miss prior correlationIds |
| **F-3: Multi-region eventual-consistent audit** | Architecture change | A region without prior row admits replay |
| **F-4: Audit table TRUNCATE (e.g., reset for staging)** | Operational error | All correlation context lost |
| **F-5: Migration to ledger** | Non-repudiation tightening | Need to reproduce dedup semantics |
| **F-6: Time-skew between proxy and backend** | Clock drift | 24h window boundary fuzzy |
| **F-7: correlationId UUID collision** | Negligible at v4 entropy | Confirmed not a concern |

**Adversarial finding RG-9:** F-1, F-2, F-3, F-4, F-6 are operational scenarios that silently break replay observability. The wave should add `docs/ops/replay-observability-invariants.md` enumerating which platform changes require re-validation of replay observability.

---

## 10. Replay ambiguity assessment (operator framing)

Per the prompt's required final output:

> "replay ambiguity assessment"

The platform's replay-observability mechanism after Lock v2 + W2-PR3B implementation provides:

| Property | Strength |
|---|---|
| **Detection of network-retry replays** | STRONG (correlationId clustering) |
| **Detection of client-bug double-clicks** | STRONG (same) |
| **Detection of capture-replay (with payloadHash)** | MEDIUM (forensic post-hoc; not prevention) |
| **Prevention of network-retry replays** | BEST-EFFORT (TOCTOU race exists) |
| **Prevention of capture-replay** | NONE |
| **Prevention of cross-actor replay (stolen JWT)** | NONE |
| **Prevention of long-window replay (>24h)** | NONE |
| **Prevention of fingerprint-substitution** | NONE |

**Operator's right answer to "is this platform replay-protected?":** No, the platform has REPLAY OBSERVABILITY + BEST-EFFORT IDEMPOTENCY CHECK. Capture-replay, cross-actor replay, and long-window replay are not prevented. DB-enforced replay prevention is deferred to a future migration wave (`W2-PR2B-MIG-A`).

This answer is the lexicon-aligned framing. Anything that says "yes, replay-protected" is forbidden by `TRUST_GUARANTEE_LEXICON.md` §1.3 without the substrate.

---

## 11. Recommendations

| # | Recommendation | Severity |
|---|---|---|
| **RG-Rec-1** | Replace "replay resistance" / "replay-resistant" / "replay-protected" wording with "replay observability + best-effort idempotency check" everywhere | HIGH |
| **RG-Rec-2** | Mandate `metadata.payloadHash` on EVERY audit row (permitted + denied) for capture-replay forensic detection | HIGH |
| **RG-Rec-3** | Publish `replay-observability-runbook.md` with the 5 SOC queries from §7 | MEDIUM |
| **RG-Rec-4** | Publish `replay-observability-invariants.md` with the 7 future-collapse scenarios from §9 | MEDIUM |
| **RG-Rec-5** | Add tests for correlationId Hops 1–3 (currently only Hop 4 covered) | MEDIUM |
| **RG-Rec-6** | Document the 24h window rationale and the long-lived-client cliff in Lock v2 §6 | LOW |
| **RG-Rec-7** | Disclose explicitly: the wave does NOT defend against capture-replay, cross-actor replay, long-window replay, or fingerprint substitution | HIGH |

---

## 12. Closing principle (replay governance)

Replay governance is the discipline of describing what the platform's instrumentation actually does — and refusing to describe it as more.

**The wave is safe on replay IF its surfaces use the lexicon-aligned wording. The wave is unsafe if it inherits the unqualified "replay-protected" framing.** The lexicon enforces the distinction; the runbook + invariants doc support operator interpretation; the test coverage closes the propagation gaps.

**Replay ambiguity assessment:** the wave delivers replay OBSERVABILITY (strong signal in audit metadata) + BEST-EFFORT IDEMPOTENCY CHECK (TOCTOU-race-prone). It does NOT deliver replay PROTECTION. Operator-facing copy must reflect the distinction; SOC analysts must use the runbook for disambiguation; future migration wave delivers DB-enforced prevention.
