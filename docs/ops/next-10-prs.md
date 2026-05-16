# Next 10 PRs — 2026-05-07

**Baseline commit:** `bf654a94`  
**Priority order:** Tier 1 demo blockers first, then CI gates, then Tier 2 pilot path.  
**Reference:** launch-blockers.md, open-pr-triage-2026-05-07.md

---

### PR-NEXT-1: Fix hero banned strings and fake source claims
**Branch to create:** `fix/hero-banned-strings-wave17`  
**Purpose:** Remove all W17 copy violations from `HomePageClient.tsx` and the Hero component: banned strings, uncertified badges, gated source (Nursys), dead CTA route.  
**Addresses blocker:** LB-D-01, LB-D-02, LB-D-03, LB-D-04, LB-D-05, LB-D-06, LB-D-11  
**Files to change:**
- `apps/web/app/HomePageClient.tsx` — remove banned strings; replace or remove Nursys green checkmark; replace SOC2/NCQA badges with honest copy; fix "hire instantly" → accurate language; fix "Request a Demo" CTA target (use `/pilot` not `/verifier`)
- Hero component file (locate via `grep -r "Zero-Trust Credentialing" apps/web/app/` to find exact path)  
**What NOT to touch:** NPI submit flow; `LaneStateBadge`; `TrustTierBadge`; Geist font variables; layout.tsx  
**Codex audit focus:** Confirm zero matches for all 10 banned strings in changed files; confirm Nursys not shown as live/checked without `REAL_NURSYS_ENABLED`; confirm no SOC2/NCQA/HIPAA certified language; confirm CTA routes to `/pilot`; confirm no bare "Verified" label

---

### PR-NEXT-2: Fix clinician route banned strings
**Branch to create:** `fix/clinician-banned-strings`  
**Purpose:** Remove banned strings from four confirmed-violating clinician routes.  
**Addresses blocker:** LB-D-07, LB-D-08, LB-D-09  
**Files to change:**
- `apps/web/app/clinician/onboarding/page.tsx`
- `apps/web/app/clinician/import/page.tsx`
- `apps/web/app/clinician/import/professional/page.tsx`
- `apps/web/app/clinician/profile-layers/page.tsx`  
**What NOT to touch:** Import logic; profile type definitions; `profileCompletion.ts`; onboarding milestone logic  
**Codex audit focus:** Confirm zero banned-string matches in all four files; confirm copy still communicates value without overclaiming; confirm no bare "Verified" labels

---

