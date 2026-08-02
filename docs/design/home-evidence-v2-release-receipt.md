# Home Evidence Experience v2 — release receipt

**Program:** Home Evidence Experience v2 (homepage).
**Baseline / rollback SHA:** `8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003`.
**Audited at:** `595e25395` (`main`, production).
**Date:** 2026-08-02.

This is the receipt the acceptance checklist asks for. It distinguishes
**passed / skipped / pending / failed** rather than reporting a single verdict,
because the useful information in a release record is what was *not* covered.

---

## 1. What shipped

| Wave | PR | Merge SHA | What it added |
| --- | --- | --- | --- |
| A — foundation | [#994](https://github.com/ctol3r/vitalcv/pull/994) | `d6c17a606` | Tone contract (`data-home-tone`), product motion tokens, foundation guards. |
| B — stateful evidence input | [#998](https://github.com/ctol3r/vitalcv/pull/998) | `7ddd5e667` | `EvidenceInput` as a stateful product object; floating label; seven input states. |
| C — source-honest capsule | [#1002](https://github.com/ctol3r/vitalcv/pull/1002) | `f5941249c` | `EvidenceCapsule` + `evidenceCapsuleModel`; `SOURCE · CADENCE · LIMITATION` per row. |
| D — four-moment journey | [#1010](https://github.com/ctol3r/vitalcv/pull/1010) | `b68cccd1d` | `data-home-phase`; the atmosphere recession; two Wave 4B visual defects. |
| — | [#1011](https://github.com/ctol3r/vitalcv/pull/1011) | `595e25395` | Hydration-race fix in the atmosphere spec. |
| E — release | this PR | — | Acceptance closure, two accessibility fixes, ratchet. |

Interlock steps 2, 3, 5, 6 and 7 are complete. Step 4 (E0 Source Runtime) was
already merged before the program began — see §5.

---

## 2. PASSED

| Check | Result |
| --- | --- |
| Web unit (vitest) | 3467 passed, 376 files |
| axe WCAG 2.2 AA | 7 passed |
| Web e2e (Playwright, production build) | 131 passed |
| `tsc --noEmit` | clean |
| `check:design` (15 rules) | pass, no baseline raised |
| `check:claims` (30 phrases) | pass |
| `check:routes` | pass |
| CI on `595e25395` | `Monorepo CI/CD` success |
| Production `/api/version` | `595e25395`, `main`, `production`, `railway` |
| Production homepage | HTTP 200 |
| Reduced-motion CSS in bundle | present; `getAnimations().length === 0` at rest |
| Console / hydration errors in production | none |
| First Load JS | 102 kB, unchanged across all five waves |

**Two defects were found and fixed in this wave** rather than ticked: focus was
lost to `<body>` after reset, and the primary CTA was 40px against CD-15's 44px
floor. Both are detailed in the acceptance checklist's evidence section, and both
new guards were proven by reverting the fix and watching them go red.

**The focus fix collided with the phase contract, and CI caught it.** Returning
focus to the field makes `EvidenceInput` report `focused-empty`, which
`deriveHomePhase` maps to `active` — so `home-phase.spec.ts` failed asserting
`idle` after reset. The literal `idle` was only ever true *because* the focus
call was a no-op: that expectation had encoded the defect. The test's own
comment says what it means ("a hero still claiming `resolved` over an empty
field is the bug this catches"), and `active` satisfies it, so the assertion now
pins the intent — no post-submit phase survives a reset — rather than the
incidental value. Re-verified three times with `--retries=0`.

---

## 3. FAILED

**None outstanding.**

Eight e2e specs fail in a local worktree — `visual-density` (6) and
`page-artifacts` (2), all on `/trust` and `/status`. Those routes return 500
locally because the worktree has no backend, and 200 in production. None of the
eight was touched by this program, and CI is green on the same commit. Recorded
as environmental, proven by comparing local and production response codes rather
than by assertion.

---

## 4. SKIPPED — and why

| Not done | Why | Consequence if wrong |
| --- | --- | --- |
| **Cross-browser** | The suite runs chromium only. Firefox and WebKit are unexercised, and `:has()` with a sibling combinator — which the phase recession depends on — is the newest CSS feature the homepage now relies on. | The atmosphere would stop receding on an untested engine. Nothing breaks and no meaning is lost: the page is fully legible and operable with the multiplier stuck at 1. |
| **Real screen-reader pass** | axe is static analysis plus rendered-DOM rules. Nobody drove the page with VoiceOver or NVDA. | An announcement could be technically correct and still read badly. |
| **Real device testing** | Viewport emulation only; no physical phone. | Touch target and iOS zoom findings rest on computed CSS, not a thumb. |
| **Visual regression** | No screenshot baseline exists for the homepage. Layout was measured numerically instead (clipping, gap, overflow, contrast). | A purely aesthetic regression that breaks no measurement would ship unnoticed — the failure mode already recorded for paint order. |
| **Load / performance beyond bundle size** | First Load JS is tracked; no Lighthouse or field data. | Bundle size is not latency. |

---

## 5. PENDING — carried out of the program

| Item | State |
| --- | --- |
| **E0 `/api/system/source-runtime` returns 401** | The route is merged and mounted (`systemHealth.ts` → `app.ts:3713`) but `middleware/tenantGuard.ts:224` gates a route whose own header calls it a *public* transparency endpoint. The homepage cannot consume E0 today. Outside this program's scope firewall; needs its own item. |
| **Homepage lane availability still reads the static registry** | `SOURCE_LANE_OPS` lifecycle, not E0 runtime truth. Correct today — E0 describes *per-source platform liveness*, the capsule needs *per-NPI results* — but the two should be reconciled once E0 is publicly readable. |
| **The decorative field is a founder decision** | `CinematicEvidenceField` draws four labeled source nodes converging on a record, with a gradient and a glow. It now recedes correctly and carries no live-result vocabulary, but the geometry sits against "do not visualize evidence as a node graph, constellation or network" and CD-13's retirement of gradients-as-surface and glow. Not this wave's call. |
| **Identity header repeats the NPI** | When the registry cannot resolve a name, the capsule header renders `NPI 1234567893` as the title and again on the line beneath. Cosmetic; reads like a bug. |

---

## 6. Rollback

Every wave was squash-merged, so any single one reverts with
`git revert -m 1 <merge-sha>`. The program is additive at the file level:
reverting A–D restores `page.tsx` to mounting `CinematicEvidenceField` +
`AskHome` unchanged. **No database migration, no public API change, and no auth
boundary change is in scope**, so rollback is code-only and needs no data repair.

Rollback target: `8ea5e6c6f7422be5221ab7ab1ec2b4d52a3a0003`.

---

## 7. Two harness lessons worth keeping

Both cost real time in this wave and both produce *false* verdicts, which is
worse than a slow one.

1. **`next start` pins the build it booted with.** Rebuilding does not reload it.
   This made a correct guard look blind: after injecting a bug, all cases still
   passed, and only a server restart showed the expected three failures.
2. **Playwright's `webServer` block is load-bearing.** Pointing
   `PLAYWRIGHT_BASE_URL` at your own server bypasses the env it sets, and the
   dev-route harnesses 404 — 31 of an initial 42 failures were exactly this. The
   flags must be on the server process.
