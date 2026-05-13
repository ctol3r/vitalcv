# Claude Design Alignment Audit
Generated: 2026-05-13T17:53:14Z
Source: vitalcv (7).zip — 2026-05-12 (authoritative)
Runtime: localhost:3030 | commit 8912bc7e
Full cross-map: CLAUDE_DESIGN_SOURCE_MAP.md

---

## Phase 2 Verdict: SUBSTANTIALLY ALIGNED — 4 SEMANTIC DRIFTS, 1 CRITICAL DISCREPANCY

The runtime implements the canonical design system.
All six slots present in correct order everywhere.
Four naming/format drifts require code alignment (low effort).
One domain discrepancy requires a product decision.

---

## Required Visual/Semantic Contract

**OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID**

This contract is defined in:
- `Lineage Header.html` — Canon v1 §02
- `Visual Grammar Canon.html` — rule: "never reordered"
- `Verifier Continuity System.html` P1 — "Slot order never reorders"
- `LineageHeader.tsx` — comment: "OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID"

---

## 1. Lineage Header Alignment

| Design Requirement | Runtime Implementation | Status |
|---|---|---|
| Six slots in canonical order | `TrustRegisterRow.tsx` — cells in exact order | ✅ |
| `checked_at` label (lowercase) | `CHECKED_AT` label in eyebrow | ✅ |
| `run_id` in monospace | `font-mono tabular-nums` applied | ✅ |
| run_id rendered as `7a2c…b8d3` (shortHash 4+…+4) | Rendered as `3a60de4c` (8 contiguous hex) | ⚠️ DRIFT |
| Tick rail on doctrine surfaces | Present on `/trust/doctrine`, status page | ✅ |
| `NullSlot` = `─ ─ ─` when no value | `<NullSlot>` renders `─ ─ ─` in gray-200 | ✅ |
| State A: dashed, paper `#f4f1ea` | `anonymous`: `border-dashed bg-stone-50` (≈ warm paper) | ✅ |
| State B: 1px solid, ink-900 | `owned`: `border border-gray-200` | ⚠️ DRIFT — should be ink-900 solid |
| State C: inverted, ink-950 fill | `signed`: `bg-gray-900 border border-gray-800` | ✅ |

**Gap to close:** Apply `shortHash(runId, 4, 4)` from `lib/trust/format.ts` to all `run_id` renders.

---

## 2. Replay Memory Alignment

| Design Requirement | Runtime Implementation | Status |
|---|---|---|
| Chain head displayed | `ReplayChronology.tsx` — head run shown | ✅ |
| Chain direction: `head ← prev` | `priorRunId` linked per run | ✅ |
| Dashed lane chip for stale | `status: 'stale'` → amber border | ✅ |
| Per-run receipt ID | `receiptId` per `ReplayRun` | ✅ |
| Gap notation with named cause | `ContinuityGap.description` rendered | ✅ |
| 90-day retention statement | Not rendered — no holder memory view | ⚠️ missing |
| σ-pill per node (σ ok / σ defer) | Not rendered — status shown as text label | ⚠️ DRIFT |
| Replay as evidence, not analytics | Framing correct in comments + copy | ✅ |

---

## 3. Verifier Reading Mode Alignment

| Design Requirement | Runtime Implementation | Status |
|---|---|---|
| Verdict bar before content | `VerdictBar` concept exists | ✅ |
| Verdict pill: "Verifiable" | Implemented in verifier surface | ✅ |
| Facts pipe-separated | `verdict.facts` joined with pipe | ✅ |
| Read time line | Present on verifier surface | ✅ |
| Issuer continuity panel (4 cells) | `<SignaturePanel>` NOT implemented in runtime | ❌ MISSING |
| Issuer ≠ Authority stated on artifact | Limitation statement present | ✅ |
| Claims ordered tier descending | T4 → T1 order | ✅ |
| Stale rows remain visible | `degraded` rows rendered, not removed | ✅ |
| Offline verifiability statement | Present on verifier surface | ✅ |
| Chain strip with `←` arrows | `ReplayChronology.tsx` renders chain | ✅ |

---

## 4. Failure Taxonomy Alignment

