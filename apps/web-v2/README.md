# @vitalcv/web-v2

Sandbox Next 15 app for UI exploration outside the main `apps/web` surface.

## What this is

- A clean-slate Next 15 + React 19 scaffold.
- Workspace package, so it inherits `pnpm`, `turbo`, and the repository's
  `CLAUDE.md` truth contract.
- Runs on port **3100** (so it doesn't collide with `apps/web` on 3000).

## What this is NOT

- Not a production surface. Do not import this from `apps/web` or any other
  shipping app.
- Not exempt from the truth contract. Banned strings, "Verified" label rules,
  and ambiguity preservation apply here exactly as in `apps/web`.
- Not a replacement for `apps/web`. If something here turns out to be worth
  shipping, port it into `apps/web` and the design system, then delete it
  from here.

## Local commands

```bash
# Dev server (port 3100)
pnpm --filter @vitalcv/web-v2 dev

# Production build
pnpm --filter @vitalcv/web-v2 build

# Typecheck only
pnpm --filter @vitalcv/web-v2 typecheck
```

## Auth (Clerk)

This sandbox uses [Clerk](https://clerk.com) for authentication, mirroring the
pattern in `apps/web`. Required env vars (set in `.env.local`, gitignored):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... | pk_live_...
CLERK_SECRET_KEY=sk_test_... | sk_live_...
```

Optional overrides:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

**Fail-closed behavior:** When `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing,
`<ClerkProvider>` is not mounted; the middleware short-circuits to a no-op
pass-through; `/sign-in` renders an explicit "not configured" message. The
sandbox stays usable for non-auth UI work rather than crashing.

**Google OAuth** (or any other IdP) is configured inside the Clerk Dashboard,
not in this repo. The mounted `<SignIn />` widget honors whatever providers
are enabled on the Clerk instance.

## Adding features

One PR per feature, same rules as anything else in the monorepo. Do not bundle
sandbox experiments with `apps/web` changes.