### PR-NEXT-3: Merge banned-strings CI gate (PR #225)
**Branch to create:** `(already exists — merge PR #225)`  
**Purpose:** Add CI gate that fails the build if any banned string is introduced in a PR diff.  
**Addresses blocker:** LB-D-10  
**Files to change:** CI workflow file (1 file per PR #225)  
**What NOT to touch:** Source code; Prisma schema  
**Codex audit focus:** Confirm gate runs on PR event; confirm all 10 banned strings are in the check list; confirm gate produces actionable error output with file+line reference

---

### PR-NEXT-4: Merge OIG three-way semantics (PR #272)
**Branch to create:** `(already exists — merge PR #272)`  
**Purpose:** Fix OIG/LEIE source adapter to properly distinguish excluded / sanctioned / clean — three distinct semantic states, not a binary.  
**Addresses blocker:** LB-P-05  
**Files to change:** `packages/source-adapters/` (3 files per PR #272)  
**What NOT to touch:** NPPES adapter; CRS engine; PSV receipt path  
**Codex audit focus:** Confirm three-way distinction is represented as distinct enum/union values; confirm no result collapses excluded and sanctioned; confirm tests cover all three outcomes; confirm no banned strings in copy labels

---

### PR-NEXT-5: Merge signup gate + magic-link recovery (PR #238)
**Branch to create:** `(already exists — merge PR #238)`  
**Purpose:** Gate the clinician onboarding behind real auth; add magic-link recovery flow via Clerk.  
**Addresses blocker:** LB-P-11  
**Files to change:** Auth-related files (6 files per PR #238)  
**What NOT to touch:** Employer/issuer routes; Prisma schema; source adapters  
**Codex audit focus:** Confirm Clerk `clerkMiddleware` still wired; confirm onboarding route requires auth; confirm magic-link sends via Clerk email API (not hardcoded SMTP); confirm no banned strings in recovery copy; confirm no fake "account verified" language

---

### PR-NEXT-6: Merge verifier invitations foundation (PR #248)
**Branch to create:** `(already exists — merge PR #248)`  
**Purpose:** Add verifier invitation lifecycle foundation; `invitationSystemLive: false` must be preserved — this is a foundation PR, not a live activation.  
**Addresses blocker:** LB-P-06 (partial — RBAC middleware still needs rebase via PR #243)  
**Files to change:** 11 files per PR #248  
**What NOT to touch:** `middleware.ts` (PR #243 handles RBAC gating separately); Prisma schema  
**Codex audit focus:** Confirm `invitationSystemLive: false` is preserved in foundation types; confirm no route permits verifier access without auth gate; confirm `rbacEnforced: false` is accurately reflected in foundation; confirm tests cover invitation state transitions

---

### PR-NEXT-7: Rebase + merge verifier RBAC middleware (PR #243)
**Branch to create:** `(rebase existing branch for PR #243)`  
**Purpose:** Resolve middleware.ts conflict and land RBAC gating for verifier routes.  
**Addresses blocker:** LB-P-06  
**Files to change:** `apps/web/middleware.ts` + 3 other files (per PR #243)  
**What NOT to touch:** Clerk `clerkMiddleware` export; Prisma schema; source adapters  
**Codex audit focus:** Confirm `clerkMiddleware` is the exported middleware (not replaced); confirm verifier routes require auth; confirm no employer/clinician routes accidentally gated; confirm diff against `origin/main` not stale local main

---

### PR-NEXT-8: Security headers + CSP baseline
**Branch to create:** `security/csp-headers-baseline`  
**Purpose:** Add Content Security Policy and security headers to `next.config.mjs`; move security score from 35% to ~55%.  
**Addresses blocker:** LB-P-07  
**Files to change:**
- `apps/web/next.config.mjs` — add `headers()` with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- `apps/web/middleware.ts` — add security header middleware (if not in next.config)  
**What NOT to touch:** Clerk middleware logic; Prisma schema; any source adapter  
**Codex audit focus:** Confirm CSP does not block Clerk scripts/iframes; confirm X-Frame-Options: SAMEORIGIN; confirm no `unsafe-eval` in CSP unless justified; confirm headers appear in `curl -I https://vitalcv.com` equivalent; confirm TypeScript compiles

---

### PR-NEXT-9: Zod env validation
**Branch to create:** `security/zod-env-validation`  
**Purpose:** Add Zod-based env validation at app startup; fail fast on missing required env vars rather than silently degrading.  
**Addresses blocker:** LB-P-08  
**Files to change:**
- `apps/web/env.ts` (create if not exists) — Zod schema for all required env vars: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, feature flags (`OIG_LEIE_ENABLED`, `PECOS_ENABLED`, `STATE_BOARD_ENABLED`, `REAL_NURSYS_ENABLED`, `FSMB_ENABLED`)
- `apps/web/app/layout.tsx` — import env validation at module load  
**What NOT to touch:** Source adapter logic; Prisma schema; Clerk middleware  
**Codex audit focus:** Confirm all feature flag env vars are typed as `z.enum(['true','false']).optional()` or similar; confirm missing `CLERK_SECRET_KEY` throws at startup not at request time; confirm no secrets logged; confirm TypeScript compiles

---

### PR-NEXT-10: Hero route smoke CI + route map gate
**Branch to create:** `(already exists — merge PR #244 + PR #224)`  
**Purpose:** Add CI smoke test for hero route and a route map gate; prevent silent 404s on key routes.  
**Addresses blocker:** LB-P-12  
**Files to change:** CI workflow files (3 files for #244, 4 files for #224) — can be merged as separate PRs  
**What NOT to touch:** Source code; Prisma schema  
**Codex audit focus:** Confirm smoke test hits `/` and returns 200; confirm route map gate lists all active routes from `apps/web/app/`; confirm `_archive/` routes are excluded from expected-live list; confirm CI fails if a listed route returns 404

---

## PR #1 Full Execution Package

### Claude Code Terminal prompt

```
git fetch origin main

# Create worktree for hero banned-string fixes
git worktree add -b fix/hero-banned-strings-wave17 /tmp/vitalcv-hero-fix origin/main
cd /tmp/vitalcv-hero-fix
pnpm install
pnpm turbo run build --filter @vitalcv/web

# Find the Hero component
grep -r "Zero-Trust Credentialing\|hire instantly\|zero-trust ledger\|Request a Demo\|SOC2\|NCQA\|Nursys" apps/web/app/ --include="*.tsx" -l

# Edit HomePageClient.tsx:
# 1. Remove or replace "Zero-Trust Credentialing Infrastructure" eyebrow
#    Replace with honest copy, e.g. "Healthcare Credentialing Platform"
# 2. Remove "anchor it to a zero-trust ledger" — replace with plain language about audit trail
# 3. Remove "hire instantly" — replace with accurate timing language
# 4. Remove SOC2 / NCQA trust badges or change to "In development"
# 5. Remove Nursys green checkmark from any source display — use "Requires institutional access" or omit
# 6. Change "Request a Demo" CTA href from /verifier to /pilot
# 7. Remove any bare "Verified" status label
# 8. Remove any banned string: "automatically verified", "guaranteed verification",
#    "complete credentialing", "instant credentialing", "legally accepted",
#    "risk transferred", "final verification without review",
#    "source confirmed before response", "certified compliant", "HIPAA compliant", "SOC2 certified"

# After edits, verify no violations remain:
grep -r "automatically verified\|guaranteed verification\|complete credentialing\|instant credentialing\|legally accepted\|risk transferred\|final verification without review\|source confirmed before response\|certified compliant\|HIPAA compliant\|SOC2 certified" apps/web/app/HomePageClient.tsx apps/web/app/Hero.tsx 2>/dev/null
# Expected: no output

# Run tests
pnpm --filter @vitalcv/web exec vitest run

# Build check
pnpm turbo run build --filter @vitalcv/web

# Open PR (do NOT merge — Codex runs first)
gh pr create \
  --title "fix: remove hero banned strings and fake source claims (W17)" \
  --body "Removes W17 copy violations from HomePageClient.tsx and Hero component.

Fixes: LB-D-01 through LB-D-06, LB-D-11

Changes:
- Remove 'Zero-Trust Credentialing Infrastructure' eyebrow
- Remove 'hire instantly', 'zero-trust ledger' phrases
- Remove SOC2 / NCQA uncertified trust badges
- Remove Nursys green checkmark (gated source, REAL_NURSYS_ENABLED required)
- Fix 'Request a Demo' CTA: /verifier → /pilot
- Remove all other confirmed banned strings

Does not modify: NPI submit flow, LaneStateBadge, TrustTierBadge, layout.tsx, Prisma schema, source adapters.

Codex SAFE required before merge." \
  --base main \
  --head fix/hero-banned-strings-wave17
```

### Codex audit prompt

```
codex exec "Three-part audit for PR fix/hero-banned-strings-wave17.

## Audit 1: Implementation audit
1. Read apps/web/app/HomePageClient.tsx
2. Read the Hero component (grep for 'Zero-Trust Credentialing' to find exact file path first)
3. Confirm ZERO matches for each banned string in changed files:
   - 'automatically verified'
   - 'guaranteed verification'
   - 'complete credentialing'
   - 'instant credentialing'
   - 'legally accepted'
   - 'risk transferred'
   - 'final verification without review'
   - 'source confirmed before response'
   - 'certified compliant'
   - 'HIPAA compliant'
   - 'SOC2 certified'
   - bare 'Verified' as a status label (not in a longer phrase)
4. Confirm Nursys is NOT shown with a green checkmark or any 'live' indicator without REAL_NURSYS_ENABLED runtime check
5. Confirm SOC2 / NCQA badges are removed or replaced with honest 'in development' language
6. Confirm 'Request a Demo' CTA (or equivalent) routes to /pilot, NOT /verifier

## Audit 2: Diff audit
1. Run: git diff origin/main -- apps/web/app/HomePageClient.tsx
2. Run: git diff origin/main -- apps/web/app/ (find Hero file)
3. Confirm diff contains ONLY copy changes (no logic, no imports of new modules, no Prisma, no middleware)
4. Confirm NPI submit route is unchanged (should still route to /passport?npi=)
5. Confirm LaneStateBadge and TrustTierBadge imports are unchanged
6. Confirm no new files added that contain banned strings

## Audit 3: Copy/truth audit
1. Confirm the page still accurately describes what VitalCV does (NPI lookup, readiness signals, employer decision support)
2. Confirm no new overclaiming language was introduced as a replacement (e.g., 'verified in real time', 'instant check')
3. Confirm any source display lists only NPPES as always-on; OIG/PECOS/Nursys/FSMB are shown as gated or absent
4. Confirm all CTAs route to routes that exist in apps/web/app/ and are NOT in _archive/

Verdict: SAFE or FAIL with specific line references."
```

### One-sentence final verdict

VitalCV is **not yet safe to demo** — banned strings and fake source claims on the homepage hero are blocking, but all Tier 1 blockers are copy changes fixable in a single focused wave with zero schema or logic risk.
