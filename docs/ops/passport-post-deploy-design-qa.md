# Passport Post-Deploy Design QA — NPI 1699264564

**Date:** 2026-05-25
**Trigger:** PR #419 (`fix(passport)`) live on `vitalcv-web` Railway deploy `1d1b8175`; backend follow-up PR (this wave) in flight against `delightful-essence`.

## Base URL

`https://vitalcv-web-production.up.railway.app`

## Confirmed live observed states (web-side, PR #419 deployed)

### `/passport?npi=1699264564`

| Lane | Badge | Subtext | Doctrine compliance |
|---|---|---|---|
| NPPES | `Source-backed` (state: done) | Identity-confirmed card renders with `VICTORIA ELIZABETH FISCHER, MD` / `Neurological Surgery` / `NPI 1699264564` | ✅ source-confirmed identity, no `Verified` bare word |
| OIG / LEIE | `Not connected` (state: error) | `Federal exclusion lane is not connected in this build. Do not treat this as an exclusion clearance.` | ✅ honest |
| CMS PECOS | `Not connected` (state: error) | `Medicare enrollment lane is not connected in this build. Institution review may require separate enrollment evidence.` | ✅ honest |
| Configured state board lane | `Access required` (state: done by placeholder) | (no subtext) | ✅ honest |
| Readiness card | `PARTIAL` badge + score (20/100, L1) + contextual paragraph | `Identity source returned. Additional credential lanes require source access or are not connected in this build. Institution review is still required for any final decision.` | ✅ truthful framing |
| Source operational state panel (`LaneHealthMount`) | All lanes show `Unknown / no successful read` + `Retry suggested in ~30s` (placeholder static probe seed) | (unchanged) | ⚠️ doctrine-aligned but contextually confusing alongside live NPPES success — flagged as P2, not addressed here |
| Misleading copy: `Checking in the background — we'll update when it arrives.` on terminal error states | Removed entirely | — | ✅ |
| Banned phrases on `/` (homepage) | 0 hits across all 11 phrases in CLAUDE.md banned list | — | ✅ |

### Other routes

| Route | Expected | Observed |
|---|---|---|
| `/` | 200 HTML, no banned strings, safe equivalents present | 200, clean |
| `/api/health` | 200 JSON `service: "web"` | 200, ok |
| `/trust` | 200 HTML | 200 |
| `/trust/attribution` | 200 HTML | 200 |
| `/.well-known/jwks.json` | 200 JSON `kid: vcv-es256-prod-1, alg: ES256, crv: P-256` | 200, matches |
| `/status` | 200 | 200 |
| `/contact` | 200 | 200 |
| `/sign-in` | 200 or safe Clerk auth response | 200 |

## QA checklist for Claude Design

Please re-test the following on `https://vitalcv-web-production.up.railway.app` after this wave's backend patch lands and `delightful-essence` redeploys:

### `/` (homepage)
- [ ] Hero "What happens after" strip reads `Identity confirmed against NPPES | Sanctions checked via OIG | Readiness status generated` (no `score`, no `verified`)
- [ ] No bare "Verified" badge or button
- [ ] No "Verify a Provider" CTA
- [ ] Footer contains `Trust`, `Attribution`, `Status`
- [ ] Navbar contains `Check Clinician Readiness`, `Trust`
- [ ] No "Verify once. Trust everywhere." / "Get Verified" / "already verified" / "instant credentialing" / "guaranteed verification" copy anywhere

### `/passport?npi=1699264564`
- [ ] NPPES lane shows `Source-backed` (or equivalent source-confirmed badge)
- [ ] NPPES lane does NOT show `Unavailable`
- [ ] NPPES lane does NOT show `Unknown / no successful read`
- [ ] Identity-confirmed card renders with `VICTORIA ELIZABETH FISCHER, MD`
- [ ] Specialty `Neurological Surgery` visible
- [ ] OIG / LEIE row shows `Not connected` (not `Unavailable`)
- [ ] OIG / LEIE subtext starts with `Federal exclusion lane is not connected in this build…`
- [ ] CMS PECOS row shows `Not connected`
- [ ] CMS PECOS subtext starts with `Medicare enrollment lane is not connected in this build…`
- [ ] State board lane shows `Access required`
- [ ] No "Checking in the background" copy anywhere
- [ ] Readiness card contextual note present when NPPES done + OIG/PECOS error
- [ ] "View full passport" button is enabled and reachable (anchor entity id is set)
- [ ] "Re-check sources" button works (re-runs ingest)

### `/passport?npi=<other valid NPI returning identity but zero claims>`
- [ ] Same source-confirmed behavior as 1699264564 (any provider whose NPPES record is intact but downstream claim derivation produces zero records)

### `/passport?npi=<invalid or unassigned NPI>`
- [ ] NPPES lane shows `Temporarily unavailable` OR "No profile yet" terminal card
- [ ] Subtext: `Source temporarily unavailable. Try this NPI again in a moment.` (NOT `Checking in the background`)

### Out-of-scope for this QA (separately tracked)

- `LaneHealthMount` panel ("Source operational state") still shows all lanes as `Unknown / no successful read` because the placeholder probe seed has no live probe wired. This is doctrine-aligned (HONEST default) but contextually confusing alongside the live NPPES success above it. Flagged P2 for a follow-up wave that either wires a live NPPES probe or differentiates the placeholder framing (e.g., "no probe configured in this build" instead of "no successful read").
- OIG / LEIE and CMS PECOS adapters are not wired to live data sources in this build. Doctrine-aligned and explicitly disclaimed in copy. Out of scope until those adapters land.
- Auth/CORS guard on `/api/ingest/*` — preflighted browser requests get 403 `x-cors-blocked:1`. Doesn't affect homepage / SSR routes. File separately if Design needs to test ingest from a browser-origin tool.

## Pass criteria

DESIGN PASS or DESIGN PASS WITH WARNINGS (no P0) → operator may proceed with apex/www DNS cutover.
DESIGN BLOCKED → file as P0 here; Claude Code will patch minimal surface only.
