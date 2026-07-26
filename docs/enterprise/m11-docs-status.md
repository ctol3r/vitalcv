# M11 — Documentation, Enablement & Sales Collateral — Status

**Date:** 2026-07-06

## Shipped this wave

- **M11-2 Security whitepaper (buyer-facing)** — `docs/enterprise/security-whitepaper.md`.
  Every claim backed by an in-repo artifact; discloses the ASVS gap register rather
  than hiding it; states honesty commitments + honest compliance roadmap.

## Already present on main

- **M11-1 API reference** — OpenAPI is generated and served at `/openapi.json`
  and `/api-docs` (`app.ts`); `apps/README_OPENAPI.md` exists. GA polish = a
  published docs site + drift-check.

## Follow-up

- **M11-3 Enterprise onboarding guide** — org setup, SSO config, team roles,
  pilot→prod checklist (draftable).
- **M11-4 Internal ops handbook** — consolidate runbooks (DR from M5, incident,
  deploy/rollback, source-outage).
- **M11-5 Refresh MASTER_PROMPT/CLAUDE.md** — intentionally NOT rewritten this wave
  (doctrine files); the current-state deltas are captured in `CURRENT_STATE_2026-07.md`
  and the per-wave status docs. A doctrine refresh should be a deliberate, reviewed edit.

## Assessment

The one buyer-blocking doc — a security whitepaper that's accurate and not
over-claimed — is shipped. Onboarding/ops handbooks are draftable follow-ups;
the OpenAPI reference already exists.
