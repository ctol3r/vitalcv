# Clerk + Google OAuth Activation Runbook

**Canonical source for "how do I turn on Google sign-in?"**

This runbook is the consolidated answer to the recurring OAuth-activation briefs (AUTH-2 PR274A, AUTH-3 PR284A, AUTH-3 PR285A, PROD-2 PR304A, PROD-2 PR305A and rephrases). The honest scope of work is documented here: most of it lives **outside the VitalCV repo** in Clerk Dashboard + Google Cloud Console + Vercel.

If you've been sent a brief that says "activate Google OAuth" or "real OAuth turn-on" or "first real clinician login," start here.

## The non-negotiable truth

**Google OAuth is not configured in the VitalCV codebase.** It is configured in:

1. **Clerk Dashboard** (https://dashboard.clerk.com) — IdP provider toggles, OAuth credentials, allowed origins.
2. **Google Cloud Console** (https://console.cloud.google.com/apis/credentials) — OAuth client ID, secret, authorized redirect URIs.
3. **Local `.env.local`** (gitignored) — Clerk keys for `pnpm dev`.
4. **Vercel project env vars** (https://vercel.com/blockchaincv/vitalcv/settings/environment-variables) — Clerk keys for production deploys.

No PR will "turn on Google OAuth" by changing code. The repo-side wiring is already complete (`<ClerkProvider>` mounted at `apps/web/app/layout.tsx`, `clerkMiddleware` in `apps/web/middleware.ts`, `<SignIn />` widget at `apps/web/app/sign-in/[[...sign-in]]/page.tsx` — and the same pattern in `apps/web-v2` per PR #310).

The repo's only role is to **honor whatever IdP set is enabled in Clerk**. Adding Google to that set is a Dashboard config action.

## Activation checklist (in order)

### 1. Create / select a Clerk application

1. Open https://dashboard.clerk.com.
2. Select an existing application or create a new one for `vitalcv`.
3. Note which instance: **Development** (test mode) vs **Production**. Keys have different prefixes:
   - `pk_test_…` / `sk_test_…` for dev
   - `pk_live_…` / `sk_live_…` for prod

### 2. Enable Google as an SSO connection in Clerk

1. In Clerk Dashboard → **Configure** → **SSO Connections**.
2. Click **Google** → toggle **Enable**.
3. Clerk will display the **callback URL** to register with Google. Copy it. It looks like:
   - Test instance: `https://<your-clerk-frontend-api>.clerk.accounts.dev/v1/oauth_callback`
   - Production instance with custom domain: `https://<your-clerk-frontend-domain>/v1/oauth_callback`

### 3. Create the OAuth credential in Google Cloud Console

1. Open https://console.cloud.google.com/apis/credentials.
2. Select a project (or create one for `vitalcv`).
3. **Create Credentials → OAuth client ID → Web application**.
4. **Authorized redirect URIs**: paste the Clerk callback URL from step 2.
5. **Authorized JavaScript origins**: add your dev + prod origins:
   - `http://localhost:3000` (dev)
   - `http://localhost:3100` (web-v2 sandbox dev)
   - `https://vitalcv.com` (or your production origin)
6. Save. Google issues a **Client ID** and **Client Secret**.

### 4. Paste Google credentials into Clerk

1. Back in Clerk Dashboard → Google SSO Connection.
2. Paste the **Client ID** and **Client Secret** from Google.
3. Save.

### 5. Configure local `.env.local`

Create `/Users/christoler/vitalcv/.env.local` with the **real** keys from Clerk Dashboard → **API Keys**. **Do not use placeholders like `pk_live_REPLACE_ME`** — placeholders will compile and pass the `CLERK_PROVIDER_ENABLED` gate, then fail at runtime against Clerk's backend with confusing errors.

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…   # real value from Clerk Dashboard
CLERK_SECRET_KEY=sk_test_…                    # real value from Clerk Dashboard

# Optional — only set if you've overridden the defaults in Clerk Paths
# NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
# NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
# NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The canonical schema is `apps/web/lib/env.ts` — the validator at `loadEnv()` will refuse to boot if `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY` are missing.

### 6. Configure Vercel env vars (production)

1. https://vercel.com/blockchaincv/vitalcv/settings/environment-variables.
2. Add for **Production** scope:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_…`
   - `CLERK_SECRET_KEY` = `sk_live_…`
3. Redeploy. The Vercel dashboard's last-deployment log should show no env-validation failures from `loadEnv()`.

### 7. Verify locally

```bash
# In your terminal (not behind an agent tool call):
pnpm install
pnpm --filter @vitalcv/web dev
# Open http://localhost:3000/sign-in
# Click "Continue with Google" → drive the round-trip in the browser
```

If the `Continue with Google` button doesn't appear, Google isn't actually enabled on the Clerk instance — recheck step 2. If it appears but the round-trip fails, see Diagnostics below.

## Diagnostics — when sign-in fails

| Symptom | Likely cause | Fix |
|---|---|---|
| `useAuth() called outside ClerkProvider` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` missing in env | Add to `.env.local` (local) or Vercel env (prod) |
| `Clerk: Failed to load` in browser console | Wrong key prefix for environment (`pk_test_` on prod domain or vice versa) | Match `pk_live_` to prod, `pk_test_` to dev |
| 500 on every protected route | `CLERK_SECRET_KEY` missing — middleware can't call `auth()` | Add to env |
| Google button missing | Google SSO not enabled in Clerk Dashboard | Step 2 |
| Google redirect → "Error 400: redirect_uri_mismatch" | Clerk callback URL not in Google's authorized redirect URIs | Step 3 (#4) |
| Google redirect → "Access blocked: this app's request is invalid" | Authorized origins missing in Google Cloud Console | Step 3 (#5) |
| Sign-in succeeds but `/holder` immediately redirects back to `/sign-in` | Clerk session cookie not surviving — likely Clerk custom-domain config or `SameSite` issue | Clerk Dashboard → Configure → Domains; ensure custom domain is verified |
| Local works, prod fails | Vercel env scope wrong (only set Preview not Production) | Step 6 |

## Repo-side gates that already exist

Pre-shipped, will continue to honor whatever IdP set you enable:

- **`apps/web/lib/env.ts`** — declares both Clerk keys as `kind: 'required'`. `loadEnv()` throws at boot if absent.
- **`apps/web/middleware.ts`** — `clerkMiddleware` redirects unauthenticated requests on protected routes; short-circuits to no-op if `CLERK_SECRET_KEY` is absent (dev-only graceful degrade).
- **`apps/web/app/layout.tsx`** — `<ClerkProvider>` mounted conditionally on `CLERK_PROVIDER_ENABLED` (derived from publishable-key presence; never hardcoded).
- **`apps/web-v2/...`** — same pattern, port 3100, mirrored in PR #310.
- **`apps/web/__tests__/clinician-activation-flow-gates.test.ts`** (PR #311) — 53-test source-level lockdown that no mock-auth surface can be reintroduced.

## What no agent or PR can do for you

- Generate real Clerk keys — only the Clerk Dashboard issues them.
- Verify Google OAuth in production — only a browser round-trip against your real prod URL can.
- Read your `.env.local` to "check if Clerk is configured" — that file is gitignored secret state. Run `grep -c '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' .env.local` yourself if you need presence-only confirmation.
- Predict whether your specific Google Cloud project will work — that's between you, Google, and Clerk.

## After this runbook is followed

Once the dashboard config is correct AND env vars are set, the **next code action that moves Activation Board numbers** is:

- **W3-PR213A** (wire `buildReplayLineage` from #313 into the live passport response builder) — closes "Replay Attribution Integrity" from ~50 to ~80.
- **W4-PR249A** (wire `ProofManifestPanel` from #309 into `/passport/[id]`) — closes "Manifest Visibility" from ~50 to ~75.
- **AUTH-1 PR268A** (clinician↔NPI ownership binding) — closes "Ownership Continuity" from ~40 to ~70.

OAuth activation itself is a Dashboard/Console task, not a code task.

## Closing the rephrasing pattern

If you receive a brief asking for "OAuth turn-on," "real OAuth verification," "real clinician login," "first login verification," "auth runtime activation," or any rephrase: **point at this doc.** Do not open another audit PR with the same answer. The static analysis cannot verify Dashboard configuration.
