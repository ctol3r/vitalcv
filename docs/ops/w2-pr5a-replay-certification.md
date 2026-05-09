# W2-PR5A — Replay Certification (Track B)

**Wave:** Wave 2, PR 5A — runtime legitimacy certification, replay track · **Date:** 2026-05-08 · **Status:** certification analysis only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** replay-legitimacy reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` (§1.3 forbids "replay protected"), `MUTATION_GATE_SEQUENCE.md`; consolidates `w2-pr2c-replay-governance-review.md` + `w2-pr3b-replay-governance.md`

This doc certifies the **replay observability** posture of the employer-review surface. It explicitly distinguishes **observability** (a property the wave delivers) from **prevention** (a property the wave does NOT deliver).

The central thesis: **the wave delivers REPLAY OBSERVABILITY + BEST-EFFORT IDEMPOTENCY CHECK. It does NOT deliver REPLAY PREVENTION. Per `TRUST_GUARANTEE_LEXICON.md` §1.3, "replay protected" is forbidden language; "replay observability" is the certifiable claim.**

---

## 1. Observability vs prevention — the bright line

| Property | Definition | Substrate required | Status |
|---|---|---|---|
| **Replay OBSERVABILITY** | A SOC analyst can detect that a replay occurred or was attempted | correlationId-stamped audit rows + payloadHash | **CERTIFIABLE-IN-CONTRACT (post-Lock-v2)** |
| **Best-effort IDEMPOTENCY CHECK** | The application checks for prior `(actorId, correlationId)` and returns 409 if found | application-layer query before insert | **CERTIFIABLE-IN-CONTRACT (post-Lock-v2; TOCTOU-race-prone)** |
| **Replay PREVENTION (DB-anchored)** | A replay cannot persist a duplicate row regardless of timing | DB-enforced UNIQUE on `(actor, fingerprint)` | **NOT CERTIFIABLE — deferred to W2-PR2B-MIG-A** |
| **Capture-replay PREVENTION** | A captured request cannot be re-issued | server-minted nonce OR HMAC over body keyed to session | **NOT CERTIFIABLE — absent; not in any wave's roadmap as currently scoped** |

The line: **OBSERVABILITY captures evidence; PREVENTION blocks the act.** The wave is on the observability side.

---

## 2. Replay fingerprint determinism

### 2.1 The wave's fingerprint

Per Lock v2 §6, §7.4: `(actorId, correlationId)` is the fingerprint, with a 24-hour window.

### 2.2 Determinism analysis

| Property | Status | Reason |
|---|---|---|
| Fingerprint depends only on inputs the actor controls | YES | Both components are actor / proxy-derived |
| Same logical operation → same fingerprint (when client supplies stable correlationId) | YES | Honest-client path |
| Same logical operation → DIFFERENT fingerprint (when client supplies fresh correlationId per attempt) | YES (failure mode) | Honest clients that don't reuse correlationId across retries lose dedup |
| Different logical operations → different fingerprint | NOT GUARANTEED | If correlationId UUIDs are not strictly per-operation, distinct operations may collide |
| Attacker-controlled fingerprint succeeds | YES (failure mode) | Attacker picks fresh correlationId; bypasses dedup |

**Track B finding RC-1:** the fingerprint is **client-deterministic**, not **server-deterministic**. A server-deterministic fingerprint (e.g., `HMAC(server_secret, actorId || canonical_payload || time_window)`) would be content-bound and forge-resistant — but requires server-secret management infrastructure not present today.

**Track B classification (fingerprint determinism):** **PARTIAL — honest-client deterministic; attacker-defeatable.**

---

## 3. Replay telemetry survivability

### 3.1 Per-hop survival (the 5-hop chain)

```
Client → Web Proxy → Backend → Service Function → Audit Metadata → Forensic Query
```

Per `w2-pr3b-replay-governance.md` §6:

| Hop | Drop scenario | Visibility of drop |
|---|---|---|
| H1: Client → Proxy | Client doesn't send `x-correlation-id`; proxy generates fresh per attempt | Proxy log records the generation; observable |
| H2: Proxy → Backend | Proxy regression; header not forwarded | Audit row `metadata.correlationId` IS NULL; observable |
| H3: Backend → Service | Service function signature drops the param | Same — observable |
| H4: Service → Audit metadata | Metadata builder forgets the field | Same — observable |
| H5: Audit metadata → Forensic query | Query author doesn't know the field exists | **INVISIBLE** — silent observability loss |

### 3.2 Test coverage

Lock v2 §7.4 tests Hop 4 (audit row contains correlationId on success; absent on duplicate). Hops 1–3 are NOT explicitly tested.

**Track B finding RC-2:** test coverage for Hops 1–3 must be added by the implementation PR. Without it, regression at any hop produces silent observability loss.

### 3.3 Survival across audit retention

If audit retention < 24h, the duplicate-check window collapses. If audit retention < forensic-recovery horizon (typically 6+ months), capture-replay forensics become impossible.

**Track B finding RC-3:** the wave depends on an audit-retention SLA that is not documented. Recommendation: define retention SLA respecting BOTH the 24h dedup window AND the forensic-recovery horizon.

---

## 4. Replay ambiguity — operator interpretation risks

A SOC analyst querying audit rows for replay evidence can reach the WRONG conclusion in these cases (per `w2-pr3b-replay-governance.md` §8):

| Ambiguity | What query shows | What may have happened |
|---|---|---|
| **RP-AMB-1** | 1 permitted + 1 denied `duplicate_request` for same `(actor, correlationId)` | Honest-client retry caught — OR capture-replay reusing correlationId |
| **RP-AMB-2** | 2 permitted rows for same `(actor, correlationId)` | TOCTOU race produced duplicate — OR audit-row backfill artifact |
| **RP-AMB-3** | 1 permitted, no denied row, client says retried 3 times | 2 retries silently succeeded due to race — OR client never reached platform |
| **RP-AMB-4** | 0 audit rows for `(actor, correlationId)` | Platform never received — OR H1–H4 propagation failure |
| **RP-AMB-5** | Multiple `payloadHash` for same actor, different correlationIds | Capture-replay with attacker-chosen correlationId — OR distinct legitimate operations |
| **RP-AMB-6** | Long correlationId history past 24h cliff | Audit retention covers OR window arbitrarily expanded by analyst |

**Track B finding RC-4:** every ambiguity above produces "looks fine" outcomes on a green dashboard. The replay-observability runbook (deferred per RG-Rec-3 in `w2-pr3b-replay-governance.md`) must enumerate disambiguation steps for each.

---

## 5. Replay false-confidence risks

A reader (operator, executive, customer, journalist) can form false beliefs about replay safety:

| Belief | Reality | Risk class |
|---|---|---|
| "Replays are blocked at the wire" | Best-effort application-layer check; TOCTOU race exists | HIGH — confidence-based negligence |
| "Audit count = unique operations" | Audit count >= unique operations; TOCTOU duplicates inflate | MEDIUM — analytics drift |
| "Capture-replay is mitigated" | Capture-replay with attacker-chosen correlationId succeeds | HIGH — security mental-model breach |
| "If I see a 409, my client is buggy" | Could be a slow-first-request still in-flight | LOW — operational confusion |
| "If I don't see a 409, my retry was the first" | TOCTOU could have allowed both | MEDIUM — analytics drift |
| "Replay-protected" appears in marketing → "VitalCV stops replays" | Lexicon forbids the phrase; if it leaks, mental model is wrong | HIGH — external commitment risk |

**Track B finding RC-5:** false-confidence risks are concentrated in language. The lexicon's enforcement closes the language vector; the operational disambiguation runbook closes the analyst vector.

---

## 6. Replay categories — coverage table

Per `w2-pr3b-replay-governance.md` §1, the six replay categories:

| Category | Coverage today (`9eb5cdee`) | Coverage post-Lock-v2 | Coverage post-MIG-A |
|---|---|---|---|
| **R-CAT-1: Network-retry replay** | NONE (no correlationId) | OBSERVABILITY + best-effort dedup | DB-enforced prevention |
| **R-CAT-2: Client-bug double-click** | NONE | OBSERVABILITY + best-effort dedup | DB-enforced prevention |
| **R-CAT-3: Hostile capture-and-replay** | NONE | FORENSIC DETECTION via payloadHash (if mandated) | Same as today — would require server-minted nonce |
| **R-CAT-4: Cross-actor replay (stolen JWT)** | NONE | NONE | NONE — JWT-stewardship concern, not platform |
| **R-CAT-5: Long-window replay (>24h)** | NONE | NONE — windowed | NONE — same window concern |
| **R-CAT-6: Fingerprint substitution** | NONE | NONE — client-controlled correlationId | PARTIAL — payloadHash UNIQUE would help but breaks legitimate body variations |

**Track B classification (per category):**

- R-CAT-1, R-CAT-2: **PARTIAL post-Lock-v2** (observability + best-effort) → **CERTIFIABLE post-MIG-A** (DB-enforced).
- R-CAT-3: **PARTIAL post-Lock-v2** (forensic detection only).
- R-CAT-4, R-CAT-5, R-CAT-6: **UNVERIFIED / NOT IN SCOPE** for any current wave.

---

## 7. Replay observability metrics — what operators get

A SOC analyst can answer (post-Lock-v2):

| Question | Query template | Supported? |
|---|---|---|
| "How many duplicate retries hit our platform in the last hour?" | `COUNT(*) WHERE metadata->>'action' LIKE '%duplicate_request' AND created_at > now() - '1 hour'` | YES |
| "Which actors have the highest retry rate?" | `actor_id, COUNT(*)` GROUP BY action LIKE '%duplicate%' | YES |
| "Are any captures-and-replays happening?" | `actor_id, payloadHash` HAVING COUNT > 1 across different correlationIds | YES IF payloadHash is on every row |
| "Did the proxy fail to forward correlationId?" | `COUNT(*) WHERE metadata->>'correlationId' IS NULL` | YES |
| "Are there long-window replays past 24h?" | Cross-window query | YES IF audit retention covers > 24h |

The wave delivers the data shape for all 5 queries. Pre-built dashboards are NOT in scope.

**Track B finding RC-6:** publish `docs/ops/replay-observability-runbook.md` with these 5 queries (deferred per RG-Rec-3). Without it, operational visibility is theoretical.

---

## 8. Future replay-collapse scenarios

Per `w2-pr3b-replay-governance.md` §9, scenarios that silently break replay observability:

| Scenario | Impact | Mitigation |
|---|---|---|
| **F-1** Audit retention < 24h | Window collapses below intended | Document retention SLA |
| **F-2** Audit table partitioning rolls forward | Cross-partition queries miss prior correlationIds | Cross-partition query in runbook |
| **F-3** Multi-region eventual-consistent audit | Region without prior row admits replay | Architecture change requires re-validation |
| **F-4** Audit table TRUNCATE (e.g., staging reset) | All correlation context lost | Operational discipline |
| **F-6** Time-skew between proxy and backend | 24h boundary fuzzy | NTP-sync invariant |
| **F-7** correlationId UUID collision | Negligible at v4 entropy | Confirmed not a concern |

**Track B finding RC-7:** publish `docs/ops/replay-observability-invariants.md` enumerating these (deferred per RG-Rec-4). Without it, F-1, F-2, F-3, F-4, F-6 silently degrade.

---

## 9. Replay certification classifications

### 9.1 Per-property

| Property | Today (`9eb5cdee`) | Post-Lock-v2 (under review) | Post-MIG-A (deferred) |
|---|---|---|---|
| correlationId stamping on permitted audit rows | 🔴 NONE | 🟢 **CERTIFIED-IN-CONTRACT** | 🟢 CERTIFIED |
| correlationId stamping on denied audit rows | 🔴 NONE | 🟢 **CERTIFIED-IN-CONTRACT** | 🟢 CERTIFIED |
| Application-layer dedup (best-effort) | 🔴 NONE | 🟡 **PARTIAL — TOCTOU race** | 🟢 CERTIFIED via DB UNIQUE |
| DB-enforced dedup (no race) | 🔴 NONE | 🔴 NONE | 🟢 CERTIFIED |
| Capture-replay forensic detection | 🔴 NONE | 🟡 **PARTIAL — requires payloadHash on every row (RG-Rec-2)** | 🟡 PARTIAL — same |
| Capture-replay prevention | 🔴 NONE | 🔴 NONE | 🔴 NONE — out of scope |
| Cross-actor replay defense | 🔴 NONE | 🔴 NONE | 🔴 NONE — JWT-stewardship |
| Long-window replay defense | 🔴 NONE | 🔴 NONE | 🔴 NONE — window cliff |
| Replay observability runbook | 🔴 NONE | 🟡 **DEFERRED to publication** | n/a |
| Replay observability invariants doc | 🔴 NONE | 🟡 **DEFERRED to publication** | n/a |

### 9.2 Per-handler post-Lock-v2 classification

| Handler | Replay observability | Replay prevention |
|---|---|---|
| `accept` | 🟢 CERTIFIED-IN-CONTRACT | 🟡 BEST-EFFORT (TOCTOU; existing duplicate-check + new correlationId check) |
| `confirm-start` | 🟢 CERTIFIED-IN-CONTRACT | 🟡 BEST-EFFORT (deprecation window for fallback-to-most-recent extends risk) |
| `request-refresh` | 🟢 CERTIFIED-IN-CONTRACT | 🟡 BEST-EFFORT (no idempotency anchor today; correlationId only) |
| `route-to-review` | 🟢 CERTIFIED-IN-CONTRACT | 🟡 BEST-EFFORT |
| `share-packet` | 🟢 CERTIFIED-IN-CONTRACT | 🟡 BEST-EFFORT (each retry mints fresh token; old tokens valid until expiry) |
| `packet` (GET) | 🟢 CERTIFIED-IN-CONTRACT | 🟡 BEST-EFFORT (audit row growth on retry) |

---

## 10. Required disclaimers (lexicon-aligned)

Per `TRUST_GUARANTEE_LEXICON.md` §1.3, any surface describing replay must:

1. **Use** "replay observability + best-effort idempotency check via correlationId" — NOT "replay protected" / "replay-resistant."
2. **State** the 24h window explicitly.
3. **Disclose** the TOCTOU race + capture-replay-defense absence.
4. **Reference** the future migration wave (W2-PR2B-MIG-A) for DB-enforced replay prevention.

Any PR description, audit-row label, or dashboard copy that omits these is non-conformant.

---

## 11. Track B determination

| Question | Answer |
|---|---|
| Does the wave deliver replay observability? | **YES — CERTIFIABLE-IN-CONTRACT post-Lock-v2** |
| Does the wave deliver replay prevention? | **NO — best-effort application-layer dedup; TOCTOU race exists** |
| Is the fingerprint forge-resistant? | **NO — client/proxy-controlled correlationId** |
| Does the wave defend against capture-replay? | **NO — forensic detection only, requires payloadHash mandate** |
| Does the wave defend against cross-actor replay? | **NO — JWT-stewardship concern** |
| Is replay language lexicon-conformant? | **DEPENDS on implementation PR's wording + Codex audit prompt** |

**Track B classification: PARTIAL — CERTIFIABLE-IN-CONTRACT for OBSERVABILITY; NOT CERTIFIABLE for PREVENTION.**

The wave's replay claim is honest IF lexicon-aligned. The wave's replay claim is unsafe IF inflated to "replay protection."

---

## 12. Closing principle (Track B)

Replay is a wide phrase that covers honest retries, hostile captures, and stolen-identity attacks. The wave addresses honest retries (observability + best-effort dedup) and PARTIALLY addresses hostile captures (forensic detection IF payloadHash is mandated). It does NOT address stolen-identity attacks.

**The wave is certifiable for what it does. It is unsafe if described as more.** The lexicon, the runbook (deferred), the invariants doc (deferred), and the per-handler test coverage (Hops 1–3, deferred) are the four artifacts that turn the wave's contract into operational reality.

**Replay risk assessment: STRONG OBSERVABILITY (post-Lock-v2 + lexicon-conformant wording); BEST-EFFORT PREVENTION (TOCTOU race remains until DB UNIQUE lands in MIG-A); ZERO DEFENSE against capture-replay / cross-actor / long-window / fingerprint-substitution.**
