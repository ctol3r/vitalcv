# Wave 226 — Platform Environment Hardening Report
**Date:** 2026-03-10  
**Executed by:** SparkJoy ✨  
**Status:** ✅ Complete (with one critical fix applied)

---

## Section A — Clerk Identity System

### Configuration Status
Clerk is integrated via `@clerk/nextjs`. The middleware is fully implemented at `apps/web/middleware.ts`.

| Setting | Status |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Set in Vercel (Production + Preview) |
| `CLERK_SECRET_KEY` | ✅ Set in Vercel (Production + Preview) |
| Sign-in URL | `/sign-in` (configured in `.env.example`) |
| Sign-up URL | `/sign-up` (configured in `.env.example`) |
| Post-sign-in redirect | `/` (role-based landing via middleware) |
| Post-sign-up redirect | `/` (role-based landing via middleware) |

### Role-Based Routing (Middleware)
`apps/web/middleware.ts` implements:
- JWT claim fast-path: reads `session.sessionClaims?.vitalcv?.role`
- Fallback: calls `/api/auth/resolve-role` → creates/reads DB user → redirects for JWT refresh
- Role landing pages: `/holder`, `/verifier`, `/issuer`
- Mismatch redirect: prevents cross-role route access
- Circuit breaker: `/auth/error` if role cannot be resolved

### ⚠️ Items Requiring Manual Clerk Dashboard Verification
The Clerk dashboard (`dashboard.clerk.com`) requires browser access to verify:
- [ ] Domain allowlist: `vitalcv.com`, `www.vitalcv.com`, Vercel preview domains
- [ ] Passkey authentication — enable if not already active
- [ ] Email magic link — enable if not already active
- [ ] Phone number — set to optional
- [ ] Password — disable or set optional (clinician-first UX)
- [ ] JWT template: confirm `vitalcv.role` claim is emitted from `publicMetadata.vitalcv.role`
- [ ] Redirect URLs allowlist: `/holder`, `/verifier`, `/issuer`, `/sign-in`, `/sign-up`

---

## Section B — Vercel Deployment Integrity

### Deployment List (as of 2026-03-10 ~08:00 PDT)

| Age | URL | Status | Environment |
|---|---|---|---|
| 2h | vitalcv-1w6oc9t9p-blockchaincv.vercel.app | ❌ **Error** | Production |
| 2d | vitalcv-ax41ivsge-blockchaincv.vercel.app | ✅ Ready | Production |
| 2d | vitalcv-jylo2etsy-blockchaincv.vercel.app | ✅ Ready | Production |
| 2d+ | multiple preview builds | ✅ Ready | Preview |

### Root Cause of Production Build Error
**File:** `apps/web/app/mission-ops/v2/MissionOpsV2Client.tsx:202`  
**Error:** `Type 'unknown' is not assignable to type 'ReactNode'`  
**Cause:** `selected` is typed as `Record<string, unknown>`. Fields `.id`, `.name`, `.role`, `.riskScore`, `._raw` were passed directly to `InspectorPanel.value: ReactNode` without coercion.  
**Fix applied:** Wrapped all 5 fields with `String(selected.field ?? '')`.  
**Commit:** `779f49ea` — pushed to `main`.  
**Expected outcome:** Next Vercel deployment from `main` will succeed.

### Environment Variables in Vercel

| Variable | Status |
|---|---|
| `CLERK_SECRET_KEY` | ✅ Production + Preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Production + Preview |
| `NEXT_PUBLIC_API_BASE` | ✅ Production + Preview |
| `NEXT_PUBLIC_DEMO_MODE` | ✅ Production |
| `ANTHROPIC_API_KEY` | ❌ **MISSING** — required by internal pages |
| `DATABASE_URL` | ❌ **MISSING** — backend is Railway-hosted (not Vercel), but Next.js server-side code may reference it |
| `NEXT_PUBLIC_BACKEND_URL` | ❌ **MISSING** — locally in `.env.local` but not in Vercel |

### Route Health (last known-good production deployment)

| Route | HTTP Status | Notes |
|---|---|---|
| `/` | 200 (vitalcv.com) | ✅ Homepage loads |
| `/holder` | 401 | Expected — Clerk middleware requires auth |
| `/verifier` | 401 | Expected — Clerk middleware requires auth |
| `/issuer` | 401 | Expected — Clerk middleware requires auth |
| `/demo/ats` | Not tested | Preview-only route |
| `/demo/roi` | Not tested | Preview-only route |

> 401s on protected routes are correct behavior — unauthenticated curl gets redirected to sign-in, which returns 401 to curl since there's no browser session.

---

## Section C — DNS + Domain Routing

### DNS Records (verified via `dig`)

| Record | Type | Points To | Status |
|---|---|---|---|
| `vitalcv.com` | A | `216.150.1.1` (Vercel) | ✅ Resolves to Vercel |
| `www.vitalcv.com` | CNAME | `4061035bdbe9aaf6.vercel-dns-016.com` | ✅ Vercel CNAME |
| `api.vitalcv.com` | — | (no record) | ❌ **NOT CONFIGURED** |
| `preview.vitalcv.com` | — | (no record) | ❌ **NOT CONFIGURED** |

