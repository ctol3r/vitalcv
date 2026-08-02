# Homepage recovery — current-state inventory

Program: docs/ops/HOMEPAGE_RECOVERY_2026-08-02.md · Issue #1060 · Governance PR #1061 (merged `9aade909f`).

This is the single R1 evidence document. It stays concise; screenshots live under
`artifacts/home-recovery/baseline/`.

## R0 — Production convergence (2026-08-02T23:43Z)

| Fact | Value |
| --- | --- |
| CURRENT ORIGIN/MAIN SHA | `9aade909f2fc287e94104c698c99b347f38bf6f6` |
| WEB PRODUCTION SHA | `f7e8002aee615579217435d6c5eb5e5d33353f2f` |
| API PRODUCTION SHA | `f7e8002aee615579217435d6c5eb5e5d33353f2f` |
| HOMEPAGE HTTP STATUS | 200 |
| WEB HEALTH | ok (`/api/health`: backend ok, clerk production mode, apiBase true) |
| API HEALTH | ok (`api.vitalcv.com/health`: status ok, 0 error requests) |
| AUTH HEALTH | Clerk enabled, production mode |
| DATABASE HEALTH | implied ok via backend health; not directly probed in R0 |
| CANONICAL DOMAIN | https://vitalcv.com (canonical metadata on `/`) |
| CACHE STATE | `revalidate = 300` on `/`; external caches bounded to 5 min |
| CONVERGED | **YES for visual-audit purposes** — the only delta between prod (`f7e8002`) and origin/main (`9aade909f`) is the #1061 squash merge, which touched `AGENTS.md`, `CLAUDE.md`, `docs/ops/FOUNDER_VISUAL_GATE.md`, `docs/ops/HOMEPAGE_RECOVERY_2026-08-02.md` only (394 insertions, 0 app code). Production's homepage is byte-identical in source to main's homepage. |

## R1.1 — Render ownership map

_Pending: filled by forensic pass._

## R1.2 — Stylesheet ownership map

_Pending: filled by forensic pass._

## R1.3 — Component-intent collisions

_Pending: filled by forensic pass._

## R1.4 — Homepage chronology

_Pending: filled by forensic pass._

## R1.5 — Open-PR triage

_Pending: filled by forensic pass._
