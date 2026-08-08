# Rotating `CLERK_SECRET_KEY`

Runbook for replacing the Clerk **backend** API key. Written 2026-08-08 after
the key was found stored as a GitHub Actions **variable** rather than a secret —
variables are unmasked in logs and readable in the UI by anyone with settings
access, so any key that has lived in one should be treated as exposed and
replaced rather than merely moved.

> **Read the coupling section first.** This key does not only authenticate to
> Clerk. Rotating it without preparation logs users out.

## What depends on this key

| Consumer | Location | Consequence if stale/missing |
| --- | --- | --- |
| `apps/web` | Railway **web** service env | `DEPLOY.md` marks it **Required**. Auth breaks. |
| `apps/api/backend` | Railway **API** service env | `envValidation.ts`: *"Auth will be degraded"*. |
| `release-verify` | GitHub Actions secret | Signed-in verification stops running (now RED, see below). |
| `synthetic-reconcile` | GitHub Actions secret | Sweep stops running (now RED). |
| **Role cookie signing** | `apps/web` runtime | **See below — this is the one that surprises people.** |

**Do not touch `E2E_CLERK_SECRET_KEY`.** That is a separate `sk_test_` key used
only by the CI E2E job. Different credential, different blast radius; rotating
it during this procedure breaks CI for no benefit.

## The coupling that makes this more than a config change

`apps/web/lib/auth/roleCookie.ts`:

```ts
function getSecret(): string {
  return process.env.ROLE_COOKIE_SECRET || process.env.CLERK_SECRET_KEY || '';
}
```

If `ROLE_COOKIE_SECRET` is unset, the role cookie is HMAC'd with
`CLERK_SECRET_KEY`. Rotating the Clerk key then invalidates **every outstanding
role cookie simultaneously** — signed-in users lose their resolved role until it
re-mints. That is a user-visible event, not a deployment detail, and it is easy
to miss because nothing in the Clerk dashboard hints at it.

Check whether the override is set before doing anything else:

```bash
curl -s https://vitalcv.com/api/health/auth | jq
```

…or read the web service env in Railway. If `ROLE_COOKIE_SECRET` is absent, do
step 0.

## Step 0 — decouple cookie signing (only if `ROLE_COOKIE_SECRET` is unset)

1. Generate an independent value: `openssl rand -hex 32`.
2. Set `ROLE_COOKIE_SECRET` on the Railway **web** service.
3. Deploy and confirm existing sessions still resolve their role.

This is itself a cookie-invalidating change — the signing secret moves from the
Clerk key to the new value — so do it as its own deliberate step rather than
folded into the rotation. Doing it first means the rotation proper cannot touch
cookie signing at all.

## Step 1 — mint the new key

Create a new backend API key in the Clerk dashboard. **Do not revoke the old one
yet**; both must be valid while consumers are updated, or there is a window where
production is authenticating against a key nobody holds.

## Step 2 — update every consumer

Update all three before revoking anything:

1. Railway **web** service → `CLERK_SECRET_KEY` → redeploy.
2. Railway **API** service → `CLERK_SECRET_KEY` → redeploy.
3. GitHub → Settings → Secrets and variables → **Actions** → *Repository
   secrets* → **`CLERK_SECRET_KEY_PROD`** (note the suffix — the workflows map
   it onto the `CLERK_SECRET_KEY` env var the scripts read, so the GitHub name
   and the process name deliberately differ).

> **Where the GitHub copy goes, and how it hides.** It must be a **secret**, not
> a variable, on the **Actions** tab (not Dependabot), named exactly
> `CLERK_SECRET_KEY_PROD`.
>
> **`secrets.<name>` resolves to the empty string when the name does not exist,
> with no error anywhere.** That single fact cost five dispatches: the
> workflows read `secrets.CLERK_SECRET_KEY` while the secret was
> `CLERK_SECRET_KEY_PROD`, so every run reported "monitor not wired" rather
> than "wrong name", and three separate hypotheses (repository vs environment
> scope, lowercase vs capital `Production`) were chased and disproved before
> anyone read the actual list. If a monitor reports `MISCONFIGURED` after
> rotation, **check the name against the list first** — it is the cheapest
> check and it was the answer.

## Step 3 — verify before revoking

Verify each consumer independently. Do not infer one from another.

```bash
# GitHub Actions — must show Reconcile RUNNING, not skipped
gh workflow run synthetic-reconcile.yml --ref main -f dry_run=true
```

- **Web**: sign in and reach a `/holder` surface.
- **API**: confirm no `auth degraded` warnings in the service logs.
- **CI**: dispatch `release-verify` — the `vitalcv/release-verified` commit
  status must report a real result, not `MISCONFIGURED` and not
  `skipped — monitor not wired`.

Both monitors fail **red** when the key is invisible (changed 2026-08-08), so a
missed consumer announces itself rather than passing quietly. That is the point
of the fail-closed behaviour — see `release-monitoring.md`.

## Step 4 — revoke the old key

Only once all three consumers are updated **and** verified. Revoking earlier
turns a routine rotation into an outage.

## Step 5 — confirm the blast radius is clean

- Sessions still work (role cookies re-minted if step 0 applied).
- Both monitors green on their next scheduled tick.
- No stray `CLERK_SECRET_KEY` (unsuffixed) exists in GitHub **Variables** or on
  any environment — the repository secret `CLERK_SECRET_KEY_PROD` should be the
  only copy.

## Rollback

Until step 4, rollback is: restore the old key value in whichever consumer was
changed and redeploy. After revocation, rollback requires minting a fresh key
and repeating steps 2–3 — there is no way to un-revoke.

## Why this document exists

Both production monitors skipped their work and reported success for their
entire lifetimes — `release-verify` never once executed its signed-in
verification against production. The eventual cause was mundane: the workflows
read `secrets.CLERK_SECRET_KEY` while the secret is named
**`CLERK_SECRET_KEY_PROD`**.

`secrets.<name>` yields the empty string when nothing of that name exists, with
no error, so the monitors could not tell "wrong name" from "not configured" —
and neither could anyone reading them. Five dispatches and three disproved
hypotheses (stored as a variable; repository vs environment scope; lowercase vs
capital `Production`) went by before anyone simply read the secrets list, which
would have answered it in seconds.

Two lessons worth keeping:

1. **An empty secret is indistinguishable from a working one unless something
   asserts otherwise** — which is why both monitors now fail red rather than
   skipping quietly.
2. **Read the list before theorising about scope.** Every hypothesis above was
   plausible, internally consistent, and wrong; the cheap enumeration was
   available the whole time.
