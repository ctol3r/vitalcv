# Survivability Inflation Audit

**Status:** **GOVERNANCE** — adversarial inflation audit · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `trust-class-taxonomy.md`, `operational-guarantee-matrix.md`, `trust-boundary-clarification.md`

This doc adversarially audits VitalCV's documentation surfaces for **survivability inflation** — claims that imply atomicity, immutability, replay prevention, export certainty, or forensic completeness beyond what the runtime delivers. It catalogs each inflation pattern as truthful / inflated / operationally unsafe / partially true.

The central thesis: **inflation risk is concentrated in 5 implication patterns** that operators, dashboards, and marketing surfaces commonly reach for. Each must be flagged + replaced with lexicon-aligned wording.

---

## 1. The 5 implication patterns

| # | Implication | Forbidden phrasing examples | Operationally unsafe? |
|---|---|---|---|
| **IP-1** | **Implied atomicity** | "atomic mutation+audit" (unqualified); "all writes are atomic" | YES — conflates C-1 + C-2 + T0 |
| **IP-2** | **Implied immutability** | "tamper-proof audit log"; "immutable record" | YES — substrate is L2 (tamper-evident given DB integrity) |
| **IP-3** | **Implied replay prevention** | "replay-protected"; "replay-resistant"; "replay-secure" | YES (lexicon §1.3 forbidden); only observability + best-effort dedup exists |
| **IP-4** | **Implied export certainty** | "complete audit log via SIEM"; "real-time forensic visibility" | YES — DL-8 SIEM coverage gap; eventual consistency |
| **IP-5** | **Implied forensic completeness** | "every action audited"; "complete audit trail" | YES — Step-1 + Step-6 silent BY DESIGN; T0 partial-write |

---

## 2. Per-pattern audit

### 2.1 IP-1 — Implied atomicity

**Inflated phrasing examples:**
- "atomic mutation+audit"
- "all-or-nothing semantics"
- "transactional integrity"
- "guaranteed coupling"

**Truthful claim:** "atomic mutation+audit for the four C-1 handlers (`accept`, `request-refresh`, `route-to-review`, `confirm-start`); cosmetic single-row tx wrap (no additional rollback) for C-2 handlers (`share-packet`, `packet`); T0 paths are intentionally fire-and-forget."

**Audit verdict per surface:**

| Surface | Status |
|---|---|
| Lock v2 §6, §8 wording (current) | 🟠 **INFLATED** — uses "atomic mutation+audit" without per-handler qualifier |
| `TRUST_GUARANTEE_LEXICON.md` §3 (conditional phrase) | 🟢 **TRUTHFUL** — requires qualifier |
| `operational-alias-layer.md` §5 (lexicon-aligned wording) | 🟢 **TRUTHFUL** |
| Hypothetical PR description | 🟠 **AT RISK** — depends on author wording |

**Severity:** HIGH — the most common inflation risk in PR descriptions + commit messages.

### 2.2 IP-2 — Implied immutability

**Inflated phrasing examples:**
- "tamper-proof audit log"
- "immutable audit record"
- "cryptographically immutable"
- "blockchain-anchored" (only when ANCHORED + verifiable)

**Truthful claim:** "tamper-evident audit row given DB integrity (L2); L3 anchoring substrate exists (`anchored`, `merkleRoot` columns) but live pipeline coverage UNVERIFIED for the 6 in-scope event types."

**Audit verdict per surface:**

| Surface | Status |
|---|---|
| `TRUST_GUARANTEE_LEXICON.md` §1.5 ("tamper-proof" forbidden) | 🟢 **TRUTHFUL** — substrate-gated |
| `vitalcv-public-claims-matrix.md` (banned-list) | 🟢 **TRUTHFUL** — already banned |
| Existing test sentinels (negation tests) | 🟢 **TRUTHFUL** — assert phrase ABSENT from production |
| Hypothetical dashboard "tamper-proof badge" | 🔴 **INFLATED** if added |

**Severity:** HIGH — would inflate L2 → L3 falsely.

### 2.3 IP-3 — Implied replay prevention

**Inflated phrasing examples:**
- "replay-protected"
- "replay-resistant"
- "replay-prevented"
- "replay-immune"
- "guaranteed dedup"

