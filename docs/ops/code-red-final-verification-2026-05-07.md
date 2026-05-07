# Code Red — Final Verification Snapshot · 2026-05-07

This document captures the end-of-Code-Red state of `origin/main` after the
27-PR push that ran 2026-05-05 → 2026-05-07. It is meant to be readable cold,
without context from the conversation that produced it.

## Outcome

The Code Red plan has reached structural close. **All six missing design
surfaces** from the Claude Design zip have foundations on `origin/main`. The
buyer funnel is closed end-to-end. The issuer/PSV truth contract is intact.
Production deploys at `vitalcv.com` are returning 200 across all hero routes.

## What landed (27 PRs total)

### Wave A — Merge burndown (11 PRs, 2026-05-05)

| PR | Effect |
|---|---|
| #221 | TRUST-PERSIST-1 Prisma scaffold (IssuerRequest + ReceiptCandidate with truth-contract CHECK constraints) |
| #226 | Strict response-header baseline (CSP/HSTS/X-Content-Type-Options/Referrer-Policy/Permissions-Policy) |
| #227 | OWASP ASVS L1 scorecard published |
| #228 | Typed env contract with build-time validation |
| #229 | Foundation a11y baseline assertions |
| #232 | axe-core WCAG 2.2 AA gate on hero routes |
| #234 | CORS allowlist + API key foundation |
| #235 | Constraint tamper detection (SQLSTATE 23514) + cross-tenant reuse helpers |
| #242 | DPA template + cookie policy pages with footer wiring |
| #252 | Post-deploy source-health probe (workflow + script + test) |
| #253 | Worklist DB-backed reads (canonical-type alignment, prisma generate wiring) |

### #254 — Wave A board delta

### Wave B Phase 2-3c — Persistence cutover (4 PRs, 2026-05-06)

| PR | Effect |
|---|---|
| #255 | Feature-flagged ReceiptCandidate writer (`ISSUER_PERSISTENCE_ENABLED`) |
| #256 | Wire writer into `/issuer/review/[requestId]` (Phase 3a) |
| #257 | Wire writer into `/issuer/policy-review/[requestId]` (Phase 3b) |
| #258 | Wire writer into `/issuer/psv-receipt/[requestId]` (Phase 3c) |

### Wave H — GTM funnel (4 PRs, 2026-05-06)

| PR | Effect |
|---|---|
| #259 | Pilot intake form on `/contact` + `POST /api/pilot-intake` + Slack hand-off |
| #260 | Three persona landing pages (`/for/cvo`, `/for/payer`, `/for/staffing-exchange`) + form preselect |
| #261 | Public source-health panel on `/status` (NPPES/OIG/PECOS/state-board snapshot store) |
| #262 | Pricing-page CTAs routing to `/contact?persona=...` + Cal.com booking embed |

### Waves D/E/F — Design surfaces (6 PRs, 2026-05-06 → 2026-05-07)

| PR | Surface | Route |
|---|---|---|
| #263 | File | `/file/[fileId]` |
| #265 | ROI | `/roi` |
| #268 | Inbox | `/inbox` |
| #270 | Activation | `/activation/[caseId]` |
| #271 | Autopilot | `/autopilot` |
| #273 | Dossier | `/dossier/[receiptId]` |

### #274 — Waves B/D/E/F/H board delta

## Verification artifacts (run 2026-05-07)

### Vitest full suite

```
pnpm turbo run build --filter @vitalcv/web   # required: prebuilds workspace deps
pnpm --filter @vitalcv/web exec vitest run

Test Files: 155 passed | 1 skipped (156)
Tests:    1458 passed | 4 skipped (1462)
Duration: 5.00s
```

> Note: a fresh worktree must run `pnpm turbo run build --filter @vitalcv/web`
> first per CLAUDE.md, otherwise 27 tests fail because `@vitalcv/trust-state`
> hasn't built its `dist/`. After the prebuild, every test passes.

### Banned-strings sweep