### DNS Summary
- Root domain and `www` are correctly pointing to Vercel ✅
- `api` subdomain has no DNS record — backend is hosted on Railway (`NEXT_PUBLIC_API_BASE` set separately)
- `preview` subdomain has no record — Vercel preview deployments use `*.vercel.app` URLs automatically

---

## Section D — Wallet + OIDC Flow Verification

### Architecture Review
From codebase analysis:

| Component | Location | Status |
|---|---|---|
| OIDC4VP presentation routes | `apps/api/backend/src/routes/` | ✅ Implemented (Wave 49/98/112) |
| Credential share flow | `apps/web/app/holder/` + `CredentialPresentationActions` | ✅ Implemented |
| QR payload generation | `PassportShareActions.tsx` | ✅ Implemented (Wave 139/167) |
| SD-JWT selective disclosure | `selectiveDisclosure.ts` | ✅ Implemented (Wave 103/122) |
| WebAuthn passkey assertion | `/api/credentials/present/selective` | ✅ Implemented (Wave 122) |

### ⚠️ Live Flow Test Not Executed
Browser automation requires an attached tab (Chrome extension relay). Manual verification steps:
1. Sign in at `vitalcv.com/sign-in` as a clinician
2. Navigate to `/holder`
3. Open credential share modal → verify QR code renders
4. Verify OIDC4VP redirect resolves to `/widget/authorize`
5. Confirm SD-JWT payload structure in network tab

---

## Section E — Monitoring + Logging

### Vercel Logs
- Vercel dashboard logs available for all deployments
- `vercel logs <deployment-url>` available via CLI (note: `--output raw` flag deprecated in CLI 50.x)
- Runtime logs accessible at: `vercel.com/blockchaincv/vitalcv/deployments`

### OpenClaw Gateway Logs
- OpenClaw gateway running on this machine
- Use `openclaw gateway status` to confirm daemon health

### API Logs (Railway)
- Backend deployed on Railway
- Structured logging via `console.error` in production (Wave 121 polish)
- API errors should surface via Railway's log stream
- `SENTRY_DSN` not configured in backend `.env` — errors will not be forwarded to Sentry

### Error Surfacing
| Surface | Status |
|---|---|
| Next.js build errors | ✅ Surfaced in Vercel dashboard + CI workflow |
| Vercel runtime errors | ✅ Available in deployment logs |
| Railway API errors | ⚠️ Console only — no Sentry DSN configured |
| Frontend Sentry | ⚠️ `NEXT_PUBLIC_SENTRY_DSN` not set |

---

## Recommended Fixes

### 🔴 Critical
1. **Production build was broken** — Fixed in commit `779f49ea`. Monitor next Vercel deployment to confirm ✅.

### 🟡 High Priority
2. **Add `NEXT_PUBLIC_BACKEND_URL` to Vercel env** — matches what's in `.env.local` but missing from Vercel production/preview. Required for API calls from Next.js server components.
   ```
   vercel env add NEXT_PUBLIC_BACKEND_URL production
   vercel env add NEXT_PUBLIC_BACKEND_URL preview
   ```

3. **Add `ANTHROPIC_API_KEY` to Vercel env** — referenced by internal pages. If AI features are on, this will cause runtime errors.

4. **Verify Clerk JWT template** — The middleware reads `session.sessionClaims?.vitalcv?.role`. This requires a custom JWT template in Clerk dashboard that maps `publicMetadata.vitalcv.role` to the `vitalcv.role` claim. Confirm this template exists and is active.

### 🟠 Medium Priority
5. **Add Sentry DSN** — Configure `SENTRY_DSN` on Railway and `NEXT_PUBLIC_SENTRY_DSN` on Vercel for error tracking in production.

6. **Clerk auth settings** — Manually verify in Clerk dashboard:
   - Passkey enabled
   - Magic link enabled
   - Password disabled (optional but recommended for clinician-first UX)
   - Domain allowlist includes Vercel preview domains (`*.vercel.app`)

7. **`api.vitalcv.com` DNS** — If you want a stable backend URL at `api.vitalcv.com`, add a CNAME pointing to Railway's provided domain in Squarespace DNS manager.

### 🟢 Low Priority
8. **`preview.vitalcv.com` DNS** — Optional vanity for Vercel preview. Vercel's auto-generated `*.vercel.app` previews work without it.

9. **Audit scrapbook files in git** — Last commit includes many `trust-anchor-*.json` files in `src/audit/scrapbook/`. These are runtime artifacts and should be in `.gitignore`.

---

## Summary Scorecard

| Section | Status | Notes |
|---|---|---|
| A: Clerk Auth | ⚠️ Partial | Code correct; dashboard settings need manual verification |
| B: Vercel Deployment | ✅ Fixed | Build error patched + pushed; env vars need additions |
| C: DNS Routing | ✅ Core | `vitalcv.com` + `www` → Vercel; `api`/`preview` subdomains not set |
| D: Wallet/OIDC | ✅ Architecture | Code implemented; live browser test requires manual execution |
| E: Monitoring | ⚠️ Partial | Logs available; Sentry not configured |