**Truthful claim:** "replay observability + best-effort idempotency check via correlationId, dedup window 24h; DB-enforced replay prevention deferred to W2-PR2B-MIG-A; capture-replay forensic detection via payloadHash (post-ML-Rec-1); cross-actor / long-window / fingerprint-substitution NOT defended."

**Audit verdict per surface:**

| Surface | Status |
|---|---|
| `TRUST_GUARANTEE_LEXICON.md` §1.3 (forbidden phrases) | 🟢 **TRUTHFUL** — substrate-gated |
| `replay-taxonomy-map.md` §10 (forbidden phrases enforcement) | 🟢 **TRUTHFUL** |
| Lock v2 §1, §7 "replay resistance" wording | 🟠 **INFLATED** — flagged in W2-PR2C R2 + W2-PR3B IF-1 |
| Hypothetical marketing copy | 🔴 **INFLATED** if "replay-protected" appears |
| Hypothetical dashboard "0 successful replays" metric | 🔴 **INFLATED** — implies prevention |

**Severity:** HIGH — Lock v2's wording is the immediate inflation risk; mitigation per W2-PR2C R2 is documentation fix.

### 2.4 IP-4 — Implied export certainty

**Inflated phrasing examples:**
- "complete audit log via SIEM"
- "real-time forensic visibility"
- "all events streamed to SIEM"
- "100% audit-trail coverage"

**Truthful claim:** "EX-3 Postgres direct provides canonical forensic coverage; EX-1/EX-2 SIEM streams have known coverage gap (DL-8) for T2-direct-writer rows; SOC playbooks default to EX-3 for denial-forensic queries."

**Audit verdict per surface:**

| Surface | Status |
|---|---|
| `export-query-cohesion.md` §3 (DL-8 documentation) | 🟢 **TRUTHFUL** |
| `canonical-query-model.md` (EX-3 default) | 🟢 **TRUTHFUL** |
| Hypothetical SIEM dashboard "Real-time audit stream" | 🟠 **AT RISK** — must qualify "for T0/T1 events; T2 direct-writers via Postgres direct" |
| Hypothetical compliance pitch "100% audit-trail" | 🔴 **INFLATED** — DL-8 gap precludes |

**Severity:** MEDIUM — operational documentation already mitigates; surface inflation prevented by lexicon enforcement.

### 2.5 IP-5 — Implied forensic completeness

**Inflated phrasing examples:**
- "every action audited"
- "complete audit trail"
- "no action goes unrecorded"
- "comprehensive forensic visibility"

**Truthful claim:** "audit-emitting paths cover Step-2+ denials post-Lock-v2 + permitted operations; Step-1 (no auth) + Step-6 (tx rollback) intentionally NOT audit-emitting (web-layer logs cover pre-auth); T0 fire-and-forget paths have known partial-write window."

**Audit verdict per surface:**

| Surface | Status |
|---|---|
| `MUTATION_GATE_SEQUENCE.md` (Step-1 + Step-6 silent disclosure) | 🟢 **TRUTHFUL** |
| `w2-pr6a-denial-path-certification.md` (Step-1 silent BY DESIGN) | 🟢 **TRUTHFUL** |
| Hypothetical compliance claim "every action recorded" | 🟠 **INFLATED** — Step-1 + Step-6 silent |
| Hypothetical sales pitch "comprehensive audit" | 🟠 **AT RISK** — must qualify scope |

**Severity:** MEDIUM — substrate disclosure is required.

---

## 3. Cross-pattern aggregate

| Pattern | Truthful surfaces | Inflated surfaces (current) | Severity |
|---|---|---|---|
| IP-1 atomicity | 4 (lexicon, alias-layer, etc.) | 1 (Lock v2 wording) | HIGH |
| IP-2 immutability | 3 (lexicon, claims matrix, tests) | 0 (none current) | HIGH (preventive) |
| IP-3 replay prevention | 2 (lexicon, replay-taxonomy) | 1 (Lock v2 wording) | HIGH |
| IP-4 export certainty | 2 (export-cohesion, query-model) | 0 (none current) | MEDIUM (preventive) |
| IP-5 forensic completeness | 2 (mutation-gate-sequence, denial-path) | 0 (none current) | MEDIUM (preventive) |

**Aggregate inflation surface:** 2 current inflations (Lock v2 wording on IP-1 + IP-3); 3 preventive concerns (IP-2, IP-4, IP-5) where lexicon must remain enforced.

