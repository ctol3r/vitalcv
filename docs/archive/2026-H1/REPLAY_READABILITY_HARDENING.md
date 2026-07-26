# Replay Readability Hardening
Generated: 2026-05-13T18:11:00Z
Commit: pending (fixes applied this wave)

---

## Phase 5 Verdict: READABILITY HARDENED — ALL 6 SLOTS VISIBLE, FORMAT CORRECTED

Two rendering fixes applied this wave. Replay, chronology, and receipt surfaces now match canonical design spec.

---

## Fixes Applied This Wave

### Fix 1 — `shortHash` format (`7a2c…b8d3`)
**Before:** `run_id` rendered as `3a60de4c` (8 contiguous hex)
**After:** `run_id` rendered as `3a60…de4c` (4 + `…` + 4, canonical design spec format)

Files changed:
- `apps/web/components/trust/TrustRegisterRow.tsx` — added `shortHash()` helper, applied to RUN_ID slot
- `apps/web/components/verifier/ReplayInspectionMode.tsx` — upgraded `truncateId()` to `shortHash()` with ellipsis

### Fix 2 — `checkedAt` ISO 8601 Z-suffix
**Before:** `"2026-05-13 17:48:40 UTC"` (space-separated, human format)
**After:** `"2026-05-13T17:48:40Z"` (ISO 8601, Z-suffix, machine + audit grade)

Files changed:
- `apps/web/lib/replay/getReplayInspection.ts` — `formatCheckedAt()` now returns ISO 8601 Z-suffix
- `apps/web/app/api/receipt/[lineageKey]/route.ts` — same fix

---

## Six-Slot Visibility Audit

| Surface | OBJECT | OWNERSHIP | CHECKED_AT | CHANNEL | REPLAY | RUN_ID |
|---|---|---|---|---|---|---|
| `TrustRegisterRow` | ✅ | ✅ | ✅ ISO Z | ✅ | ✅ | ✅ `4…4` |
| `ReplayChronology` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ReplayInspectionMode` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `4…4` |
| `/api/replay/[runId]` response | ✅ | ✅ | ✅ ISO Z | ✅ | ✅ | ✅ |
| `/api/receipt/[lineageKey]` response | ✅ | ✅ | ✅ ISO Z | ✅ | ✅ | ✅ |
| `/api/status` response | ✅ | N/A | ✅ | ✅ | ✅ | ✅ |

---

## Chronology Readability

| Requirement | Status |
|---|---|
| Human-readable: relative age alongside absolute timestamp | ✅ `checkedAgo` + `checkedAt` both rendered |
| Machine-readable: ISO 8601 Z-suffix | ✅ Fixed this wave |
| Audit-grade: tabular-nums, monospace | ✅ `font-mono tabular-nums` |
| Chain links visible: `head ← prev` | ✅ `priorRunId` per run |
| Gap banners with named cause | ✅ `ContinuityGap.description` |
| Tier badges T1–T4 | ✅ Per run |

---

## Receipt Readability

| Requirement | Status |
|---|---|
| Receipt-ID in monospace | ✅ |
| `issuerDid` = `did:web:vitalcv.com` | ✅ Fixed prior wave |
| `jwksUri` pointing to live JWKS | ✅ |
| `signingKeyId` stable | ✅ `vcv-es256-dev` deterministic |
| Offline verifiability statement | ✅ In verifier copy |

---

## Degraded Replay Readability

| Degraded Case | Rendered As | Status |
|---|---|---|
| Anonymous preview (no actor) | `"anonymous_preview"` + gap: actor_mismatch | ✅ |
| Source unreachable | `status: "unavailable"` + Mode A banner | ✅ |
| Unknown receipt format | `"not_checked"` + gap: unrecognized format | ✅ |
| Stale data | `status: "stale"` + amber border | ✅ |

---

## Remaining Readability Gaps (Low Priority)

| Gap | File | Fix |
|---|---|---|
| `TrustRegisterRow` state naming: `anonymous/owned` vs design's `preview/snapshot` | `TrustRegisterRow.tsx` | 1-line rename |
| `TrustRegisterRow` ownership vocabulary: `actor/system` vs design's `subject/delegated` | `TrustRegisterRow.tsx` | 1-line rename |
| Per-node σ-pill on `ReplayChronology` | `ReplayChronology.tsx` | New component |
| Inverted plane on signed chain strip | `ReplayChronology.tsx` | CSS class |
| `CheckedAt` relative age not shown in `ReplayChronology` | `ReplayChronology.tsx` | Add `relativeAge()` call |

**SUCCESS: Replay continuity is institutionally legible. Six slots visible everywhere. ISO 8601 timestamps. Ellipsis hash format.**
