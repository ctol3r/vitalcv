# SYSTEM_MAP.md — VitalCV System Architecture

_Last updated: 2026-08-04, verified against main @ `61b1608d4`. The
2026-03-12 revision mapped archived `/verifier/*` routes as live, `/p/:npi`
(now `/p/[slug]`), a dark-navy homepage, and "MATCHA mock data" — retired.
For the authoritative route inventory run
`node scripts/audit-active-routes.mjs --json` (152 pages on this branch)._

## Apps

`apps/web` (Next 15 App Router — primary) · `apps/api/backend` (Express +
Prisma) · `apps/marketing` (separate; do not pull web changes into it) ·
`apps/issuer-api` · `apps/verifier-api` · `apps/router` · `apps/admin-api` ·
`apps/mobile`.

## Key public surfaces (verified live)

| Surface | Route |
|---|---|
| Homepage (film + real NPI check) | `/` |
| Public opportunities board | `/explore` |
| Clinician profile (slug) | `/p/[slug]` |
| Onboarding / activation | `/onboarding` |
| Passport / readiness | `/passport`, `/verify/*` |
| Share bundle view (public, expiring) | `/apply/[bundleId]` |
| Snapshot view (as-issued, hash-pinned) | `/snapshot/[id]` |
| One-real-loop preview (gated, noindex) | `/design/reset` |

## Signed-in surfaces

Clinician: `/holder/*` (incl. `/holder/matcha*`, applications, garden).
Employer: `/employer/*` (review-queue, applications/[id], decision/[id],
worklist, post, profile). The entire `/verifier/*` tree is archived.

## The real product loop (Wave 1072 contract)

NPI → `checkNpi` → `/api/identity/bootstrap/[npi]` + `/api/trust-state/[npi]`
→ `ClinicianCareerProfile` → `GET /api/matcha/opportunities/[npi]` (anonymous,
deterministic explanations) → `ApplyWithVitalCV` → `POST /api/apply/share`
(backend Clerk boundary) → `/apply/[bundleId]` employer view → record kept.

## Load-bearing invariants

- Truth contract (CLAUDE.md): literal `decisionGrade: false` candidates, no
  banned strings, no fabricated source states.
- Route inventory pinned by `page-density-system.test.tsx`; route guards by
  `scripts/check-route-guards.ts`; design debt by ratcheted
  `check-design-lint.ts` baselines (never raise them).
- `/design/*` is layout-gated: 404 in canonical production, request-time
  evaluated (`force-dynamic`).
- Deploys: Railway. Web service builds `apps/web/Dockerfile`;
  `railway up` needs `.railwayignore` (gitignore anchor bug) and a web
  `railway.toml` (root one is backend-oriented).
