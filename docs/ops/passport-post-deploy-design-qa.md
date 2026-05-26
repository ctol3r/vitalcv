# Passport Post-Deploy Design QA — NPI 1699264564

**Date:** 2026-05-25
**Trigger:** PR #419 (`fix(passport)`) live on `vitalcv-web` Railway deploy `1d1b8175`; backend follow-up PR (this wave) in flight against `delightful-essence`.

## Base URL

`https://vitalcv-web-production.up.railway.app`

## Confirmed live observed states (snapshot updated 2026-05-26)

PR #419 web-side defensive mapping is **confirmed live** on `vitalcv-web` Railway deploy `1d1b8175`. The `delightful-essence` API service is **NOT** running the PR #420 backend patch — Claude Browser evidence (2026-05-26) shows it is still serving an old PR #359 build from ~2 weeks ago, and newer deploy attempts fail at `@vitalcv/api` build with module-resolution errors (`runtimeTrustCohesion`, `loadDotenv`, `tenantIsolation`, `replayCorruptionContainment`, `confidenceCalibration`). That is a separate deployment-gap repair tracked outside this PR.

### `/passport?npi=1699264564` — current live state (no-payload condition)

Because the API service is on stale code, the SSE stream does not currently return an intact NPPES identity payload for `1699264564`. The web-side defensive mapping handles this honestly: when no identity payload arrives, NPPES does not promote to source-confirmed, and the row renders with the truthful temporarily-unavailable state.

