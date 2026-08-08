# Clerk key rotation — the sequence for the 2026-08 rotation

Concrete ordering for this specific rotation, against the general procedure in
[`clerk-secret-key-rotation.md`](clerk-secret-key-rotation.md). Where the two
differ this document is the more specific one and wins; where it is silent,
follow the runbook.

**This document is disposable.** Delete it once the rotation is done and the
GitHub fault below is closed. If you are reading it long after 2026-08, check
whether it still describes reality before trusting it.

> **This is a human credential action.** Every step involves handling a live
> `sk_live_` backend key. Do not delegate any of it to an agent.

---

## ⚠ Open GitHub fault — read this before moving any secret

**As of 2026-08-08, secrets in this repository do not reach Actions jobs
regardless of where they are placed.** A GitHub support ticket is open.

This matters because the surrounding documentation and the monitors'
`MISCONFIGURED` output tell you to check which tab the secret is on. That advice
is correct in general — a Dependabot secret really is invisible to Actions, and
that really was the original cause — but it is **insufficient right now**.
Following it today produces no change, which looks like the advice failing and
invites another round of moving things about.

The evidence:

| secret | created | resolved length |
| --- | --- | --- |
| `CRON_SECRET` | pre-2026-08-08 | 64 |
| `PROBE_URL` | pre-2026-08-08 | 19 |
| `CLERK_FAPI_URL` | pre-2026-08-08 | 25 |
| `CLERK_SECRET_KEY_PROD` | 2026-08-08 | 0 |
| `RAILWAY_API_TOKEN` | 2026-08-08 | 0 |
| `DATABASE_URL` | 2026-08-08 | 0 |
| `MONITORING_SECRET` | 2026-08-08 | 0 |
| `PROBE_CANARY` | 2026-08-08, value `hello` | 0 |

`PROBE_CANARY` is the control: created by hand under *Repository secrets* on the
**Actions** tab with a known five-character value, minutes before the run that
read it (job `93113536112`). It reads 0, and it remains listed in repository
settings after a hard reload — so the write persists server-side but does not
reach the Actions runtime.

**To check whether it is fixed:** dispatch the secret visibility probe and see
whether `PROBE_CANARY` reads **5**. If it still reads 0, the fault is open
regardless of what anyone has said, and no amount of moving secrets will help.

**Both monitors stay RED while this is open, and that is correct.** They cannot
do their work and are refusing to claim otherwise.

---

## Does this fault block the rotation? No.

It looks like it should, so it is worth being explicit.

Two of the four consumers are GitHub Actions secrets, and those secrets do not
currently reach jobs. But those two consumers **are already non-functional** —
both monitors are red and neither has ever run. Rotating cannot degrade them,
because there is nothing left to degrade.

What actually matters is that revoking the old key must not orphan a live
holder. After this sequence there are none: Railway web and API hold the new
key, and the GitHub copy holds it too — invisible to jobs today, correct the
moment propagation is fixed.

**So: proceed. Do not wait for GitHub.**

---

## Should you rotate at all?

The case rests on one thing: the key was reported to be stored as an Actions
**variable** at one point. Variables are unmasked in logs and readable in the
UI, so a key that lived there should be replaced rather than merely moved.

The caveat, stated plainly: that report came from reading the settings UI during
the same period in which UI-reading produced five wrong conclusions, and what
was eventually found was a Dependabot **secret** — masked and write-only, which
is *not* an exposure. Whether the variable episode was real, or another misread
of the same page, is not established.

What is established:

- No agent ever handled the value. Every probe printed `${#VAR}` character
  lengths, never content, verified by grep against every version of the
  workflow.
- No job log contains it.
- A Dependabot secret being visible to Dependabot is not, by itself, an
  exposure worth a rotation.

So steps 1–5 are a genuinely marginal call. **Step 0 is not** — it is
independent of all of this, it is the only step with user-visible blast radius,
and doing it makes every future rotation cheap.

---

## Step 0 — decouple cookie signing

**Do this first and on its own, whatever you decide about the rest.**

`apps/web/lib/auth/roleCookie.ts` signs the role cookie with
`ROLE_COOKIE_SECRET || CLERK_SECRET_KEY || ''`. While the override is unset the
role cookie is HMAC'd with the Clerk key, so rotating that key invalidates every
outstanding role cookie at once and signed-in users lose their resolved role
until it re-mints. Nothing in the Clerk dashboard hints at this.

**Check first:**