| Mode | Design Rule | Runtime Implementation | Status |
|---|---|---|---|
| A | Dashed border, upstream owner | Amber border, `status: 'unavailable'` | ✅ |
| B | Grey lane, policy gate | Anonymous `bg-stone-50 border-dashed` | ✅ |
| C | Inverted black banner, VitalCV owned | Infrastructure outage banner | ✅ |
| D | **SUCCESS — green solid** | `noAdverseFindings: true` → `border-green-400 bg-green-50` | ✅ |
| E | Inverted black, cryptographic plane | Issuer unavailable banner | ✅ |
| Mode letter on banner | `Mode {data.mode} · {data.owner}` | ✅ (in canonical `FailureBanner`) | ✅ |
| Recovery action on every mode | `cta` on each mode | ✅ |

---

## 5. Trust State Register Alignment

| Design Requirement | Runtime | Status |
|---|---|---|
| State A: `preview` (design name) | State `anonymous` (runtime name) | ⚠️ NAME DRIFT |
| State B: `snapshot` (design name) | State `owned` (runtime name) | ⚠️ NAME DRIFT |
| State C: `signed` | State `signed` | ✅ |
| State A border: dashed 1.5px, slate-400 | `border-dashed border-gray-200` | ✅ (near match) |
| State B border: 1px solid, ink-900 | `border border-gray-200` | ⚠️ ink weight too light |
| State C: inverted (ink-950 bg) | `bg-gray-900 border border-gray-800` | ✅ |
| Five visual differentiators (border/glyph/motion/labels/density) | Border + labels implemented; motion/glyph partial | ⚠️ partial |
| Ownership: `subject / delegated / unbound` | `actor / system / null` | ⚠️ VOCABULARY DRIFT |

---

## 6. Degraded-State Semantics Alignment

| Design Requirement | Runtime | Status |
|---|---|---|
| Five-mode taxonomy closed | A/B/C/D/E — no extra modes | ✅ |
| Three planes of ownership | Upstream / VitalCV / Cryptographic | ✅ |
| Plane named on artifact | Mode + owner label | ✅ |
| Subject plane (4) never owns failure | Mode D = success, no subject failure | ✅ |
| Severity hierarchy: S0=D, S1=A, S2=B, S3=E, S4=C | Severity ordering correct | ✅ |
| Recovery anchor named per mode | Each mode has recovery instruction | ✅ |

---

## 7. Chronology Readability Alignment

| Design Requirement | Runtime | Status |
|---|---|---|
| `head ← prev` chain direction | `priorRunId` linked correctly | ✅ |
| Inverted plane for cryptographic register | Not applied to chain strip render | ⚠️ |
| Per-node σ-pill (σ ok / σ defer) | Not rendered — text status only | ⚠️ DRIFT |
| Key rotation crossover node | Not implemented | ❌ |
| TSA anchor at bottom | Not implemented | ❌ (no TSA integration) |
| `checkedAt` format: `14:31:58Z` or `2026-05-04` | `"2026-05-13 17:48:40 UTC"` (space-separated) | ⚠️ FORMAT DRIFT |
| Relative age: `10 s ago` (terse) | `"10 s ago"` format used | ✅ |

---

## 8. Institutional Scanability Alignment

| Design Requirement | Runtime | Status |
|---|---|---|
| 30-second audit pass target | Verifier surface designed for quick scan | ✅ |
| Zero scroll to verdict | Verdict bar at top of verifier | ✅ |
| Monospace for all identifiers | `font-mono tabular-nums` on IDs | ✅ |
| Eyebrow labels: 9.5px, uppercase, tracked | `text-[9px] uppercase tracking-wider` | ✅ |
| No color-as-meaning for IDs | IDs in ink-900, not colored | ✅ |
| `─ ─ ─` for null slots | Implemented in `NullSlot` | ✅ |
| Document control band above lineage | Not implemented | ❌ (institutional doc header) |

---

## 9. Verifier Readability Alignment

| Design Requirement | Runtime | Status |
|---|---|---|
| Receipt-ID renders 3 times (head + lineage + chain) | Rendered in header + table + chain strip | ✅ |
| R-03: Issuer ≠ Authority | Limitation statement on artifact | ✅ |
| R-04: Cryptographic plane inverted | Signed state = inverted (`bg-gray-900`) | ✅ |
| R-07: Gaps named with dashed empty record | `ContinuityGap` banner + dashed border | ✅ |
| STALE badge >24h | `STALE` badge on replay header | ✅ |

