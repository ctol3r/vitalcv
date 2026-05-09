# Codex Constitutional Prompt Layer

**Status:** **CONSTITUTIONAL — CODEX PROMPT EXTENSION** · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `constitutional-enforcement-matrix.md`, `semantic-drift-detection.md`, `runtime-trust-class-map.md`, `replay-taxonomy-map.md`

This doc designs the **mandatory Codex SAFE governance prompt extensions** — the specific instructions Codex must include in every wave audit to prevent inflation. Codex SAFE is the merge gate; the prompt layer is the discipline that makes the gate operationally enforceable.

The contract: **Codex MUST classify trust class, replay durability, export durability, lineage type, drift risk, and survivability inflation.** Codex MUST reject 4 classes of inflation. Wave PRs that don't satisfy these are denied SAFE verdict.

---

## 1. Mandatory Codex audit responsibilities

For every wave audit, Codex MUST perform 6 classifications + 4 rejections:

### 1.1 Classifications

| # | What Codex classifies | Source of truth | Output format |
|---|---|---|---|
| **CC-1** | Trust class of every audit-emitting path | `runtime-trust-class-map.md` | "C-1 / C-2 / T0 / R0 / D0" with sub-class |
| **CC-2** | Replay durability of every replay-related claim | `operational-guarantee-matrix.md` + `replay-taxonomy-map.md` | "STRONG / PARTIAL / WEAK / FRAGILE" + R-state |
| **CC-3** | Export durability per export-path claim | `operational-guarantee-matrix.md` + `export-query-cohesion.md` | "STRONG / PARTIAL / WEAK / FRAGILE" + EX path |
| **CC-4** | Lineage type for cross-cutting claims | `trust-boundary-clarification.md` | "L-T / L-E / L-RO / L-RF / L-ED / L-DF" |
| **CC-5** | Drift risk per surface | `constitutional-drift-registry.md` (Track E) | "CONTROLLED / PARTIAL / DRIFT-PRONE / UNCONTROLLED" |
| **CC-6** | Survivability inflation pattern | `survivability-inflation-audit.md` IP-1..IP-5 | "IP-1 / IP-2 / IP-3 / IP-4 / IP-5 / NONE" |

### 1.2 Rejections

| # | What Codex rejects | Substrate test |
|---|---|---|
| **CR-1** | Non-repudiation inflation | Phrase scan per `TRUST_GUARANTEE_LEXICON.md` §1.1 |
| **CR-2** | Replay-prevention inflation | Phrase scan per lexicon §1.3 + replay-taxonomy claims |
| **CR-3** | Export-certainty inflation | Phrase scan per IP-4 + export-cohesion DL-8 acknowledgment |
| **CR-4** | Transactional-overstatement inflation | Phrase scan per IP-1 + per-handler trust-class verification |

---

## 2. The Codex SAFE prompt extension (exact text proposal)

This is the verbatim addition to the Codex SAFE audit prompt for every wave going forward:

