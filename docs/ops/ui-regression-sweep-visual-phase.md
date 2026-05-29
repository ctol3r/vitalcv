# UI Regression Sweep — Visual Phase

Post-merge UI regression sweep run after the Passport / Home / Auth / Status
visual-system waves.

## Run metadata

| Field | Value |
| --- | --- |
| Timestamp | 2026-05-28 21:56 PDT (America/Los_Angeles) |
| Base | `origin/main` |
| Main SHA | `e7b4e7e6caaa4e1a15b7164723b3e16531fcbe28` |
| HEAD commit | `feat(web): render status and attribution as receipt registers (#435)` |
| Worktree | `/tmp/vitalcv-ui-sweep` |
| Branch | `docs/ui-regression-sweep-visual-phase` |
| Mode | Docs/report only — no product code, backend, deploy, env/secrets touched |

## Results summary

| Gate | Result |
| --- | --- |
| `vitest run` (@vitalcv/web) | ✅ 1554 passed, 4 skipped, 0 failed (164 files) |
| `tsc --noEmit` (@vitalcv/web) | ✅ clean (exit 0) |
| `turbo build --filter @vitalcv/web` | ✅ 13/13 tasks successful (FULL TURBO cache) |
| `pnpm lint` | ✅ `@vitalcv/web`: No ESLint warnings or errors |
| Banned-copy scan | ✅ No genuine truth-contract violations in live routes |

## Tests — important note on ordering

A naive `vitest run` **before** the workspace dep is built reports **32 failed /
19 files** — every failure is the known `@vitalcv/trust-state` gotcha:

```
Error: Failed to resolve entry for package "@vitalcv/trust-state".
File: apps/web/lib/trust/employer-packet-contract.ts
```

This is **not a regression**. Per `CLAUDE.md`, `@vitalcv/trust-state` ships from
`dist/` and must be turbo-prebuilt before the web suite can resolve it. After
running `pnpm turbo run build --filter @vitalcv/web` (which prebuilds the
workspace dep's `dist/`), the full suite is green:

```
Test Files  163 passed | 1 skipped (164)
     Tests  1554 passed | 4 skipped (1558)
```

**Recommendation for CI / future sweeps:** always `turbo build --filter
@vitalcv/web` before `vitest run`, or the suite will false-fail on the
dist-resolution error. (Affected suites when unbuilt: `passport-proxy-routes`,
`review-page-contract`, and other suites importing `employer-packet-contract`.)

## Banned-copy scan

Command (mission-specified, broader than the truth-contract list):

```
rg -n "Checking in the background|Get verified|Verified|verified|cleared|approved|\
accepted everywhere|complete credentialing|instant credentialing|HIPAA compliant|\
SOC2 certified|NCQA certified|guaranteed" apps/web/app apps/web/components apps/web/__tests__
```

Raw hit count: **1085**. After triage, **zero genuine truth-contract violations
in live, routed copy.** Targeted scan of the actual truth-contract banned
phrases returned only the items below.

### Triaged findings

| Location | Match | Verdict |
| --- | --- | --- |
| `components/auth/AuthDisclosureCard.tsx:21` | `"No bare 'Verified', no 'Get verified'…"` | ✅ Safe — code comment documenting the rule |
| `components/passport/PassportTruthStateBanner.tsx:25-26` | `"no 'automatically verified'…"` | ✅ Safe — code comment documenting the rule |
| `app/trust/attribution/page.tsx:18` | `"complete credentialing"` (in comment) | ✅ Safe — code comment documenting the rule |
| `app/onboarding/page.tsx:105` | `"It does not complete credentialing."` | ✅ Safe — truthful **negation**; reinforces the truth contract; passes contract tests |
| `app/_archive/wave119/compare/.../page.tsx:20` | `"Instant credentialing verification…"` | ⚠️ Archived — `_archive` is a Next.js private (underscore-prefixed) folder and is **not routed**; not in live build. Cleanup-only. |

### Known-safe false positives

The bulk of the 1085 raw hits fall into categories that are expected and do not
violate the truth contract (all confirmed green by the contract vitest suite):

- **CSS-variable token names** — `--vt-state-verified` (`styles/themes/index.css`),
  `--trust-signal-verified` (`styles/tokens.css`), and their `var(--vt-state-verified)`
  consumers in `HomePageClient.tsx`. These are design-token identifiers, not copy.
- **Prop / variable / field names** — `lastVerifiedAt`, `identityVerified`,
  `isVerified`, `verifiedSources`, `hasOrcidVerified`, `status: 'verified'`
  (internal enum value, lowercase).
- **Compound user-facing labels** (allowed; the rule bans only the *bare* word
  "Verified" as a standalone status label) — `Verified name`, `Verified By`,
  `NPI Verified`, `Partially Verified`, `PSV Verified`, `PSV-Verified Credentials`,
  `Electronically Verified`, `Verified Identity`, `Verified credential bundle`.
- **Test split-join constants** — `__tests__/*` strings that assert banned copy
  is *absent*; these are allowed per `CLAUDE.md` ("except as test split-join
  constants"). ~724 of the lowercase `verified` hits are props/test/token noise.

## Remaining failing tests

None, given the correct build ordering. The only "failures" observable are the
32 dist-resolution false-fails that occur if `vitest run` is invoked before
`turbo build` — resolved by building the workspace dep first (see above).

## Recommended next fixes

1. **CI ordering guard (highest leverage):** ensure the web vitest job depends
   on `turbo build --filter @vitalcv/web` so the `@vitalcv/trust-state` dist
   exists before tests run. Prevents recurring false-red on `passport-proxy-routes`
   and `review-page-contract`.
2. **Archive cleanup (cosmetic, non-blocking):** the `_archive/wave119/compare/…`
   page carries an "Instant credentialing verification" string. It is not routed,
   but scrubbing or deleting the archived page removes it from future scans.
3. **No copy changes required** in live routes — the visual-phase merges
   (#435 status/attribution receipt registers, plus Home/Auth/Passport work)
   did not introduce truth-contract regressions.

## Verdict

✅ **CLEAN.** Post-visual-phase `main` (`e7b4e7e6`) builds, typechecks, lints, and
passes all 1554 web tests with zero truth-contract copy violations in live
routes. No product fix required.
