# Truth-Contract Restoration · Wave 1 · Summary

**Branch:** `wave/truth-contract-restoration-1` · **Worktree:** `/private/tmp/vitalcv-truth1` · **Risk classification:** GUARDED (highest of touched files: `apps/web/components/wallet/WalletPassport.tsx` — passport surface) · **Domain crossings:** 0 (single domain — copy/UX)

---

## Files changed (total: 4)

### Product code (2)

1. **`apps/web/app/clinician/research/page.tsx`** — 1 line, 1 word changed.
2. **`apps/web/components/wallet/WalletPassport.tsx`** — 1 line, 2-word phrase changed.

### Tests (1)

3. **`apps/web/__tests__/truth-contract-verified-labels.test.ts`** — new file, 5 vitest cases.

### Docs (1)

4. **`docs/ops/truth-contract-restoration-audit.md`** — inventory deliverable for the wave; cited from this summary.

---

## Exact wording removed → added

### Change 1 — `/clinician/research` readiness grid

| | Before | After |
|---|---|---|
| Term (`<dt>`) | `Verified` | `Source-verified` |
| Definition (`<dd>`) | `0 (none — verification is a separate wave)` | unchanged |

**Why:** the bare `Verified` term broke the doctrine §2.7 rule (no bare "Verified" status labels) and the parallel with the sibling terms `User-entered`, `Match pending review`, `Candidates`. The dd already carried an anti-overclaim disclaimer; the term was the lone bare-status word in an otherwise qualified grid.

### Change 2 — `WalletPassport` source-fact card

| | Before | After |
|---|---|---|
| Heading (`<p>`) | `Verified` | `Source-confirmed at` |
| Value (`<p>`) | `{formatDateTime(fact.verifiedAt)}` | unchanged |