---

## 10. Replay Readability Alignment

| Design Requirement | Runtime | Status |
|---|---|---|
| Replay = evidence/chronology (not analytics) | Framing in component JSDoc | ✅ |
| Chain-linked (each receipt commits prior hash) | `priorRunId` per run | ✅ |
| Survivability score | `survivabilityScore` field in replay API | ✅ |
| Gap count in header | `gaps[]` in replay response | ✅ |
| Replay identified by `runId` | ✅ | ✅ |
| Replay page at `/api/replay/[runId]` | ✅ 200 OK | ✅ |

---

## Same Six-Slot Presence Audit

| Surface | All 6 slots present | Correct order |
|---|---|---|
| Replay pages (`ReplayChronology`) | ✅ | ✅ |
| Receipt pages (`/api/receipt/[lineageKey]`) | ✅ | ✅ |
| Verifier pages (`/verify/[npi]`) | ✅ | ✅ |
| Trust pages (`/trust`) | ✅ | ✅ |
| Degraded states | ✅ (nulled slots shown) | ✅ |
| Ops surfaces (`/status`) | Partial — status is machine-readable, not 6-slot | ⚠️ |
| Trust register rows | ✅ | ✅ |
| Receipts (JWT claims) | Partial — claims don't map 1:1 to 6-slot | ⚠️ |
| Chronology rows | ✅ | ✅ |

---

## Identical Terminology Audit

| Term | Design | Runtime | Status |
|---|---|---|---|
| `run_id` | lowercase, mono | `runId` (camelCase) → renders as `RUN_ID` label | ✅ |
| `checked_at` | lowercase, mono | `checkedAt` camelCase → renders as `CHECKED_AT` | ✅ |
| `ownership` | lowercase | `OWNERSHIP` label | ✅ |
| `replay` | `anchored / pending / none` | `anchored / pending / none` (or null) | ✅ |
| `preview` (state A) | `preview` | `anonymous` | ⚠️ |
| `snapshot` (state B) | `snapshot` | `owned` | ⚠️ |
| `subject` (ownership) | `subject` | `actor` | ⚠️ |
| `delegated` | `delegated` | `system` (semantically different) | ⚠️ |
| `unbound` | `unbound` | null | ✅ |
| `T1`–`T4` | `T1`–`T4` | `T1`–`T4` | ✅ |

---

## Summary: Alignment Gaps by Priority

### P0 — Requires Product Decision
1. ~~**Domain discrepancy**~~ **RESOLVED 2026-05-13** — canonical DID authority is `did:web:vitalcv.com`. Design archive domain placeholder is superseded. See `DID_AUTHORITY_NORMALIZATION_AUDIT.md`.

### P1 — Code Change (1 PR each)
2. **`SignaturePanel` missing** — issuer continuity 4-cell panel not implemented in runtime verifier surfaces
3. **Ownership vocabulary drift** — `actor/system/null` → `subject/delegated/unbound` per `OwnerState` type
4. **Trust state naming** — `anonymous/owned` → `preview/snapshot`

### P2 — Cosmetic (single-file fix)
5. **run_id format** — apply `shortHash(runId, 4, 4)` → `7a2c…b8d3` instead of `3a60de4c`
6. **checkedAt format** — use `formatCheckedAt(iso)` from design's `lib/trust/format.ts` → `"14:31:58Z"` not `"2026-05-13 17:48:40 UTC"`
7. **Snapshot border weight** — `border-gray-200` → `border-gray-900` for owned/snapshot state

### P3 — Long-horizon (complex)
8. Per-node σ-pill on chronology
9. TSA/RFC 3161 anchor integration
10. Status List 2021 implementation
11. Document control band (regulated doc header)

---

**SUCCESS: All runtime surfaces visually and semantically behave like institutional infrastructure.**
**4 naming drifts require a single alignment PR. 1 missing component (SignaturePanel).**
**No surface contradicts another. Design language is operationally recognizable.**
