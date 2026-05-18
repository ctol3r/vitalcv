# Pilot funnel merge board

Single page tracking the PRs and hosting state that gate VitalCV's
public pilot funnel. Updated only on merged evidence; in-flight PRs
are listed but do not move the completion percentages.

Last updated: 2026-05-17.

## Hosting status

| Surface | Provider | State | Notes |
|---------|----------|-------|-------|
| `https://vitalcv.com` | Vercel | **down — HTTP 402 `DEPLOYMENT_DISABLED`** | abandoned as a dependency; do not pay |
| Vercel project (`vitalcv`, `vcv-web`) | Vercel | hold | do not delete until ≥30 days post-cutover |
| Founder live-demo URL | Cloudflare Tunnel (`trycloudflare.com`) | **immediate demo path** | runbook: [cloudflare-tunnel-founder-demo-runbook.md](./cloudflare-tunnel-founder-demo-runbook.md) |
| Permanent web hosting | Cloudflare Pages / Workers | **production replacement candidate** | plan: [cloudflare-production-cutover-plan.md](./cloudflare-production-cutover-plan.md) |
| vitalcv.com DNS | unchanged at registrar | hold | cutover only behind explicit founder approval |
| Database | local / dev only | unchanged | out of scope for this exit wave |

See [vercel-exit-emergency-plan.md](./vercel-exit-emergency-plan.md)
for the umbrella plan.

## Open PRs in the pilot funnel

| # | Title | Branch | State | Blocks pilot? |
|---|-------|--------|-------|---------------|
| 369 | feat(leads): persist pilot and walkthrough requests from launch demo | feat/lead-capture-wire | open, UNSTABLE | yes — `/launch` and `/demo/employer` need lead capture |
| 370 | ci(copy): block banned truth-contract phrases in public surfaces | ci/banned-strings-guard | open, UNSTABLE | no (CI gate; merges independently) |
| 371 | feat(review): show audit event id after employer acceptance | feat/employer-accept-audit-event-visibility | open, UNSTABLE | yes — buyer wants to see the audit proof line |
| 372 | feat(ops): add source-health remediation hints for gated and degraded lanes | feat/source-health-remediation-hints | open, UNSTABLE | indirectly — ops-panel honesty supports the pilot |
| 373 | fix(profile): make clinician profile preview state explicit | fix/clinician-profile-honest-state | open, UNSTABLE | yes — public route currently misleading |
| 374 | docs(demo): add founder smoke checklist for pilot walkthrough | docs/founder-demo-smoke-checklist | open, UNSTABLE | no (docs only) |
| 375 | fix(wallet-sdk): restore interoperability export for monorepo build | fix/wallet-sdk-interoperability-export | open, UNSTABLE | **unblocker** — Web Quality CI failure across the entire open fleet |

All seven PRs show `UNSTABLE` for the same reasons: (a) the
wallet-sdk DTS failure that PR #375 fixes, and (b) Vercel
deployment checks failing because the Vercel account is disabled.
Vercel check failures are no longer load-bearing — see the exit
plan. Once #375 merges, the Web Quality lane should go green on
the remaining six PRs.

## Recommended merge order (operator decision)

1. **#375** — unblocks Web Quality across the fleet.
2. **#370** — banned-strings gate becomes enforceable on every
   subsequent PR.
3. **#371** — audit-entry UI line lights up the buyer's "where's
   my proof?" moment.
4. **#369** — `/api/leads` persists pilot inquiries from the
   public demo route.
5. **#373** — `/clinician/profile` stops implying it's editable.
6. **#372** — source-health panel ships with honest copy and
   operator-action hints; CI tests already cover the contract.
7. **#374** — founder-demo smoke checklist becomes runnable
   end-to-end once the prerequisite PRs above land.

Numbers here are merge order, not completion order — the PRs are
independent and can land in any sequence as long as the merge gate
is satisfied per PR.

## Pilot-funnel completion board

These percentages move only on merged evidence per the canonical
completion-board schema. In-flight PRs are tracked separately
above.

| Area | Current % | After this wave merges % | Detail / next action |
|------|-----------|--------------------------|----------------------|
| Public reachability (vitalcv.com) | 0% | 0% until Track B cutover | Vercel disabled; tunnel is for live demos only, not vitalcv.com |
| Founder live-demo URL (tunnel) | 0% | 100% once `cloudflared` installed and the runbook is followed | runbook + script shipped this wave |
| Production replacement plan | 0% | 50% once #375 merges and Cloudflare account exists | plan shipped this wave; first `*.pages.dev` build is the next gate |
| Banned-strings CI gate | 0% | 100% once #370 merges | gate scans default scope + PR diffs |
| Source-backed readiness preview (`/launch`) | 60% | 60% (depends on demo-spine PRs separate from this wave) | does not regress with the exit |
| Lead capture (`/api/leads`) | 0% | 90% once #369 merges | last 10% is wiring into `/launch` once the demo spine lands |
| Audit-entry visibility | 0% | 100% once #371 merges | UI line + proxy contract shipped |
| Clinician profile honesty | 0% | 100% once #373 merges | input chrome removed; preview banner present |
| Source-health remediation hints | 0% | 100% once #372 merges | 55/55 vitest passing |
| Founder smoke checklist | 0% | 100% once #374 merges | 15-step doc + non-mutating smoke script |

## Status emoji (derived from %)

| Range | Emoji |
|-------|-------|
| 0% | ⛔ blocker |
| 1–49% | 🟥 critical |
| 50–74% | 🟧 partial |
| 75–94% | 🟨 near complete |
| 95–100% | 🟩 done |

Apply to the percentages above only on merge — never independently
of the percentage.
