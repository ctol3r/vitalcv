# ROADMAP.md — VitalCV Strategic Sequence

_Last updated: 2026-08-04, verified against main @ `61b1608d4`. The 2026-03-12
revision described waves 237–239 as in progress, MATCHA as unconnected, a
"moneyball/antigravity" homepage, and Q2–Q4 2026 phases as future — all
retired. Wave history lives in git and closed PRs, not here._

## Current program

**Wave 1072 — one real loop** (`wave/1072-one-real-loop`, preview-only): the
approved `/design/reset` visual direction carrying the real product loop —
NPI → clinician profile → MATCHA opportunity → Apply with VitalCV → employer
packet → employer review begins → keep the record. Contract:
`docs/product/one-real-loop-contract.md`. Production promotion requires the
explicit gate in `docs/ops/FOUNDER_VISUAL_GATE.md` §0.

Adjacent standing programs (see docs/ and closed PRs for detail): homepage
recovery (the film on `/` is current production), national licensure coverage
(L0 landed; live routes gated on access diligence), platform-layer waves,
security hardening (ASVS scorecard).

## Verified-shipped foundations (evidence in code)

- MATCHA live matching over DB opportunities (`liveMatchaService`,
  `FEATURES.MATCHA_V2=true`, 27 mounted routes).
- Public opportunities board at `/explore` reading Postgres `Opportunity`.
- Apply share + revoke contracts (`/api/apply/share`, backend Clerk gate).
- Employer surfaces at `/employer/*`; `/verifier/*` archived.
- Real NPI stack on `/` (bootstrap + trust-state; no scores on public
  surfaces).

## Known open gaps (verified 2026-08-04)

- MATCHA's legacy in-memory `opportunityRegistry` still backs
  `GET/POST /api/matcha/opportunity(-ies)`, instant-offer, marketplace pool,
  and analytics — writes vanish on restart; only the `/:npi` live routes and
  `/explore` read Postgres.
- `liveMatchaService.ts` is `// @ts-nocheck` and news up its own
  PrismaClient.
- The bootstrap contract collapses NPPES no-result / outage / rate-limit
  into one `UNAVAILABLE` state.
- The apply-share path trusts a client-set `x-clerk-user-id` header, unlike
  the packet path's verified-JWT guard.
- Anonymous NPI-keyed match/readiness endpoints allow per-NPI enumeration.

Do not mark a gap fixed here without a merged PR to cite.
