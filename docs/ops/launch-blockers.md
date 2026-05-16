# Launch Blockers — 2026-05-07

**Baseline commit:** `bf654a94`  
**Reference:** current-state-map-2026-05-07.md, open-pr-triage-2026-05-07.md

---

## TIER 1: Safe to Demo (internal/founder demos only)

A demo is safe when:
- No banned strings on demo path
- No fake source claims on visible surfaces (no uncertified badges, no gated sources shown as live)
- Demo walkthrough < 60 seconds possible
- No dead routes in demo path

### Blockers

| ID | Description | File(s) | Severity | Fix Type | Effort |
|---|---|---|---|---|---|
| LB-D-01 | Hero.tsx shows Nursys with green checkmark — gated source (`REAL_NURSYS_ENABLED` required), appears as live to a viewer | `apps/web/app/HomePageClient.tsx` or `Hero.tsx` (component path TBD) | BLOCKING | copy change | XS |
| LB-D-02 | Hero.tsx displays SOC2 / NCQA trust badges — uncertified; "SOC2 certified" is a banned string | Same hero component | BLOCKING | copy change | XS |
| LB-D-03 | Hero.tsx "Request a Demo" CTA routes to `/verifier` — archived route, dead link in demo path | Same hero component | BLOCKING | copy change | XS |
| LB-D-04 | Hero.tsx W17-1: "hire instantly" — banned semantics | Same hero component | BLOCKING | copy change | XS |
| LB-D-05 | Hero.tsx W17-2: "Zero-Trust Credentialing Infrastructure" eyebrow — overclaims infrastructure status | Same hero component | CRITICAL | copy change | XS |
| LB-D-06 | `HomePageClient.tsx` contains at least one banned string (grep confirmed) | `apps/web/app/HomePageClient.tsx` | BLOCKING | copy change | XS |
| LB-D-07 | `clinician/onboarding/page.tsx` contains banned string — clinician onboarding is in demo path | `apps/web/app/clinician/onboarding/page.tsx` | BLOCKING | copy change | XS |
| LB-D-08 | `clinician/import/page.tsx` and `clinician/import/professional/page.tsx` contain banned strings | `apps/web/app/clinician/import/page.tsx`, `apps/web/app/clinician/import/professional/page.tsx` | CRITICAL | copy change | XS |
| LB-D-09 | `clinician/profile-layers/page.tsx` contains banned string | `apps/web/app/clinician/profile-layers/page.tsx` | CRITICAL | copy change | XS |
| LB-D-10 | No banned-strings CI gate — violations can be reintroduced on any PR | CI | HIGH | PR merge | XS (merge PR #225) |
| LB-D-11 | Hero.tsx W17-5: Nursys shown as live source without flag — misleads demo viewer about real-time data | Hero component | BLOCKING | copy change | XS |

**Tier 1 summary:** All LB-D-01 through LB-D-11 are copy changes (no code logic changes required) plus one PR merge (#225). Total estimated effort: ~2–3 hours for a focused session. Blocked entirely by banned strings and fake claims on the demo path.

---

## TIER 2: Safe to Pilot (first paying or letter-of-intent customer)

A pilot is safe when: Tier 1 clear + auth works in production, NPI→passport end-to-end, employer review + accept writes audit event, OIG semantics distinct, verifier RBAC gated, security headers baseline, env validation.

### Blockers

| ID | Description | File(s) | Severity | Fix Type | Effort |
|---|---|---|---|---|---|
| LB-P-01 | Auth: Google OAuth broken in production | Clerk config / `apps/web/app/sign-in` | BLOCKING | new PR needed | M |
| LB-P-02 | Auth: No e2e signup test — can't verify clinician account creation in prod | `apps/web/__tests__/` | BLOCKING | new PR needed | M |
| LB-P-03 | NPI→passport: passport route (`/passport/[id]`) is fixture-backed, no live DB read | `apps/web/app/passport/[id]/page.tsx`, `apps/web/app/api/passport/[npi]/route.ts` | BLOCKING | PR merge (#251 + new PR) | L |
| LB-P-04 | Employer review accept does NOT write audit event — `auditPersistence.ts` boundary only; no real table | `packages/audit/`, `apps/web/lib/issuer-verification/` | BLOCKING | founder decision required + new PR | L |
| LB-P-05 | OIG semantics: three-way distinction (excluded / sanctioned / clean) not yet on main | `packages/source-adapters/` | CRITICAL | PR merge | XS (merge PR #272) |
| LB-P-06 | Verifier RBAC: `invitationSystemLive: false`; `rbacEnforced: false`; middleware.ts RBAC PR conflicting | `apps/web/middleware.ts`, `packages/verifier-sdk/` | BLOCKING | rebase needed (PR #243) + merge PR #248 | M |
| LB-P-07 | Security headers / CSP: 35% — no audited Content Security Policy; default Next headers only | `apps/web/next.config.mjs`, `apps/web/middleware.ts` | CRITICAL | new PR needed | M |
| LB-P-08 | Secrets / env handling: 30% — no Zod env validation; `.env` patterns not enforced | `apps/web/env.ts` (missing or stub) | HIGH | new PR needed | S |
| LB-P-09 | No OWASP ASVS Level 1 scorecard — cannot attest baseline security to pilot customer | docs + implementation | HIGH | new PR needed | M |
| LB-P-10 | PSV receipt in-memory only — issuer receipt workflow is demo-only; no audit row persisted | `packages/psv/`, `apps/web/lib/issuer-verification/` | BLOCKING | founder decision required + new PR | L |
| LB-P-11 | Signup gate: magic-link recovery not live | `apps/web/app/sign-in/`, auth flow | CRITICAL | PR merge | XS (merge PR #238) |
| LB-P-12 | No smoke CI gate for hero route — broken homepage not caught in CI | CI | HIGH | PR merge | XS (merge PR #244) |
| LB-P-13 | Cross-tenant PSV reuse block not on main — conflict isolation unverified | `packages/psv/` | CRITICAL | rebase needed (PR #240) | S |

**Tier 2 summary:** 13 blockers. 3 are PR merges (quick). 4 require new PRs (auth, security headers, env validation, ASVS). 3 require founder decisions (persistence, audit). Estimated total effort: 3–4 focused waves.

---

## TIER 3: Safe to Sell at Scale

A scale-sale is safe when: Tier 2 clear + real PostgreSQL persistence, policy decision persistence, PSV receipt promotion tested, OWASP ASVS Level 1 scorecard, cross-tenant consent enforced.

### Blockers

| ID | Description | File(s) | Severity | Fix Type | Effort |
|---|---|---|---|---|---|
| LB-S-01 | Real PostgreSQL persistence: `DB migration readiness` at 5% — SQLite/in-memory only | `apps/web/prisma/schema.prisma`, infra | BLOCKING | founder decision required + new PR | L |
| LB-S-02 | Policy decision persistence: `schema.prisma` change required — PR #247 conflicting | `apps/web/prisma/schema.prisma`, `packages/audit/` | BLOCKING | rebase needed (PR #247) + founder decision | L |
| LB-S-03 | PSV receipt promotion: in-memory store; promotion path in PR #240 (conflicting) | `packages/psv/`, `packages/audit/` | BLOCKING | rebase needed (PR #240) after LB-S-01 | L |
| LB-S-04 | OWASP ASVS Level 1 published scorecard — no published audit document | docs | CRITICAL | new PR needed | M |
| LB-S-05 | Cross-tenant consent enforcement — `crossTenantReuseImplemented: false` | `packages/psv/`, `apps/web/lib/issuer-verification/` | BLOCKING | new PR needed after LB-S-01 | L |
| LB-S-06 | Clinician identity binding: `evaluateClinicianNpiBindingReadiness` returns `foundation_ready` only — no proven person-to-NPI binding | `packages/domain-identity/`, clinician onboarding | BLOCKING | new PR needed | L |
| LB-S-07 | Payment collection not live: `collectsPayment: false` — no revenue path | Stripe integration (PR #233 foundation only) | BLOCKING | new PR needed after pilot validation | L |
| LB-S-08 | Analytics pipeline not live: `analyticsFoundation.ts` only, no vendor wired | Analytics package | HIGH | new PR needed | M |
| LB-S-09 | No release checklist in CI — no audited gate before deploys | CI | HIGH | PR merge | XS (merge PR #223) |

**Tier 3 summary:** 9 blockers. The PostgreSQL migration (LB-S-01) is the critical-path blocker that gates LB-S-02, LB-S-03, and LB-S-05. Founder must decide on migration timing. Estimated total effort: 6–10 waves minimum.