```bash
curl -s https://vitalcv.com/api/health/auth | jq '{runtimeRoleCookieSecret, roleCookieSignedWithClerkKey}'
```

| reading | meaning |
| --- | --- |
| `roleCookieSignedWithClerkKey: true` | Step 0 applies. Do it. |
| `false` | Signing is already independent; skip to step 1. |
| fields absent | You are on a deployment older than PR #1188. Infer **nothing** from their absence — read the web service env in Railway instead. |

Repo evidence says it will be `true`: `ROLE_COOKIE_SECRET` has no entry in
[`railway-env.md`](railway-env.md), no row in `apps/web/DEPLOY.md`, and is
referenced only by `roleCookie.ts` and its tests.

**To do it:**

1. `openssl rand -hex 32`
2. Set `ROLE_COOKIE_SECRET` to that value on the Railway **web** service.
3. Redeploy web.
4. Confirm a signed-in session still resolves its role (load a `/holder` surface).
5. Re-run the curl and confirm `roleCookieSignedWithClerkKey: false`.

This step is *itself* cookie-invalidating — signing moves from the Clerk key to
the new value — so expect one role re-mint here. That is the point: it spends
the invalidation now, deliberately, rather than during the rotation.

---

## Step 1 — mint the new key

Clerk dashboard → new **backend** API key. **Do not revoke the old one yet.**

Minting first is deliberate. The GitHub copy has to be re-entered regardless,
and putting the *old* value there only to replace it later would place a key you
intend to retire into one more location for no benefit. One credential, entered
once, everywhere.

---

## Step 2 — update every consumer before revoking anything

| # | Where | Name |
| --- | --- | --- |
| 1 | Railway **web** service | `CLERK_SECRET_KEY` |
| 2 | Railway **API** service | `CLERK_SECRET_KEY` |
| 3 | <https://github.com/ctol3r/vitalcv/settings/secrets/actions> → *Repository secrets* | `CLERK_SECRET_KEY_PROD` |

Redeploy both Railway services after setting theirs.

The name difference is deliberate: the workflows map `CLERK_SECRET_KEY_PROD`
onto the `CLERK_SECRET_KEY` env var the scripts read. `_PROD` mirrors the
Railway variable and separates it from the `sk_test_` key CI E2E uses.

**Set #3 even though it will not work yet.** The write persists server-side, so
the correct value will be in place the moment GitHub fixes propagation.

**Do not touch `E2E_CLERK_SECRET_KEY`.** Separate `sk_test_` key, CI-only,
different blast radius. Rotating it breaks CI for no benefit.

---

## Step 3 — verify each consumer independently

Do not infer one from another. That inference is what produced hypothesis 5.

- **Web** — sign in and reach a `/holder` surface.
- **API** — no `auth degraded` warnings in the Railway API service logs.
- **CI** — **deferred.** It cannot pass while the propagation fault is open, and
  its failure carries no information about the rotation. Do not read red
  monitors as a rotation problem right now.

---

## Step 4 — revoke the old key

Only after web and API are both updated **and** verified above.

Safe with CI unverified: the GitHub copy holds the new value, so revoking the
old one cannot break it further than it already is.

Revoking before verification turns a routine rotation into an outage.

---

## Step 5 — confirm the blast radius

- Sessions work and roles resolve (re-minted if step 0 applied).
- Railway web and API hold the key under the name their runtime reads.
- No stray unsuffixed `CLERK_SECRET_KEY` in Actions **Variables**, on any
  environment, or on the Dependabot or Codespaces tabs.
- `curl -s https://vitalcv.com/api/health/auth | jq` returns `status: "ok"`.

---

## Deferred until the GitHub fault is resolved

Confirm propagation is fixed first — dispatch the secret visibility probe and
check that `PROBE_CANARY` reads **5**. Then:

```bash
# Reconcile must RUN, not skip. First time the sweep will ever contact Clerk.
gh workflow run synthetic-reconcile.yml --ref main -f dry_run=true

# release-verified must report a real verdict, not MISCONFIGURED.
gh workflow run release-verify.yml --ref main
```

`release-verify` has never executed a signed-in verification against production.
Its first genuine run is the real end of this piece of work.

---

## Rollback

Before step 4: restore the previous value in whichever consumer changed, and
redeploy. After step 4: no un-revoke exists — mint another key and repeat
steps 2–3.

Step 0 rolls back by removing `ROLE_COOKIE_SECRET` and redeploying, at the cost
of another cookie invalidation. There is little reason to; it is strictly the
safer configuration.
