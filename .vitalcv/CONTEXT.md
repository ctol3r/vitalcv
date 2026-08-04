# VitalCV — Context

_Last updated: 2026-08-04, verified against main @ `61b1608d4`. The previous
revision (2026-03-12) carried speed guarantees, blockchain-anchor claims, YC
deadlines, and an OpenClaw maintainer note; all retired below. Do not restore
retired claims without code-backed evidence._

## What VitalCV is

The Provider Career Evidence Network. A clinician builds a **clinician
profile** from their NPI, keeps it as a reusable **career record**, discovers
opportunities through **MATCHA**, applies with **Apply with VitalCV** (a
consented, selective share), and gives the employer an **evidence packet** —
an **employer head start** on the information they need. Intended outcome:
**start sooner**. Continuity promise: **keep your record**.

This vocabulary is canonical for acquisition surfaces
(`docs/product/one-real-loop-contract.md`). Acquisition copy never leads with
Trust Passport, blockchain, SD-JWT, knowledge graph, PSV, Evidence OS, trust
tiers, or "credentialing infrastructure" — those terms live where technically
necessary, never as the first explanation.

## Claims discipline

- No credentialing-duration claims: no "under 24 hours", no "< 5 days", no
  "10x", no guaranteed start dates. Time-to-start is an intended outcome,
  never a number.
- VitalCV never automatically clears, verifies, or credentials anyone.
  Institutions run their own review and make their own decisions.
- Blockchain anchoring is not a current public product benefit
  (`apps/web/components/marketing/LedgerTicker.tsx` documents it as not
  integrated).
- The banned-strings list in CLAUDE.md is absolute.

## Verified current state (2026-08-04)

- Homepage `/` = `HorizontalCareerFilm` on light paper (`#F0EEE9` via
  `--vt-cloud-dancer`). The dark-navy/antigravity system is archived and not
  a mandate for anything.
- Real NPI stack: `checkNpi` (format gate) → `/api/identity/bootstrap/[npi]`
  + `/api/trust-state/[npi]` → NPPES via the backend. No readiness scores on
  public surfaces (e2e-pinned).
- MATCHA is mounted and live: 27 route paths under `app/api/matcha/`,
  `FEATURES.MATCHA_V2` defaults true (PUBLIC tier), `liveMatchaService`
  scores real DB `Opportunity` records. (Its legacy in-memory
  `opportunityRegistry` still backs a few list/write routes — a known gap,
  not the live match path.)
- Apply with VitalCV: `apps/web/components/apply/ApplyWithVitalCV.tsx`;
  share/revoke via `/api/apply/share` (backend Clerk boundary).
- The `/verifier/*` tree is archived; employer surfaces live at
  `/employer/*` (review-queue, applications, worklist, post, profile).
- Deploy target is Railway, never Vercel. A fresh worktree needs
  `pnpm turbo run build --filter @vitalcv/web` before the web build works.

## Operating constraints

- Truth contract and banned strings: CLAUDE.md (authoritative).
- Production-promotion lock: `docs/ops/FOUNDER_VISUAL_GATE.md` §0 —
  `FOUNDER VISUAL DECISION: GO` accepts a direction;
  `FOUNDER PRODUCTION PROMOTION: GO` is the only production authorization.
- OpenClaw, Browser, and Cowork are not used for build/verify work.
