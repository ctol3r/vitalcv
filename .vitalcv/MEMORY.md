# MEMORY.md — VitalCV Agent Working Memory

_Last updated: 2026-08-04, verified against main @ `61b1608d4`. The
2026-03-12 revision (dark-navy homepage doctrine, "MATCHA disconnected",
"verifier inbox seeded", YC-eve urgency, 67-model schema) is retired._

## Durable, code-verified facts

- Homepage `/` is `HorizontalCareerFilm` on light paper (`#F0EEE9`). The
  dark-navy `#080e1a` / antigravity system survives only in `_archive/` and
  `styles/antigravity.css`; it is not doctrine.
- MATCHA: mounted and public. `registerMatchaRoutes` in backend `app.ts`;
  `FEATURES.MATCHA_V2 = true` (PUBLIC). Live matches read Postgres; the old
  in-memory registry still backs a few list/write routes (gap).
- `/verifier/*` is archived. Employer work happens at `/employer/*`.
  There is no live `/verifier/inbox` — neither "seeded" nor "live" is a
  meaningful claim about it.
- Prisma schema: 161 models (2026-08-04 count). Backend: ~159 route files.
- Flags: ASK_VITALCV=false, REFERRALS_V2=false, INSTANT_OFFERS=false,
  MATCHA_V2=true.
- `react-force-graph-2d` is NOT installed — don't import it.
- Fonts are Geist/Fraunces via next/font/local; Google Sans Flex was never
  adopted.
- Public NPI surfaces show no readiness scores/percentages (e2e-pinned).

## Working rules

- Verify current-state claims against code before writing them anywhere.
- The production-promotion lock (`docs/ops/FOUNDER_VISUAL_GATE.md` §0)
  overrides every merge permission in this repo.
- Session-level memory lives in the Claude auto-memory directory, not here;
  this file is for repo-durable facts only.