```
ADDITIONAL GOVERNANCE AUDIT — VITALCV CONSTITUTIONAL LAYER
===========================================================

For this PR, you MUST verify the following constitutional requirements
in ADDITION to your standard SAFE audit:

1. TRUST-CLASS CLASSIFICATION (CC-1)
   For every new or modified audit-emitting code path in this PR,
   classify it as one of: C-1 / C-2 / T0 / R0 / D0 (see
   docs/ops/runtime-trust-class-map.md).
   - C-1: prisma.$transaction wrapping mutation+audit (atomic).
   - C-2: prisma.$transaction wrapping single audit row (cosmetic).
   - T0: void-discarded fire-and-forget audit write.
   - R0: replay-related event emission.
   - D0: denied-path audit emission.
   REJECT if PR description doesn't declare class for new/modified paths.

2. REPLAY DURABILITY (CC-2)
   For any replay-related claim in PR description / code comments /
   audit-row labels, classify as STRONG / PARTIAL / WEAK / FRAGILE
   (see docs/ops/operational-guarantee-matrix.md row 2).
   REJECT if claim implies replay PREVENTION (lexicon §1.3 forbids
   "replay protected", "replay-resistant", "replay-secure",
   "replay-prevented", "replay-immune", "guaranteed dedup",
   "atomic idempotency").

3. EXPORT DURABILITY (CC-3)
   For any export-related claim, declare which export path
   (EX-1 / EX-2 / EX-3 / EX-4) and classify durability.
   REJECT if PR claims SIEM stream is canonical for denial forensics
   (see docs/ops/export-query-cohesion.md DL-8 SIEM coverage gap).

4. LINEAGE TYPE (CC-4)
   For cross-cutting lineage claims, identify lineage type:
   L-T / L-E / L-RO / L-RF / L-ED / L-DF (see
   docs/ops/trust-boundary-clarification.md §1).
   REJECT if claim conflates L-T (transactional) with L-E (eventual).

5. DRIFT RISK (CC-5)
   Per docs/ops/constitutional-drift-registry.md (Track E),
   identify drift risks the PR introduces or perpetuates.
   REJECT if PR introduces UNCONTROLLED drift.

6. SURVIVABILITY INFLATION (CC-6)
   Scan PR description, commit messages, code comments, audit-row
   labels, and any new doc surfaces for the 5 implication patterns
   (see docs/ops/survivability-inflation-audit.md):
   - IP-1: implied atomicity (unqualified "atomic mutation+audit")
   - IP-2: implied immutability ("tamper-proof")
   - IP-3: implied replay prevention
   - IP-4: implied export certainty ("complete audit log via SIEM")
   - IP-5: implied forensic completeness ("every action audited")
   REJECT if any IP-1..IP-5 inflation present.

7. FORBIDDEN PHRASE SCAN (lexicon §1)
   Scan all PR-modified content for the 7 forbidden phrases:
   - non-repudiable / non-repudiation
   - cryptographically guaranteed
   - replay protected / replay-resistant
   - signed mutation
   - tamper-proof
   - trustless
   - provably secure
   REJECT unless covered by docs/ops/trust-language-allowlist.txt.

8. AUDIT-ROW LITERAL DISCIPLINE
   For any new audit-row event-type or metadata.action literal,
   verify it doesn't contain forbidden tokens:
   signed_*, verified_*, non_repudiable_*, proven_*,
   secured_*, cryptographic_*.
   REJECT if forbidden token used.

9. PER-HANDLER CAVEATS
   For C-1 paths, verify PR acknowledges:
   - Pre-tx race window (HCA-1).
   - Side-effect post-tx fire-and-forget (HCA-3).
   - Isolation level not explicitly set (HCA-5).
   For C-2 paths, verify PR acknowledges:
   - Audit-vs-delivery divergence (PW-3).
   - Audit-as-persistence pattern.
   REJECT if PR claims unqualified "atomic" without these.

10. DENIAL EMISSION COMPLETENESS
    For wave's mutation handlers, verify PR includes test cases for
    EVERY denied-path emission case enumerated in
    docs/ops/w2-pr2b-implementation-lock-v2.md §8 (role_denied,
    no_org_context, entity_not_found, acceptance_blocked,
    already_accepted, no_prior_acceptance, duplicate_request,
    malformed_resource_id).
    REJECT if any path lacks denial-emission test coverage
    (DC-4 regression risk per docs/ops/w2-pr9a-replay-survivability.md).

11. PAYLOADHASH MANDATE (when applicable)
    For audit rows in this PR, verify metadata.payloadHash is
    populated on EVERY row (permitted + denied) per RG-Rec-2 +
    DC-Rec-2 + ML-Rec-1.
    REJECT if payloadHash missing on any audit-emitting path.

12. VERDICT FORMAT
    Codex SAFE verdict for this PR MUST include:
    - "Constitutional layer: PASS" or "Constitutional layer: REJECT"
    - For PASS: list all classifications (CC-1..CC-6).
    - For REJECT: list specific violations + rejection reasons (CR-1..CR-4).
    - Cross-reference doctrine docs that govern each finding.
```

---

## 3. Codex prompt invocation pattern

For every wave PR, the merge-gate hook invokes Codex SAFE with:

```
codex exec --safe \
  --doctrine-bundle "TRUST_GUARANTEE_LEXICON.md trust-class-taxonomy.md operational-guarantee-matrix.md replay-taxonomy-map.md export-query-cohesion.md trust-boundary-clarification.md survivability-inflation-audit.md constitutional-enforcement-matrix.md" \
  --constitutional-prompt "(per §2 above)" \
  --pr <PR-URL>
```

The constitutional prompt is a STANDING extension; the doctrine-bundle list ensures Codex has the substrate references.

---

## 4. Per-wave Codex output format

