# Semantic Drift Detection

**Status:** **CONSTITUTIONAL — DETECTION RULES** · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `constitutional-enforcement-matrix.md`, `survivability-inflation-audit.md`

This doc defines the concrete **CI-grep + PR-review detection rules** that flag semantic drift before merge. Each rule has a regex candidate, CI viability assessment, false-positive risk, and operational severity.

---

## 1. The 6 detection categories

| # | Category | Substrate doc | Severity |
|---|---|---|---|
| **D1** | Forbidden phrase detection (lexicon) | `TRUST_GUARANTEE_LEXICON.md` §1 | HIGHEST |
| **D2** | Trust-class mismatch detection | `runtime-trust-class-map.md` | HIGH |
| **D3** | Replay inflation detection | `replay-taxonomy-map.md` §10 | HIGH |
| **D4** | Audit-strength inflation detection | `w2-pr3b-audit-strength-review.md` + lexicon | HIGH |
| **D5** | Export inflation detection | `export-query-cohesion.md` | MEDIUM |
| **D6** | Taxonomy mismatch detection | `audit-event-vocabulary-map.md` | MEDIUM |

---

## 2. Detection rules (per category)

### 2.1 D1 — Forbidden phrase detection

| Phrase | Regex | CI viability | False-positive risk | Operational severity |
|---|---|---|---|---|
| non-repudiable / non-repudiation | `\bnon[\s-]?repudiab(le\|ility)\b` OR `\bnon[\s-]?repudiation\b` | 🟢 HIGH (whole-word; clear) | LOW (allowlist for grandfathered code comments per W2-PR4B) | HIGHEST — regulatory weight |
| cryptographically guaranteed | `\bcryptographically[\s-]?guarantee[ds]?\b` | 🟢 HIGH | LOW | HIGHEST |
| replay protected / replay-protected | `\breplay[\s-]?protect(ed\|ion)\b` | 🟢 HIGH | MEDIUM (OAuth/DPoP context legitimate per W2-PR4B allowlist) | HIGH |
| replay-resistant | `\breplay[\s-]?resistan(t\|ce)\b` | 🟢 HIGH | LOW | HIGH |
| signed mutation / signed mutations | `\bsigned[\s-]?mutation(s)?\b` | 🟢 HIGH | LOW | HIGH |
| tamper-proof / tamperproof | `\btamper[\s-]?proof\b` | 🟢 HIGH | LOW (per-W2-PR4B allowlist for test sentinels + claims-matrix doc + sentinel literal) | HIGHEST — regulatory + L3-substrate-absent |
| trustless | `\btrustless\b` | 🟢 HIGH | LOW | HIGH |
| provably secure | `\bprovably[\s-]?secure\b` | 🟢 HIGH | LOW | HIGH |

**CI implementation:** per `w2-pr4b-trust-language-enforcement.md` §3 — single grep pass; allowlist file at `docs/ops/trust-language-allowlist.txt`.

**PR-review viability:** ✅ HIGH — reviewer playbook checks PR description + commit messages + new audit-row literals.

### 2.2 D2 — Trust-class mismatch detection

Trust-class mismatch is SEMANTIC — hard to grep purely. Detection patterns:

| Pattern | Regex | CI viability | FP risk | Severity |
|---|---|---|---|---|
| New `prisma.auditEvent.create` site without class assignment in PR description | `prisma\.auditEvent\.create\b` (find new sites) | 🟡 PARTIAL (catches new sites; class assignment requires PR description scan) | LOW | HIGH |
| New `prisma.$transaction` block without C-1 / C-2 declaration | `prisma\.\$transaction\b` (find new sites) | 🟡 PARTIAL | LOW | HIGH |
| Use of `void` discard on Postgres write (T0 marker) | `void\s+prisma\.` | 🟡 PARTIAL (subjective) | MEDIUM | MEDIUM |

**PR-review:** per-handler class profile in PR description (per `runtime-trust-class-map.md` §10).

**Codex:** verify PR explicitly assigns trust class to every audit-emitting path it adds/modifies.

### 2.3 D3 — Replay inflation detection

Beyond D1's "replay protected" / "replay-resistant" / "replay-prevented" phrases:

