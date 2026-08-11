# Production JWT enforcement, `X-Powered-By`, and the nonce-CSP path

Owner: platform security · Probed 2026-08-02 against `api.vitalcv.com` and
`vitalcv.com` (commit `af5713e5f`).

## 1. Production JWT enforcement — **NOT enforcing** (measured, not assumed)

`CLERK_JWT_VERIFICATION` has three modes (`off` / `shadow` / `enforce`, see
[`verifiedIdentity.ts`](../../apps/api/backend/src/middleware/verifiedIdentity.ts)).
Under `enforce`, an identity header **without** a valid bearer token is a 401,
fail-closed, and the role-bypass headers are stripped.

Production does not do that. A behavioural probe against an identity-bearing
read established it. **[Probe command and response withheld — see internal gap
register.]**

The shape of the finding, without the recipe: the response was **not** a refusal.
It was a downstream not-found whose message referred to the *authenticated* user
— meaning the asserted identity was accepted and used for a database lookup. The
request got past the identity layer and failed only because that particular id
matched no row. An id belonging to a real user would have resolved.

So `CLERK_JWT_VERIFICATION` is `off` or `shadow` in production, and the G1
header-trust gap (ASVS 14.5.4) is **open**. The trust boundary is the API
origin, and the API origin is directly addressable.

### Why this is not fixed in this PR

The flip is an environment change on Railway (`CLERK_JWT_VERIFICATION=enforce`
plus a correct `CLERK_ISSUER`), not a code change — the middleware is already
written, mounted, and correct. Flipping it from here would be an unreviewable
production auth change made blind: the shadow-mode logs are the instrument that
tells you *which web call sites still don't forward a bearer token*, and every
one of those becomes a 401 the moment enforce is on.

**The sequence, in order:**

1. **Confirm the mode.** Read `CLERK_JWT_VERIFICATION` and `CLERK_ISSUER` on the
   Railway API service. If it is `off`, set `shadow` first — `off` measures
   nothing, and going straight from `off` to `enforce` is how you find the
   unforwarded call sites in production instead of in a log.
2. **Read the shadow outcomes** before flipping. The middleware logs one of
   `anonymous` / `header_without_token` / `verified_match` / `verified_mismatch`
   / `token_only` / `invalid_token`. The gate to flip is: **zero
   `header_without_token` from legitimate web traffic** over a full traffic
   cycle. Any that remain are call sites that will 401 on enforce.
   `verified_mismatch` is the forgery signal and should be zero.
3. **Flip to `enforce`,** then re-run the probe. The expected result is a
   **401**, and that assertion belongs in the deploy smoke so it cannot regress
   silently.

Until step 3 lands, treat every identity-header-trusting route as reachable by
anyone who can address the API origin.

### One observation this probe surfaced — RESOLVED 2026-08-03 (see status note)

One read surface returned **HTTP 200 with clinician PII** — names, NPIs, and
internal user ids — to a request that asserted identity and an elevated role
without a session. **[Route and request shape withheld — see internal gap
register.]** Whether that route is *intended* to be public was not established
here (the follow-up probe that would have distinguished "public by design" from
"header-gated and bypassed" was not run). Both readings need action:

- if it is **header-gated**, this is a live PII exposure and enforce-mode is
  urgent;
- if it is **public by design**, a public endpoint listing clinician names and
  NPIs is a product/privacy decision that should be explicit and documented,
  not incidental.

Resolve this before the enforce flip, since the flip changes the answer.

**Status note — RESOLVED 2026-08-03, one day after this record.** The surface was
**removed, not guarded**, and the removal is live on `main`. Guarding it would have
been the wrong fix: the available helper asserts only that an *unsigned* identity
header is **present**, so adding it would have converted an anonymous read into a
forged-header read.

Verified on `origin/main` 2026-08-10, by code rather than by probe:
- no handler file remains, and nothing registers the route;
- the containment commit is an ancestor of `origin/main`;
- a regression guard pins it removed and asserts **404, not 401** — deliberately
  sending the headers a caller would forge, so a pass means "no such route"
  rather than "the guard held".

Residue, harmless but worth a sweep: the removed path is still listed in the tenant
guard's skip-list, an orphaned entry for a route that no longer exists.

**The lesson is the stale doc, not the finding.** This section read as an open P0
for eight days after it was closed, and cost a re-investigation on 2026-08-10 to
establish that nothing was wrong. When a finding closes, update the record that
carries it — a security document that outlives its finding manufactures false
alarms, which is the same failure mode as an audit that goes stale within days.

## 2. `X-Powered-By` — removed in this PR

Production served `x-powered-by: Next.js` on every response
(`curl -I https://vitalcv.com/`). It names the framework — and with it the CVE
list worth trying — and buys nothing.

Fixed with `poweredByHeader: false` in
[`next.config.mjs`](../../apps/web/next.config.mjs). It **cannot** be fixed in
the `headers()` block: that only *adds* headers and cannot delete one Next sets
itself. The regression test asserts the resolved config value, not an absence
in `securityHeaders` — the header was never going to appear in that list, so a
guard looking there would pass forever while the header shipped on every
response. Proven by reverting the config line: the new assertion fails.

Note the API origin (`api.vitalcv.com`) sends **no** `x-powered-by` — Helmet
already removes it there. This was a web-tier-only gap.

## 3. Nonce CSP — the plan, and why it is a plan

Current `script-src` carries both `'unsafe-inline'` and `'unsafe-eval'`
([`security-headers.mjs`](../../apps/web/security-headers.mjs)), which is most
of what a CSP is for. Replacing them with per-request nonces is real work with
real breakage, so it is scoped here rather than half-done:

| Step | Work | Risk it retires |
|---|---|---|
| N1 | Generate a per-request nonce in `middleware.ts`, expose it via a request header, and emit the CSP **from middleware** rather than `next.config.mjs` — a static config cannot carry a per-request value. | none yet (plumbing) |
| N2 | Ship `Content-Security-Policy-Report-Only` with the nonce-based `script-src` alongside the enforcing legacy CSP, plus a report endpoint. | none — this is the measurement step |
| N3 | Burn down report-only violations: Next's RSC inline bootstrap, Clerk's runtime, Stripe, Turnstile, PostHog. Each either accepts a nonce, needs a hash, or blocks the migration. | — |
| N4 | Drop `'unsafe-inline'` from `script-src` once N3 is empty. Keep `'unsafe-eval'` until measured separately; they are not one switch. | inline-script XSS |
| N5 | `style-src` nonces last — Next inlines critical CSS, and this is the most likely to break rendering for the least gain. | inline-style injection |

**Regression coverage to write with N1, not after:**

- The nonce must be **per-response and unpredictable**: assert two responses
  carry different nonces, and that the value is ≥128 bits of base64. A constant
  nonce is strictly worse than `'unsafe-inline'` — it looks like a control and
  is not one.
- Every `<script>` the app emits must carry the current nonce: assert against a
  **rendered response**, not the middleware in isolation.
- The report-only header must not silently vanish during N2–N3 (a missing
  report-only header reads exactly like zero violations).
- At N4, an assertion that `script-src` no longer contains `'unsafe-inline'`,
  and a live-response check in the deploy smoke.

**Do not** start at N4. Dropping `'unsafe-inline'` without the N2 measurement
breaks Clerk's runtime, and sign-in failures are the most expensive possible
way to discover a CSP directive was needed.
