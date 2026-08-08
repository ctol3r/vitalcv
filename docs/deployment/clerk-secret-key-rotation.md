# Rotating `CLERK_SECRET_KEY`

Runbook for replacing the Clerk **backend** API key.

**Where the key lives (established 2026-08-08 by measurement, after four wrong
guesses): Railway only.** It is set on the Railway web and API services, where
production genuinely needs it. It has **never** existed as a GitHub Actions
secret — which is why both CI monitors have never been able to run. Adding a
GitHub copy is a prerequisite for the monitors, and is itself a deliberate step
below, not an assumed part of the environment.

> **Read the coupling section first.** This key does not only authenticate to
> Clerk. Rotating it without preparation logs users out.

## What depends on this key

| Consumer | Location | Consequence if stale/missing |
| --- | --- | --- |
| `apps/web` | Railway **web** service env | `DEPLOY.md` marks it **Required**. Auth breaks. |
| `apps/api/backend` | Railway **API** service env | `envValidation.ts`: *"Auth will be degraded"*. |
| `release-verify` | GitHub Actions secret — **NOT YET CONFIGURED** | Signed-in verification cannot run; job is RED. |
| `synthetic-reconcile` | GitHub Actions secret — **NOT YET CONFIGURED** | Sweep cannot run; job is RED. |
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
   secrets* → **`CLERK_SECRET_KEY_PROD`**. Note this copy does **not exist yet**
   — creating it is what finally wires the CI monitors. The workflows map it
   onto the `CLERK_SECRET_KEY` env var the scripts read, so the GitHub name and
   the process name deliberately differ; `_PROD` mirrors the Railway variable
   name and separates it from the `sk_test_` key CI E2E uses.

> **Where the GitHub copy goes, and how it hides.** It must be a **secret**, not
> a variable, on the **Actions** tab (not Dependabot), named exactly
> `CLERK_SECRET_KEY_PROD`.
>
> **`secrets.<name>` resolves to the empty string when the name does not exist,
> with no error anywhere.** A workflow therefore cannot distinguish "wrong name"
> from "not configured" from "wrong scope" — all three look identical. That
> single ambiguity absorbed six dispatches and four wrong hypotheses (stored as
> a variable; repository vs environment scope; lowercase vs capital
> `Production`; wrong secret name) before the true answer surfaced: the key was
> only ever in Railway, and no GitHub copy existed to find.
>
> If a monitor reports `MISCONFIGURED`, **enumerate what Actions can actually
> read before theorising about why it cannot read it.**

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
- The GitHub copy is a repository **secret** named `CLERK_SECRET_KEY_PROD`,
  with no stray unsuffixed `CLERK_SECRET_KEY` in Variables or on any
  environment.
- Railway web and API still hold the key under the name their runtime reads.

## Rollback

Until step 4, rollback is: restore the old key value in whichever consumer was
changed and redeploy. After revocation, rollback requires minting a fresh key
and repeating steps 2–3 — there is no way to un-revoke.

## Why this document exists

Both production monitors skipped their work and reported success for their
entire lifetimes — `release-verify` never once executed its signed-in
verification against production. The cause turned out to be the simplest
possible one: **the Clerk key exists only in Railway. No GitHub Actions copy was
ever created.** The monitors were asking for a credential nobody had given them.

`secrets.<name>` yields the empty string when nothing of that name exists, with
no error. A workflow therefore cannot tell "wrong name" from "wrong scope" from
"never configured" — and neither can anyone reading its logs. That single
ambiguity absorbed six dispatches and four wrong hypotheses:

| # | Hypothesis | Disproved by |
| --- | --- | --- |
| 1 | Stored as a **variable**, not a secret | Moving it to Secrets changed nothing |
| 2 | **Environment** secret, job lacked `environment:` | Ran on a commit carrying the declaration; still empty |
| 3 | Environment name **case** (`production` vs `Production`) | Same; still empty |
| 4 | Wrong **secret name** (`CLERK_SECRET_KEY_PROD`) | Repointed the workflows; still empty |

Each was plausible and internally consistent. All four theorised about *where*
the secret was, and none first established *what Actions could read at all* —
which a single enumeration would have shown.

Three lessons worth keeping:

1. **An empty secret is indistinguishable from a working one unless something
   asserts otherwise** — which is why both monitors now fail red rather than
   skipping quietly.
2. **Enumerate before theorising.** The cheap check was available the whole
   time and would have ended this in one step.
3. **A secret existing in one platform says nothing about another.** Production
   auth worked perfectly throughout, because Railway had the key. That
   working-ness was actively misleading: it made "the key exists" feel
   established, when the only question that mattered was whether *CI* had it.