---

## 4. The current inflation: Lock v2 wording

Per `w2-pr2c-legitimacy-risk-register.md` R2 + R10 + `w2-pr3b-semantic-inflation-review.md` IF-1, IF-3:

**Lock v2 §1, §6, §7.4 currently say:**
- "atomic mutation+audit" (unqualified for share-packet/packet)
- "replay resistance via correlationId"

**Lexicon-aligned correction (already recommended):**
- "atomic mutation+audit for the four C-1 handlers; cosmetic single-row tx wrap for C-2 handlers"
- "replay observability + best-effort idempotency check via correlationId; DB-enforced replay prevention deferred to W2-PR2B-MIG-A"

**Action:** Lock v2 wording fix per W2-PR2C R2 + R10. Doc-only fix; high priority.

---

## 5. Per-surface scan recommendations

For each surface where inflation can occur:

| Surface | Audit method | Mitigation |
|---|---|---|
| PR descriptions | Codex SAFE prompt scan for forbidden phrases | Per `TRUST_GUARANTEE_LEXICON.md` §1 |
| Commit messages | Same | Same |
| Code comments | CI-grep allowlist mechanism | Per `w2-pr4b-trust-language-enforcement.md` §3 |
| Audit-row literal labels | Code review + lexicon §4 | Per lexicon |
| Dashboard copy | Reviewer manual check | Per dashboard-owner discipline |
| Marketing copy | Per `vitalcv-public-claims-matrix.md` | Existing CI / banned-strings |
| Doctrine docs | Codex SAFE pass on each new doc | Lexicon |
| UI artifacts | Manual review (artifacts not attached today) | Pending artifact bundle |

---

## 6. Operationally unsafe inflations (HIGHEST priority)

These inflations would directly mislead operators / SOC / compliance:

| # | Inflation | Operational hazard |
|---|---|---|
| **OUI-1** | Treating T0 as C-1 atomic | Mutation may persist while audit lost; partial-write state |
| **OUI-2** | Believing replay is prevented | False sense of security; capture-replay attack succeeds |
| **OUI-3** | Believing audit is tamper-proof | L2 (tamper-EVIDENT) ≠ L3+ (tamper-PROOF); legal admissibility differs |
| **OUI-4** | Believing pre-auth denials are audited | Pre-auth probes invisible to audit forensics |
| **OUI-5** | Believing SIEM has all denials | DL-8 SIEM coverage gap; T2 writer denials missed |
| **OUI-6** | Believing C-2 audit means delivery succeeded | PW-3 audit-vs-delivery divergence; share token issued but URL undelivered |

Mitigation: this doc + `trust-boundary-clarification.md` §3 enumerates each; operational runbook discipline + Codex audit enforcement closes.

---

## 7. Track E determination

| Question | Answer |
|---|---|
| Are inflation patterns enumerated? | YES — 5 patterns (IP-1..IP-5) |
| Are current inflations identified? | YES — 2 in Lock v2 wording |
| Are preventive concerns documented? | YES — 3 patterns require continued lexicon enforcement |
| Are operationally unsafe inflations enumerated? | YES — 6 (OUI-1..OUI-6) |
| Are mitigations per surface documented? | YES — §5 |

**Track E classification:** 🟡 **PARTIAL — 2 current inflations require Lock v2 wording fix; 3 preventive concerns require lexicon enforcement going forward; 6 operationally-unsafe inflation hazards must be flagged in operator-facing surfaces.**

---

## 8. Closing principle (survivability inflation audit)

Survivability inflation is the single most consequential governance risk in VitalCV's operational documentation surface. Code is honest; describing-language drifts. The wave's contribution is enumeration + lexicon enforcement; the durable mitigation is per-surface discipline + Codex audit prompt + CI-grep wiring.

**Inflation is preventable IF: (a) every surface uses lexicon-aligned wording, (b) Codex SAFE audits PRs for forbidden phrases, (c) CI-grep wires the seven-phrase allowlist, (d) operational runbooks enumerate the 6 OUI hazards.** The wave delivers (a)+(b)+(d) doc-side; (c) is the engineering follow-up.

**Truthful is queryable. Inflated is dangerous. Lexicon is the discipline.**