| Pattern | Regex | CI viability | FP risk | Severity |
|---|---|---|---|---|
| "guaranteed dedup" | `\bguaranteed[\s-]?dedup\b` | 🟢 HIGH | LOW | HIGH |
| "atomic idempotency" | `\batomic[\s-]?idempoten(cy\|t)\b` | 🟢 HIGH | LOW | HIGH |
| "single-flight enforcement" without DB UNIQUE substrate | `\bsingle[\s-]?flight\b` | 🟡 PARTIAL (legitimate in some single-flight code patterns) | MEDIUM | MEDIUM |
| Conflation of `IDEMPOTENT_REPLAY` with `<base>.duplicate_request` | (semantic) | 🔴 LOW (CI-impossible) | n/a | HIGH |
| "0 successful replays" metric (implies prevention) | `\b0[\s-]?successful[\s-]?replays\b` | 🟢 HIGH (specific phrasing) | LOW | HIGH |

**PR-review:** per `replay-taxonomy-map.md` §10 — distinguish 5 replay states; reject "prevention" framing.

### 2.4 D4 — Audit-strength inflation detection

Per `w2-pr3b-audit-strength-review.md` AS-A..AS-J:

| Pattern | Regex | CI viability | FP risk | Severity |
|---|---|---|---|---|
| Bare "tamper-evident" without "given DB integrity" qualifier | `\btamper[\s-]?evident\b` (and check next ~50 chars don't contain "given") | 🟡 MEDIUM | MEDIUM | MEDIUM |
| "anchored audit row" without verified pipeline | `\banchored[\s-]?audit\b` | 🟢 HIGH | LOW | HIGH (substrate UNVERIFIED) |
| "Merkle audit trail" / "Merkle-anchored" | `\bMerkle[\s-]?(audit\|anchored)\b` | 🟢 HIGH | LOW | HIGH (per claims-matrix) |
| "cryptographically attested" | `\bcryptographically[\s-]?attest(ed\|ation)\b` | 🟢 HIGH | LOW | HIGH |
| "L3" or "L4" claims without anchoring pipeline | (semantic) | 🟡 PARTIAL | MEDIUM | HIGH |
| "audit-ready receipts" conflation (audit ≠ receipt) | `\baudit[\s-]?ready[\s-]?receipt\b` | 🟢 HIGH | MEDIUM (allowlist for marketing surface where claim originates) | HIGH |

### 2.5 D5 — Export inflation detection

Per `export-query-cohesion.md` §3 + `survivability-inflation-audit.md` IP-4:

| Pattern | Regex | CI viability | FP risk | Severity |
|---|---|---|---|---|
| "complete audit log via SIEM" | `\bcomplete[\s-]?audit[\s-]?log[\s-]?via[\s-]?SIEM\b` | 🟢 HIGH | LOW | MEDIUM |
| "real-time forensic visibility" | `\breal[\s-]?time[\s-]?forensic[\s-]?visibility\b` | 🟢 HIGH | LOW | MEDIUM |
| "all events streamed" without qualifier | `\ball[\s-]?events[\s-]?streamed\b` | 🟡 MEDIUM | MEDIUM | MEDIUM |
| "100% audit-trail coverage" | `\b100%[\s-]?audit[\s-]?trail\b` | 🟢 HIGH | LOW | MEDIUM |
| Forgotten DL-8 SIEM gap (PR claims SIEM-canonical without acknowledgment) | (semantic) | 🔴 LOW | n/a | MEDIUM |

### 2.6 D6 — Taxonomy mismatch detection

Per `audit-event-vocabulary-map.md` §6:

| Pattern | Regex | CI viability | FP risk | Severity |
|---|---|---|---|---|
| New `prisma.auditEvent.type: '...'` literal not in vocabulary map | `type:\s*'[A-Z_]+'` (extract; check against allowed list) | 🟡 PARTIAL (need allowed-list maintenance) | LOW (with allowlist) | MEDIUM |
| Audit-row label using forbidden token (`signed_*`, `verified_*`, `non_repudiable_*`, `proven_*`, `secured_*`, `cryptographic_*`) | `metadata\.action.*['"](signed_\|verified_\|non_repudiable_\|proven_\|secured_\|cryptographic_)` | 🟢 HIGH | LOW | HIGH |
| Use of `event_type` (Subsystem A) AND `category` (Subsystem B) AND `type` (Subsystem C) in one query without alias-map awareness | (semantic) | 🔴 LOW | n/a | LOW |

---

## 3. Composed CI-grep config (proposed)

A single CI step running all D1, D3-partial, D4, D5, D6 checks:

```yaml
name: trust-language-enforcement
on: [pull_request]
jobs:
  forbidden-phrase-scan:
    steps:
      - run: |
          # D1 forbidden phrases (whole-word)
          PHRASES="non.?repudiab(le|ility)|non.?repudiation|cryptographically.guarantee[ds]?|replay.protect(ed|ion)|replay.resistan(t|ce)|signed.mutation|tamper.?proof|trustless|provably.secure|guaranteed.dedup|atomic.idempoten(cy|t)|cryptographically.attest(ed|ation)|Merkle.(audit|anchored)|audit.ready.receipt|complete.audit.log.via.SIEM|real.time.forensic.visibility|100%.audit.trail"
          ALLOWLIST_FILE="docs/ops/trust-language-allowlist.txt"
          # Grep + allowlist filter
          violations=$(grep -rEni "$PHRASES" --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' apps packages docs | grep -v -F -f $ALLOWLIST_FILE || true)
          if [ -n "$violations" ]; then
            echo "FORBIDDEN PHRASE detected:"; echo "$violations"
            exit 1
          fi
```

**Per-PR cost:** seconds.

**Maintenance:** allowlist updates per founder + Codex SAFE per `TRUST_GUARANTEE_LEXICON.md` §6.

---

## 4. PR-review checklist (composed)

A single reviewer playbook step:

| Check | Substrate | Failure action |
|---|---|---|
| 1 | Scan PR description for forbidden phrases per §2.1 | BLOCK merge |
| 2 | Verify new audit-emitting paths declare trust class per `runtime-trust-class-map.md` | BLOCK |
| 3 | Verify replay claims use 5-state vocabulary per `replay-taxonomy-map.md` | BLOCK |
| 4 | Verify "atomic" / "tamper-evident" claims carry qualifiers per `TRUST_GUARANTEE_LEXICON.md` §3 | BLOCK |
| 5 | Verify export claims declare path per `export-query-cohesion.md` | BLOCK |
| 6 | Verify new audit-row literals don't use forbidden tokens per `audit-event-vocabulary-map.md` §4 | BLOCK |
| 7 | Cross-check against `survivability-inflation-audit.md` IP-1..IP-5 | BLOCK |

---

## 5. False-positive management

CI-grep produces false positives. Mitigation:

| FP source | Mitigation |
|---|---|
| Test sentinels (negation tests asserting forbidden phrase absent from production) | Allowlist per W2-PR4B |
| Doctrine docs that DEFINE the forbidden phrases | Allowlist (this doc, lexicon, claims matrix, etc.) |
| Frozen YC MVP code comments | Allowlist per W2-PR4B |
| OAuth/DPoP context legitimate "replay protection" | Allowlist per W2-PR4B (apps/authz, apps/docs/api-security-profiles.md, OID4VP) |
| Truthful negations (e.g., "Manifest integrity cannot be guaranteed" in `system-coherence.ts`) | Allowlist explicitly |

The allowlist is per-file + per-line + per-reason. False positives are bounded; new ones added with founder approval.

---

## 6. Drift severity matrix

| Severity | Examples | Response |
|---|---|---|
| 🔴 HIGHEST | "non-repudiable" / "tamper-proof" / "cryptographically guaranteed" inflations | BLOCK merge; founder review |
| 🟠 HIGH | "replay protected" / "atomic idempotency" / "anchored without pipeline" | BLOCK merge; reviewer + Codex re-pass |
| 🟡 MEDIUM | Unqualified "atomic" / "tamper-evident" / export inflation | Reviewer pass; doc fix required |
| 🟢 LOW | Minor wording inconsistencies | Note in PR review; may proceed |

---

## 7. Closing principle (semantic drift detection)

Drift detection is the discipline of catching inflation BEFORE it propagates. CI-grep catches the easy cases at second-cost. PR-review catches the semantic cases at hour-cost. Codex SAFE catches both at merge gate. The composed system is robust against single-method failures.

**Drift is preventable IF: (a) CI-grep wires the regex set, (b) PR-review playbook is followed, (c) Codex prompt is extended (per `codex-constitutional-prompt-layer.md`), (d) allowlist is maintained.** The 4-layer composition is the durable enforcement.