The 11 canonical CLAUDE.md banned phrases were scanned across
`apps/web/{app,lib,components}` excluding `__tests__`. Four phrases produced
hits, all of them legitimate:

| Phrase | Hit count | Why it's fine |
|---|---:|---|
| `automatically verified` | 1 | A JSDoc comment in `apps/web/lib/roi/roiData.ts` listing what is *not* used |
| `complete credentialing` | 4 | Three are anti-overclaim copy ("does NOT complete credentialing"); one is the CI gate's regex pattern |
| `legally accepted` | 1 | The CI gate's regex pattern in `apps/web/lib/trust/trust-container-view.ts` |
| `risk transferred` | 1 | The CI gate's regex pattern in the same file |
| (other 7 phrases) | 0 | — |

**No actual overclaim copy exists in any user-facing string literal.** The
banned-strings CI gate (`apps/web/lib/trust/trust-container-view.ts`) is the
single place these phrases appear as live runtime values, and it appears
specifically to block them.

The bare `Verified` status label was also swept; zero `>Verified<` or
`>VERIFIED<` tags exist in the rendered HTML of any of the six new design
surfaces.

### Production smoke (vitalcv.com, 2026-05-07)

| Route | HTTP | Bytes | Latency |
|---|---:|---:|---:|
| `/` | 200 | 79,378 | 883ms |
| `/file/demo-001` | 200 | 77,011 | 793ms |
| `/roi` | 200 | 103,270 | 660ms |
| `/inbox` | 200 | 111,071 | 595ms |
| `/activation/demo-001` | 200 | 117,519 | 516ms |
| `/autopilot` | 200 | 123,458 | 540ms |
| `/dossier/r-002` | 200 | 120,293 | 497ms |
| `/contact` | 200 | 54,666 | 536ms |
| `/pricing` | 200 | 71,725 | 468ms |
| `/status` | 200 | 69,846 | 508ms |
| `/for/cvo` | 200 | 64,162 | 510ms |
| `/for/payer` | 200 | 64,154 | 336ms |
| `/for/staffing-exchange` | 200 | 64,353 | 478ms |

All 13 hero routes return HTTP 200. Six of them (`/file`, `/roi`, `/inbox`,
`/activation`, `/autopilot`, `/dossier`) did not exist on `origin/main` two
days ago.

## Truth-contract enforcement summary

Two standing rename patterns were enforced across the 14 wave-B/H/design PRs
to comply with CLAUDE.md without weakening the truth contract:

1. **Bare `Verified` / `VERIFIED` status labels are banned.** Each design
   surface that imported a "verified" provenance from the design source
   renamed it to `source_confirmed` with label `Source-confirmed` (Inbox,
   Dossier) or `Granted` / `Enrolled` / `Live` / `Aligned` depending on the
   semantics (Activation, ROI, Autopilot status surface). Tests on each
   surface assert `>Verified<` and `>VERIFIED<` are absent in rendered HTML.

