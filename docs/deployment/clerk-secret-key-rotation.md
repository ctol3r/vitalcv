# Rotating `CLERK_SECRET_KEY`

Runbook for replacing the Clerk **backend** API key.

**Where the key lives (established 2026-08-08 by measurement, after five wrong
guesses): Railway, plus a GitHub copy that was on the wrong tab.** Railway web
and API hold it because production needs it. The GitHub copy existed all along
but sat under **Dependabot** secrets, which an Actions job cannot read — so both
CI monitors saw an empty string and neither could run. See
[Why this document exists](#why-this-document-exists) for how that hid for so
long; the short version is that a Dependabot secret and a nonexistent secret are
byte-for-byte identical from inside a workflow.

> **Read the coupling section first.** This key does not only authenticate to
> Clerk. Rotating it without preparation logs users out.

## What depends on this key

| Consumer | Location | Consequence if stale/missing |
| --- | --- | --- |
| `apps/web` | Railway **web** service env | `DEPLOY.md` marks it **Required**. Auth breaks. |
| `apps/api/backend` | Railway **API** service env | `envValidation.ts`: *"Auth will be degraded"*. |
| `release-verify` | GitHub **Actions** repository secret `CLERK_SECRET_KEY_PROD` — **must be on the Actions tab, not Dependabot** | Signed-in verification cannot run; job is RED. |
| `synthetic-reconcile` | GitHub **Actions** repository secret `CLERK_SECRET_KEY_PROD` — same tab caveat | Sweep cannot run; job is RED. |
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
curl -s https://vitalcv.com/api/health/auth | jq '{runtimeRoleCookieSecret, roleCookieSignedWithClerkKey}'
```

```json
{ "runtimeRoleCookieSecret": false, "roleCookieSignedWithClerkKey": true }
```

**`roleCookieSignedWithClerkKey: true` means step 0 applies** — the fallback is
live and rotating the Clerk key will log every signed-in user out of their
resolved role. `false` means cookie signing is already independent and the
rotation cannot touch it.

> **This check did not work before 2026-08-08.** The runbook has always pointed
> here, but `/api/health/auth` reported only the Clerk publishable and secret
> keys — it had no role-cookie field at all. A healthy response therefore read
> as "the override is set" when the endpoint had never looked. If you are on an
> older deployment and the two fields above are absent from the JSON, do not
> infer anything from their absence; read the web service env in Railway
> instead.

The endpoint reports presence booleans only, never key material.

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
3. <https://github.com/ctol3r/vitalcv/settings/secrets/actions> → *Repository
   secrets* → **`CLERK_SECRET_KEY_PROD`**. **Follow that link rather than
   navigating by hand** — it lands on the Actions tab specifically, which is the
   entire point of this step. The workflows map the secret onto the
   `CLERK_SECRET_KEY` env var the scripts read, so the GitHub name and the
   process name deliberately differ; `_PROD` mirrors the Railway variable name
   and separates it from the `sk_test_` key CI E2E uses.

> **Where the GitHub copy goes, and how it hides.** It must be a **secret**, not
> a variable, under *Repository secrets* on the **Actions** tab — **not
> Dependabot, not Codespaces** — named exactly `CLERK_SECRET_KEY_PROD`.
>
> **This is not a hypothetical caution. It is what actually happened.** The key
> sat on the Dependabot tab for the monitors' entire lifetime. The three stores
> are rendered identically and a Dependabot secret is invisible to Actions.
>
> **`secrets.<name>` resolves to the empty string when the name is not visible
> to Actions, with no error anywhere.** A workflow cannot distinguish "wrong
> name" from "wrong tab" from "wrong scope" from "not configured" — all four
> look identical. That ambiguity absorbed nine dispatches and five wrong
> hypotheses; the full account is in
> [Why this document exists](#why-this-document-exists).
>
> **Verify by measurement, not by looking at the page.** Reading the settings UI
> is what produced five wrong answers — the operator's list of secrets did not
> match what Actions could see, in both directions. Dispatch a monitor and
> confirm it does real work.

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
verification against production.

**The cause: the key was on the Dependabot secrets tab, not the Actions one.**
`Settings → Secrets and variables` keeps three separate stores — **Actions**,
**Dependabot**, **Codespaces**. They are rendered identically, a secret in one
is invisible to the others, and `secrets.<name>` in an Actions job resolves a
Dependabot secret to the empty string **with no error**, indistinguishable from
a name that was never configured at all.

That single ambiguity absorbed nine dispatches and **five** wrong hypotheses:

| # | Hypothesis | Disproved by |
| --- | --- | --- |
| 1 | Stored as a **variable**, not a secret | Moving it to Secrets changed nothing |
| 2 | **Environment** secret, job lacked `environment:` | Ran on a commit carrying the declaration; still empty |
| 3 | Environment name **case** (`production` vs `Production`) | Same; still empty |
| 4 | Wrong **secret name** (`CLERK_SECRET_KEY_PROD`) | Repointed the workflows; still empty |
| 5 | **No GitHub copy existed**; key lived only in Railway | Run 31258941186: a copy existed the whole time, on the wrong tab |

Hypothesis 5 is the one worth dwelling on, because it was written into this
document as settled fact and it was wrong. It *explained every observation* —
production auth worked because Railway had the key, CI saw nothing because CI
had no copy — and it was still false. A theory that accounts for all the
evidence is not thereby true.

### What finally settled it

Run [31258941186](https://github.com/ctol3r/vitalcv/actions/runs/31258941186)
measured every relevant name in one job:

| name | length |
| --- | --- |
| `CRON_SECRET` | 64 |
| `PROBE_URL` | 19 |
| `CLERK_FAPI_URL` | 25 |
| `CLERK_SECRET_KEY_PROD` | 0 |
| `RAILWAY_API_TOKEN` | 0 |
| `DATABASE_URL` | 0 |
| `MONITORING_SECRET` | 0 |
| `ZZ_TEST` (throwaway control) | 0 |

Two facts in that table did the work. `ZZ_TEST` was created by hand minutes
before the run and still read 0 — a brand-new secret with a clean name cannot
have a typo, which killed every naming theory at once. And `PROBE_URL` and
`CLERK_FAPI_URL` resolved despite being **absent from the secrets list the
operator was reading**. Actions could see secrets the operator could not, and
the operator could see secrets Actions could not. That is not one store
disagreeing with itself; it is two stores.

### Lessons

1. **Check which tab the secret is on, first.** Before naming, scope, case, or
   anything else. It is the cheapest check and it was the answer.
2. **An empty secret is indistinguishable from a working one unless something
   asserts otherwise** — which is why both monitors now fail red rather than
   skipping quietly.
3. **Enumerate before theorising.** Every one of the five hypotheses reasoned
   about *where* the secret was; none first established *what Actions could
   read at all*. The measurement that ended it took one job and three seconds.
4. **A theory that explains all the evidence can still be wrong.** Hypothesis 5
   was airtight and false. What separated it from the truth was not more
   reasoning but a control: create a secret whose properties you know for
   certain, and see whether it arrives.
5. **A secret existing in one platform says nothing about another.** Production
   auth worked perfectly throughout, because Railway had the key. That
   working-ness was actively misleading: it made "the key exists" feel
   established, when the only question that mattered was whether *Actions* had
   it.

> Note for whoever hits this next: the warning "on the **Actions** tab (not
> Dependabot)" was already written in Step 2 of this document, as an aside,
> before any of this was diagnosed. It was never tested, because it read like
> boilerplate. If a runbook tells you to check something, check it.