**Why:** the heading named a status; the value rendered a timestamp. The pairing was semantically incoherent (a date can't be a status) and rendered a bare `Verified` label on the `/holder` route. Replacement names what the data actually is — the timestamp at which the source confirmed the fact. The sibling heading on the same row (`Expires` ↔ `expiresAt`) is preserved as-is; the new heading parallels that pattern.

---

## Visual hierarchy preservation check

- **Change 1:** `<dt>` element type, classes, grid positioning unchanged. Term goes from 8 chars to 15 chars; the parent `grid grid-cols-2 ... sm:grid-cols-4` accommodates the longer term without wrap (sibling `Match pending review` is already 19 chars). No layout shift.
- **Change 2:** `<p>` element type, `text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500` classes unchanged. Heading goes from 8 chars to 17 chars. Parent grid is `sm:grid-cols-2` with two-column rows; the sibling header `Expires` (7 chars) preserves the row width budget. Visual: heading row may break to 2 lines on very narrow viewports; the data line below will sit closer to the heading. Acceptable degradation, no clipping.

---

## Tests added (5 cases, all passing)

```
✓ truth-contract: bare Verified / VERIFIED labels removed (Wave Truth-1)
  ✓ research page: <dt> reads "Source-verified", not bare "Verified"
  ✓ WalletPassport: heading reads "Source-confirmed at", not bare "Verified"
✓ truth-contract: no CLAUDE.md banned strings reintroduced (Wave Truth-1)
  ✓ /clinician/research: no banned phrase present
  ✓ WalletPassport (used by /holder): no banned phrase present
✓ truth-contract: semantic-label parallel preserved (Wave Truth-1)
  ✓ research page readiness grid keeps the four semantic categories with consistent qualifiers
```

Test patterns:
- File-content scan via `fs.readFileSync` — no DOM render needed; violations are static text.
- Banned phrases split with `+` operator so this test file does not contain a literal banned string and will not trip a CI banned-string sweep.
- Regression guard scans **the two touched files only** — not a repo-wide sweep (that's the existing `apps/web/lib/source-health/` test's job).

---

## Verification artifacts (run on this branch, 2026-05-07)

```bash
pnpm install --frozen-lockfile               # ok
pnpm turbo run build --filter @vitalcv/trust-state   # cached
pnpm --filter @vitalcv/web exec vitest run __tests__/truth-contract-verified-labels.test.ts
# Test Files  1 passed (1)
#       Tests  5 passed (5)

pnpm --filter @vitalcv/web exec next lint --file <three-touched-files>
# ✔ No ESLint warnings or errors

pnpm --filter @vitalcv/web exec vitest run         # full suite
# Test Files  156 passed | 1 skipped (157)
#       Tests  1463 passed | 4 skipped (1467)
# Code Red baseline was 1458 → 1458 + 5 new = 1463. No regressions.

pnpm turbo run build --filter @vitalcv/web
#  Tasks:    13 successful, 13 total
#  Cached:   12 cached, 13 total
#  Time:     34.186s
```

---

## Intentionally deferred issues

These were found in the audit and are tracked as separate scoped follow-ups. They are NOT in this PR.

| Item | Reason deferred | Recommended PR |
|---|---|---|
| `_archive/wave119/*` banned strings ("real time" claims, "Instant credentialing") | Next.js underscore-private folders, not user-routable. Deletion ≠ wording change ≠ this PR's concern. | `chore: delete _archive/wave119/` (single-concern, ~95 file deletions) |
| Orphaned components carrying banned wording (SandboxHero, AcceptanceNetwork, HomeSections, ReadinessDemo, EmployerDashboard, DailyUtilityLoop, FocusModeQR, ApplyWidgetConfig, PrequalifyModal, EmployerReviewDashboard) | Zero consumers in `apps/web/app`; deletion is structurally separate from wording fixes. | `chore: delete unused legacy components after Code Red close` |
| `apps/web/components/marketing/ReadinessDemo.tsx` claims DEA / ABMS / state-license verified | Marketing component, no consumer in `apps/web/app`. If `apps/marketing` (separate app) imports it, that's an `apps/marketing` PR per CLAUDE.md ("do not pull web changes into it"). | `truth(marketing): align ReadinessDemo with shipped integrations` |
| `apps/web/lib/catalog/credentialCatalog.ts` lists DEA + NPDB | Audit P1 W1.3 finding — its own surgical PR. Catalog is GUARDED file; deserves its own scope. | `truth(catalog): mark unintegrated sources (W1.3)` |
| `apps/web/components/sandbox/EmployerReviewDashboard.tsx` SAM.gov / DEA / ABMS claims | Consumer is `SandboxApp` which has zero consumers in `apps/web/app`. | Same `chore: delete unused` PR |
| Bridge: OIG `MatchConfidence: 'possible_match'` (post-#272) → `standing.exclusionStatus = 'POSSIBLE_MATCH'` | Backend identity bridge; HIGH_RISK file scope (`apps/api/backend/src/services/identity/`). Out of this wave's domain. | `feat(backend): wire OIG possible_match through to standing.exclusionStatus` |

---

## Remaining truth risks (after this PR merges)

1. **Orphan-component decay:** the legacy components carrying banned wording remain in the repo. They are not user-reachable today, but a future PR could re-import them without realizing the wording is bad. **Mitigation:** the `apps/web/lib/source-health/unavailableLane.bannedPhrases.test.ts` already does a repo-wide banned-string sweep (per its 17 test cases). Confirm it covers the orphan paths; if not, broaden it in the cleanup PR.

2. **`ReadinessDemo.tsx` (marketing)** could be re-imported by `apps/marketing`. The cleanup PR for orphans should either delete or fix this component before its first re-use.

3. **Catalog drift (W1.3):** `credentialCatalog.ts` advertises DEA / NPDB to the credential checklist UI. Until W1.3 lands, anything that consumes the catalog at the user surface inherits the drift.

4. **The new wording labels (`Source-verified`, `Source-confirmed at`)** are introduced by this PR; if a future contributor copies the bare `Verified` form from old code without reading the doctrine, regression is possible. **Mitigation:** the new test in this PR locks the form on the touched files; a stronger CI gate that asserts `>Verified<` is absent across all of `apps/web/app + apps/web/components` is recommended (not in this PR — that would be its own scoped CI gate PR).

---

## Rollback notes

If this PR breaks anything:

```bash
# Single-command rollback (preferred — git history clean)
gh pr revert <PR-NUMBER> --title "revert: truth-contract restoration wave 1"

# Manual fallback
git revert <merge-commit-sha>
git push origin main
```

**Blast radius if reverted:** the bare `>Verified<` label returns to `/clinician/research` and `/holder` until the next fix. Both surfaces are gated CLINICIAN role; no public-marketing exposure. No data, schema, or auth state is affected.

**Forward-fix preferred over revert** for any wording adjustment — the changes are pure copy. Revert is reserved for visual/layout regression.

---

## Per-PR doctrine compliance checklist

Per `docs/ops/VITALCV_OPERATING_DOCTRINE.md` closing section, this PR satisfies:

- [x] No banned strings introduced (§2.5) — test asserts
- [x] No bare `>Verified<` rendered (§2.7) — test asserts both fixed surfaces
- [x] No new vendor name claimed as integrated (§1.2) — no vendor names touched
- [x] Every new mutating endpoint writes an `AuditEvent` (§5.1) — N/A (no endpoint touched)
- [x] Every new demo surface carries `recordedBy: 'demo'` + banner (§4.1) — N/A (no demo surface touched)
- [x] Every new score/level path consults source coverage (§8.1, §8.5) — N/A (no scoring path touched)
- [x] No literal-typed invariant widened to `boolean` / general string (§2.3, §6.3) — no literal touched
- [x] No env flag introduced that bypasses auth, audit, or RBAC (§6.4) — no flag touched
- [x] Every claim cites a source path or carries a tagged limitation (§3, §5.3) — replacement wording cites no source it doesn't have
- [ ] Codex SAFE verdict in transcript before `gh pr merge` (§6.1) — **REQUIRED BEFORE MERGE — see Codex audit prompt below**