2. **Specific upstream vendor names are not asserted as integrated.** The
   design source uses concrete vendor names (NPPES, OIG/LEIE, SAM.gov,
   NPDB, AAMC, NCCPA, CA DCA, DEA, CAQH, IRS, IMLC, Aetna, UnitedHealthcare,
   Anthem, Kaiser, Cigna, Cedar Health) to make examples concrete, but
   none of those are integrated in the live codebase today. Each surface
   replaces them with vendor-neutral controls ("home-state professional
   licensing board", "federal controlled-substance authority", "issuing
   board", "Commercial Carrier 1..5", etc.). Tests assert vendor-name
   absence with word-boundary regex to avoid false positives.

The issuer/PSV truth-contract literals — `ReceiptCandidate.decisionGrade ===
false` and `proofTier === 'receipt_candidate'` — are preserved verbatim
across all 27 merges. No file under `apps/web/lib/issuer-verification/` was
modified by any of the 6 design-surface PRs.

## Test coverage (added during Code Red)

| Wave | New cases |
|---:|---:|
| Wave A burndown | (varies per PR) |
| Wave B Phase 2-3c | 25 |
| Wave H GTM | 72 |
| Wave D File | 17 |
| Wave E ROI | 27 |
| Wave D Inbox | 23 |
| Wave F Activation | 27 |
| Wave F Autopilot | 26 |
| Wave E Dossier | 28 |
| **Total new (waves B/D/E/F/H)** | **245** |

Full suite: 1458 passing tests across 155 files.

## What is intentionally NOT done (still queued)

* **Wave B Phase 3d** — `PolicyReviewDecision` schema + writer + POST handler.
  The Prisma model from deferred PR #247 needs its own follow-up.
* **Wave B Phase 3e** — Wire writer into `/issuer/psv-reuse/[receiptId]`
  (operates on PSVReceipt + PSVReceiptReuseDecision; needs different writers).
* **Wave A leftovers** — #237 (DB migrate baseline), #240 (cross-tenant reuse
  block), #243 (verifier RBAC), #247 (policy decision persistence) all still
  open from the original burndown.
* **Phase 2 work per design surface** — interactive upload (Inbox), real DB
  reads keyed by route param (Activation, Autopilot), real EdDSA signing +
  RFC3161 timestamp anchoring + signed-PDF export (Dossier), SVG sparkline
  charts (ROI, Activation, Autopilot), accept-into-profile flow (Inbox
  suggestions), real action endpoints (Autopilot NBA buttons).
* **Wave G** — enterprise architecture hardening (HIPAA architecture
  evidence, SOC2 readiness map, full PWA pass, banned-strings + truth-
  contract CI gates).

## Operating-stack notes

The Code Red push relied on a tightened operating model:

* **Builder** = Claude Code Terminal, executing edits + commits + pushes
  via Bash from worktrees in `/tmp/vitalcv-*`.
* **Verifier** = `codex exec` invoked via Bash, three-pass audit
  (implementation / diff safety / banned strings) producing the literal
  `Codex verdict: SAFE` line in the same transcript.
* **Merge** = `gh pr merge --squash --delete-branch` run from the user's
  terminal after the SAFE verdict appears. The user retained merge
  authority throughout; every merge is in their shell history.

26 of the 27 PRs cleared Codex on first or second attempt; fix-forwards
addressed (a) vendor-name leakage in copy and (b) two cases of dynamic-
import / module-load throw paths that needed try/catch wrapping. No PR
weakened the truth contract; no PR shipped overclaim copy.

## How to reproduce this snapshot

```bash
# 1. Pull current main
git fetch origin main
git worktree add -b verify/snap origin/main /tmp/vitalcv-snap
cd /tmp/vitalcv-snap

# 2. Install + prebuild workspace deps (REQUIRED — see CLAUDE.md)
pnpm install --frozen-lockfile
pnpm turbo run build --filter @vitalcv/web

# 3. Run full vitest suite
pnpm --filter @vitalcv/web exec vitest run
# expected: 1458 passed | 4 skipped

# 4. Banned-strings sweep
for phrase in "automatically verified" "guaranteed verification" \
              "complete credentialing" "instant credentialing" \
              "legally accepted" "risk transferred" \
              "final verification without review" \
              "source confirmed before response" \
              "certified compliant" "HIPAA compliant" "SOC2 certified"; do
  count=$(grep -rln "$phrase" apps/web/app apps/web/lib apps/web/components \
          2>/dev/null | grep -v __tests__ | wc -l | tr -d ' ')
  echo "$phrase → $count files"
done
# expected: only the 4 legitimate hits documented above

# 5. Production smoke
for path in / /file/demo-001 /roi /inbox /activation/demo-001 \
            /autopilot /dossier/r-002 /contact /pricing /status \
            /for/cvo /for/payer /for/staffing-exchange; do
  curl -s -o /dev/null -w "%{http_code} $path\n" "https://vitalcv.com$path"
done
# expected: 13 × 200
```