For wave merges:

```
WAVE: W2-PR<N><X>
PR: #<N>
Reviewed by: Codex SAFE (vN.NNN)

STANDARD SAFE AUDIT
===================
Implementation review: PASS / REJECT
Diff review: PASS / REJECT
Copy review: PASS / REJECT

CONSTITUTIONAL LAYER AUDIT
==========================
CC-1 Trust-class classification:
  - apps/.../<file>:<line>: C-1 + R0-Lock-v2-Denial + D0-Step-2/4/5
  - apps/.../<other>:<line>: C-2 + D0-Step-2/5
  ...

CC-2 Replay durability claims:
  - Lock v2 §X "replay observability + best-effort idempotency check": PARTIAL
  ...

CC-3 Export durability claims:
  - PR description "queryable via EX-3 Postgres direct": STRONG
  ...

CC-4 Lineage type identification:
  - PR §Y claim "transactional mutation+audit": L-T
  - PR §Z claim "side-effects post-commit": L-E
  ...

CC-5 Drift risk:
  - GS-1 lexicon: CONTROLLED (no forbidden phrases)
  - GS-3 replay taxonomy: PARTIAL (uses correct vocabulary)
  ...

CC-6 Survivability inflation patterns:
  - IP-1 atomicity: NONE
  - IP-3 replay prevention: NONE
  - ...

REJECTION CHECKS
================
CR-1 Non-repudiation inflation: NONE
CR-2 Replay-prevention inflation: NONE
CR-3 Export-certainty inflation: NONE
CR-4 Transactional-overstatement inflation: NONE

FORBIDDEN PHRASE SCAN
=====================
- "non-repudiable": 0 hits in modified content (allowlist: 11 grandfathered hits in legacy code)
- "tamper-proof": 0 hits
- ...

AUDIT-ROW LITERAL DISCIPLINE
============================
New literals introduced: 0
Forbidden tokens: NONE

PER-HANDLER CAVEATS
===================
- accept (C-1): HCA-1 + HCA-3 + HCA-5 acknowledged in PR description
- share-packet (C-2): PW-3 acknowledged
- ...

DENIAL EMISSION COMPLETENESS
============================
Test coverage for all 8 denial reasons: VERIFIED

PAYLOADHASH MANDATE
===================
Verified on all 6 wave-scope handlers: PASS

CONSTITUTIONAL VERDICT: PASS
```

---

## 5. Rejection escalation

When Codex REJECTS:

| Rejection class | Escalation |
|---|---|
| CR-1 (non-repudiation inflation) | Founder review BEFORE re-submit |
| CR-2 (replay-prevention inflation) | Author + reviewer fix wording; Codex re-audit |
| CR-3 (export-certainty inflation) | Same |
| CR-4 (transactional-overstatement) | Same |
| CC-1..CC-6 missing | Author updates PR description; Codex re-audit |
| Forbidden phrase scan | Author updates content OR allowlist (latter requires founder approval) |
| Audit-row literal discipline | Author renames literal; Codex re-audit |
| Per-handler caveat missing | Author updates PR description |
| Denial emission test missing | Author adds test; full implementation re-test |
| payloadHash missing | Author wires payloadHash on all audit emissions |

Most rejections are author-side fixes (doc updates + minor code changes). Lock-v2-wording-class rejections (current open) require Lock v2 author to update the lock doc — separate PR.

---

## 6. Codex prompt versioning

The constitutional prompt is itself versioned. Updates require:

1. Founder approval per `TRUST_GUARANTEE_LEXICON.md` §6.
2. Cross-reference to wave that introduces the version.
3. Backward-compatibility statement (will old waves fail under new prompt? if yes, plan deprecation).

Initial version: **v1.0** — this doc.

Future versions add new classifications / rejections as new constitutional surfaces emerge.

---

## 7. Closing principle (Codex constitutional prompt layer)

The Codex prompt layer makes the constitutional governance OPERATIONALLY ENFORCEABLE at the merge gate. Without it, the lexicon + trust classes + replay taxonomy are documented but unenforced. With it, every wave PR is filtered against 6 classifications + 4 rejections + 12 substantive checks.

**Documentation alone is NOT enforcement (per non-negotiable rule #1). Codex SAFE is the durable enforcement frontier — the prompt layer is the operational discipline that makes the frontier load-bearing.**

The merge gate now has constitutional teeth.