| Lane | Current live badge | Current live subtext | Doctrine compliance |
|---|---|---|---|
| NPPES | `Temporarily unavailable` (state: error) | `Source temporarily unavailable. Try this NPI again in a moment.` | ✅ honest no-payload state |
| OIG / LEIE | `Not connected` (state: error) | `Federal exclusion lane is not connected in this build. Do not treat this as an exclusion clearance.` | ✅ honest |
| CMS PECOS | `Not connected` (state: error) | `Medicare enrollment lane is not connected in this build. Institution review may require separate enrollment evidence.` | ✅ honest |
| Configured state board lane | `Access required` (state: done by placeholder) | (no subtext) | ✅ honest |
| Readiness card | omits the "identity source returned" contextual note (gated on `sources.nppes === 'done'`) | — | ✅ context note correctly hidden when identity not present |
| Source operational state panel (`LaneHealthMount`) | All lanes show `Unknown / no successful read` + `Retry suggested in ~30s` (placeholder static probe seed) | (unchanged) | ⚠️ doctrine-aligned but contextually confusing — flagged P2, not addressed here |
| Misleading copy: `Checking in the background — we'll update when it arrives.` on terminal error states | Removed entirely (PR #419) | — | ✅ |
| Banned phrases on `/` (homepage) | 0 hits across all 11 phrases in CLAUDE.md banned list | — | ✅ |

### `/passport?npi=1699264564` — post-PR #420 + API redeploy expectation

Once PR #420 (this PR) is merged AND the `delightful-essence` API deployment gap is repaired AND the API service redeploys, the SSE stream for NPI 1699264564 will return the intact NPPES identity payload (displayName `VICTORIA ELIZABETH FISCHER, MD`, identityStatus `ACTIVE`, entityId, taxonomies) again. At that point the same `/passport?npi=1699264564` page is expected to render:

| Lane | Expected post-deploy badge | Expected post-deploy subtext |
|---|---|---|
| NPPES | `Source-backed` (state: done) — Identity-confirmed card renders with name + specialty + NPI | (no subtext on done state) |
| OIG / LEIE | `Not connected` (unchanged — no live OIG adapter in this build) | (unchanged) |
| CMS PECOS | `Not connected` (unchanged — no live PECOS adapter in this build) | (unchanged) |
| Configured state board lane | `Access required` (unchanged) | (no subtext) |
| Readiness card | `PARTIAL` badge + score (20/100, L1) + contextual paragraph | `Identity source returned. Additional credential lanes require source access or are not connected in this build. Institution review is still required for any final decision.` |

### Other routes (current live, 8/8 → 200)

| Route | Expected | Observed |
|---|---|---|
| `/` | 200 HTML, no banned strings, safe equivalents present | 200, clean |
| `/api/health` | 200 JSON `service: "web"` | 200, ok (note: `backend.status: "degraded"` field reflects the separate API deployment gap) |
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

### `/passport?npi=1699264564` — current live test (pre-API-redeploy)

Verify the no-payload truth-state renders honestly while the API service is on stale code:

- [ ] NPPES lane shows `Temporarily unavailable` (NOT `Unavailable`, NOT `Unknown`)
- [ ] NPPES subtext: `Source temporarily unavailable. Try this NPI again in a moment.`
- [ ] NPPES does NOT show `Source-backed` (correct — no identity payload arrived from API)
- [ ] OIG / LEIE row shows `Not connected` with `Federal exclusion lane is not connected in this build…` subtext
- [ ] CMS PECOS row shows `Not connected` with `Medicare enrollment lane is not connected in this build…` subtext
- [ ] State board lane shows `Access required`
- [ ] No "Checking in the background" copy anywhere
- [ ] Readiness card omits the "Identity source returned" contextual note (correct — gated on `sources.nppes === 'done'`)
- [ ] No bare "Verified" / "Cleared" / "Approved" badges anywhere

### `/passport?npi=1699264564` — post-PR #420 merge + delightful-essence redeploy

Re-run only after PR #420 is merged AND the API service deployment gap (separate wave) is repaired AND `delightful-essence` redeploys a build that includes commit `09e561de` or its descendant:

- [ ] NPPES lane shows `Source-backed` (or equivalent source-confirmed badge)
- [ ] NPPES lane does NOT show `Unavailable`
- [ ] NPPES lane does NOT show `Unknown / no successful read`
- [ ] Identity-confirmed card renders with `VICTORIA ELIZABETH FISCHER, MD`
- [ ] Specialty `Neurological Surgery` visible
- [ ] OIG / LEIE row shows `Not connected` (unchanged)
- [ ] CMS PECOS row shows `Not connected` (unchanged)
- [ ] State board lane shows `Access required` (unchanged)
- [ ] No "Checking in the background" copy anywhere
- [ ] Readiness card contextual note present when NPPES done + OIG/PECOS error
- [ ] "View full passport" button is enabled and reachable (anchor entity id is set)
- [ ] "Re-check sources" button works (re-runs ingest)

### Raw SSE smoke (post-API-redeploy)

Capture the `source_complete` event for NPPES and confirm both fields agree:

```bash
BASE=https://vitalcv-web-production.up.railway.app
RUNID=$(curl -fsS -X POST -m 20 "$BASE/api/ingest/1699264564" | python3 -c 'import sys,json;print(json.load(sys.stdin)["runId"])')
curl -sSN -m 8 -H 'Accept: text/event-stream' "$BASE/api/ingest/stream/$RUNID" \
  | python3 -c '
import sys,json
for line in sys.stdin:
    line = line.strip()
    if not line.startswith("data: "): continue
    try: evt = json.loads(line[6:])
    except: continue
    if evt.get("type") == "source_complete" and evt.get("sourceId") == "nppes":
        p = evt["payload"]
        print("status:", p.get("status"), "resultStatus:", p.get("resultStatus"))
        break
'
```

- [ ] Expected output: `status: SUCCESS resultStatus: SUCCESS` (both fields agree — Codex's PR #420 requirement)
- [ ] Pre-PR #420 / pre-redeploy output: `status: FAILED resultStatus: FAILED` (still acceptable — true upstream outage)
- [ ] Forbidden output: `status: SUCCESS resultStatus: FAILED` (this is exactly what PR #420 prevents)

### `/passport?npi=<other valid NPI returning identity but zero claims>`
- [ ] After PR #420 + API redeploy: source-confirmed behavior matches 1699264564 (any provider whose NPPES record is intact but downstream claim derivation produces zero records)

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
