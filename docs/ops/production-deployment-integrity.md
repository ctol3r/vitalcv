# Production Deployment Integrity

Binding rules for what live deployment surfaces are allowed to
render. The wave audits live topology + runtime-state surfaces,
eliminates fake-activity indicators, and ships a verifier that
prevents regressions before PearX review.

Cut date: 2026-05-22.

## What was repaired

### Fake-activity indicator

**`apps/web/components/intelligence/LiveFeedRibbon.tsx`** —
previously rendered a ticking `00:NN` counter driven by a 1-second
`setInterval` tick that incremented even when no fetch happened.
This was startup theater: it gave the impression of live monitoring
when the actual feed poll runs at `FEED_POLL_INTERVAL_MS`.

**After**: cosmetic tick effect removed. The ribbon now renders
`Last fetched HH:MM:SS` (or `Awaiting first fetch`) sourced from
`lastFetchedAt`, which advances only when the poll actually returns.

### Real-time / continuous-monitoring marketing overclaims

**`apps/web/components/marketing/BentoGrid.tsx`** —
`Real-Time Monitoring` subtitle on the "Continuous Trust Daemon"
card replaced with `Per-request federal-source resolution`.
Description rewritten to name the per-request posture honestly:
"Federal-source lanes are re-resolved against the published
registries (NPPES, OIG/LEIE, PECOS) on the institution's own
freshness budget. No continuous monitoring is performed."

**`apps/web/components/marketing/HomeSections.tsx`** —
`See the product working in real time.` → `See the product resolve
federal-source lanes on request.`

## The three binding rules

### R1 · No fake-activity indicators

A surface that renders a ticking timer, an animated activity dot, a
"live" badge, or a refresh counter MUST be sourced from a real
operational event (a network request, a state transition, a server
push). Cosmetic ticks driven by a setInterval with no operational
hookup are forbidden.

### R2 · No fake production / deployment confidence

Visible surfaces MUST NOT claim:
- `Real-Time Monitoring` (as a positive product positioning)
- `Continuous monitoring` (already eliminated in Waves 34, 37)
- `99.9%` / `five-nines` / `fault-tolerant` (no SLO is being
  measured at this stage)
- `Production-grade` (as a positive positioning claim)
- `Always-on` (as a positive positioning claim)
- `Real-time synchronization` (the substrate resolves per request)

The `productionReady` field returned by `/api/runtime-health` is an
**internal** boolean that drives admin UI; the user-facing
`/account/recovery` page already renders it honestly as
`false (foundation only)`. The field is preserved.

### R3 · Degraded states must render visibly

Hydration-safe, interruption-safe rendering: if a runtime fetch
fails, the surface MUST render an explicit failure state with a
recovery action (Retry / Open status / Contact support), NOT
silently fall back to a stale snapshot without a banner.

The four degraded states from Wave 39 carry over:

- `access_required`
- `unavailable`
- `stale`
- `not_checked`

Plus two production-runtime states:

- `network_error` — a fetch threw an error; render with a Retry button
- `backend_unavailable` — server returned 5xx; render with explicit
  "Cached snapshot" banner naming the cached-at timestamp

Silent fallback (no banner, no retry) is forbidden.

## Hidden-route topology

Wave 32 (canonical product flow) established that only the five
canonical routes (`/` / `/get-ready` / `/passport` / `/review` /
`/status`) appear in the visible nav. The hidden routes are
documented in `docs/product/canonical-product-flow.md` (when
merged) and remain reachable by direct URL.

This wave does NOT modify nav exposure further; it confirms the
canonical list is intact via `verify-production-integrity`'s
`canonical-routes` sub-check.

## Production-integrity verifier

`scripts/verify-production-integrity.ts` checks:

1. The five canonical routes resolve to a `page.tsx` on disk
2. No `setInterval(.+ 1000)` cosmetic ticks in
   `apps/web/components/intelligence/LiveFeedRibbon.tsx`
3. No `Real-Time Monitoring` / `Real-time synchronization` /
   `99.9%` / `five-nines` / `fault-tolerant` / `Always-on` (as a
   positive standalone label) in `apps/web/{app,components}`
4. The doctrine doc exists

Three sub-modes:

- `enforce` (default) — exits non-zero on any FAIL
- `deployment-state` — canonical-routes + doctrine only
- `runtime-recovery` — degraded-state visibility check (NOTE-level
  scan of verification surfaces)

## Calmer production-state hierarchy (inline Claude Design)

Per the wave spec, the Claude Design tasks live INSIDE this wave —
no separate orchestration. The repairs above already implement:

- **Calmer production-state hierarchy** — fake ticking counter
  removed; `lastFetchedAt` is the one truthful indicator
- **Bounded degraded-state UI** — the existing `LiveFeedRibbon`
  delivery state (`live` / `cached` / `backend_unavailable`) is
  preserved; no new state was added
- **Restrained deployment-confidence semantics** — marketing
  surfaces normalized to per-request resolution language
- **Psychologically safe recovery patterns** — the ribbon now
  shows when it last fetched rather than implying continuous
  activity; if no fetch has happened, it says so explicitly
  (`Awaiting first fetch`) rather than rendering a misleading
  `00:00` ticker

## Surfaces deliberately NOT modified

| Surface | Reason |
|---|---|
| `/api/runtime-health` | API surface; `productionReady` field is internal |
| `apps/web/components/hero/LiveTrustConsole.tsx:338` | Already self-discloses: "Not a real-time OIG feed" |
| `apps/web/components/simulation/TrustEngineTerminal.tsx` | Comment-only mention; surface already discloses Nursys gating |
| `apps/web/components/trust/TrustContainerPanel.tsx` | Internal comment about always-on safe copy; no user-visible "always-on" claim |
| `apps/web/components/sandbox/ClinicianPassport.tsx:157` | Already normalized in Wave 34 to "Per-request resolution against primary-source registries" |
| `apps/web/app/pilot/page.tsx:50` | Already self-discloses: "PECOS public data reflects the public release, not the real-time enrollment portal" |
| `apps/web/components/intelligence/CopilotPanel.tsx` setInterval | Polls a real backend endpoint; not a cosmetic tick |
| Other `setInterval` polls under `components/substrate/*` | Each one polls a real endpoint at `pollIntervalMs` |
| Other `window.location.*` uses | Legitimate share / redirect / origin lookups; none misrepresent live state |
| `_archive/*` trees | Retired code |

## Governance

A new visible production surface MUST:

1. Avoid all banned phrases in R2
2. Never render an "activity" indicator that is not sourced from a
   real operational event
3. Render degraded states explicitly with a recovery action
4. Pass `pnpm verify:production-integrity` with zero FAILs

PRs that violate any of the four are rejected at Codex audit.
