# TENANT_ORG_BINDING → enforce rollout (gap G1, org context)

`middleware/tenantGuard.ts#bindOrganizationContext` binds organization context to
the caller's **verified membership** instead of to a caller-supplied header.
Staged by `TENANT_ORG_BINDING` (default `off`), mirroring
[`clerk-jwt-enforce-rollout.md`](./clerk-jwt-enforce-rollout.md) and
[`verifier-rbac-rollout.md`](./verifier-rbac-rollout.md).

## What was open

`requireTenantContext` accepted the **presence** of a caller-supplied
organization identifier as authorization rather than binding it to verified
membership. Because the value is caller-supplied, routes not in
`shouldSkipTenantContext` did not distinguish an authorized member from an
anonymous caller. Confirmed live in production **2026-08-08** (status codes
only); [reproduction detail withheld — see internal gap register].

Measured against `origin/main` d52ec533b, 647 route paths classified with the
real `shouldSkipTenantContext`:

| | count |
|---|---|
| Routes behind the guard | **412** |
| …of those, using org as an actual data **scope** | **17** |
| Skip-listed routes that still consume caller-supplied org | 7 |
| Param-free guarded GETs probed | 185 |
| …that did **not** fail closed | **117** |

**The shape that matters:** ~95% of guarded routes never read the org at all.
For them the value was a **turnstile token, not a tenant scope** — so the
exposure was not "one org's data to another org" but "platform-global data to
anyone". The largest single surface was `GET /api/monitoring/events`, since
closed on the operator secret — see its file header.
[Payload characterisation withheld — see internal gap register.]

Routes with a real secondary control held throughout: `/api/internal/*` (403 via
`MONITORING_SECRET`) and the clinician/employer data routes (401 via the #951
verified-session pattern).

## Modes

- **off** — no-op, and costs nothing: no membership lookup, and Prisma is not
  even loaded into the middleware's module graph.
- **shadow** — resolve verified membership, compare to what the caller asserted,
  log `org_binding_shadow` with the outcome enforce *would* produce. Never
  blocks, including on internal error.
- **enforce** — org context comes **only** from verified membership. The
  asserted value is ignored; asserting an org you are not a member of is
  **403**; no verified membership means no org context at all, so org-required
  routes **401**.

Binding happens once on the global mount and writes `organizationId` onto the
request, so every downstream reader — `getRequestOrganizationId`,
`enforceOrganizationMatch`, and the 17 org-scoping routes — inherits verified
data with no per-route refactor. Same mechanism `verifiedIdentity` uses to
rewrite `x-clerk-user-id`.

## Preconditions for enforce (all must hold)

1. **`CLERK_JWT_VERIFICATION` is `shadow` or `enforce`.** Binding reads
   `verifiedAuth.verifiedUserId`, which `verifiedIdentity` only populates in
   those modes. Binding at enforce with JWT verification `off` would resolve no
   membership for anyone and deny every org-scoped request.
   `config/envValidation.ts` makes that combination **fatal at boot** rather
   than at first request.

   As of 2026-08-08 production is **not** at `CLERK_JWT_VERIFICATION=enforce`,
   established by behavioural probe rather than inference — a caller-asserted
   role claim was still observably honoured. [Reproduction detail withheld —
   see internal gap register.] `off` vs `shadow` is not distinguishable from
   outside — read the Railway var.

2. **The web tier stops asserting sentinel org ids.** This is the real blocker
   and it is not an attacker problem — it is ours. The web tier sends hardcoded
   values that can never match a row, because `Organization.id` is a `uuid`
   column:

   | value | where |
   |---|---|
   | `vcv-system` | `app/api/employers/*`, `app/api/health`, `app/api/ingest/stream/[runId]`, `app/api/replay/chain/[npi]`, `lib/platform/deployment-integrity.ts` |
   | `demo-pilot-org-alpha` / `PUBLIC_WEDGE_ORG_ID` | `app/api/identity/[npi]/ingest`, `app/api/ingest/[npi]`, `app/api/trust-state/[npi]` |

   Two of these are **client components** (`components/employer/VerifierPortal.tsx`,
   `components/simulation/SimulationControlPanel.tsx`), so the string ships to
   every browser. `demo-pilot-org-alpha` is an in-memory `DEMO_PILOT_ORGS`
   constant in `app.ts`, not a database row.

   Every one of these call sites will be denied by enforce. They must either
   move to a real verified session or move to routes that need no org context.

3. **Shadow has baked with a clean `org_binding_shadow` stream.**
   `would_deny_unverified` and `would_deny_mismatch` from legitimate traffic
   must trend to ~zero. Each one is a caller that enforce will break.

## Rollout

1. Set `TENANT_ORG_BINDING=shadow` (requires `CLERK_JWT_VERIFICATION` on, per
   precondition 1 — otherwise every request logs `would_deny_unverified` and
   the telemetry is meaningless).
2. Watch `org_binding_shadow` for a full traffic cycle. Outcomes:
   - `would_bind_unasserted` — caller sent no org, has a verified one. Fine.
   - `would_deny_mismatch` — asserted an org they are not in. Investigate every
     one; this is either a sentinel call site (precondition 2) or an attack.
   - `would_deny_unverified` — asserted an org with no verified session. This is
     the bypass shape, and also every unauthenticated web proxy.
3. Fix call sites until the deny outcomes are ~zero from real traffic.
4. Set `TENANT_ORG_BINDING=enforce`.

**Rollback** is instant: set the var back to `shadow` or `off`. No data
migration, no code deploy.

## What this does NOT close

Binding fixes org **scope**. It does not authenticate the ~395 guarded routes
that never read org — those were reachable because the guard was the only thing
in front of them, and they need a per-route disposition (public / operator /
authenticated). `/api/monitoring/events` is the first of these to be closed;
the rest remain open and are the larger disclosure.

**Residual while `CLERK_JWT_VERIFICATION` is only `shadow`.** Role-bypass
headers are stripped from unverified requests only at JWT `enforce`. So with
`TENANT_ORG_BINDING=enforce` + `CLERK_JWT_VERIFICATION=shadow`, a caller sending
`x-user-role: super-admin` still short-circuits `enforceOrganizationMatch`.
Binding itself holds — it never consults roles, so an anonymous caller still
gets no org context and still 401s. The residual is narrower: a *verified*
member of org A can reach org B's records through `enforceOrganizationMatch` by
claiming super-admin. Closing it is G1's job, not this flag's. Prefer flipping
`CLERK_JWT_VERIFICATION=enforce` first.

It also does not touch the web-origin proxies. PR #1210 machine-authenticated
four `/api/internal/*` proxies on the web side — necessary but not sufficient,
since the API origin is directly reachable and a web-tier guard does not bind
the backend route behind it. [Route list withheld — see internal gap register.]

## Tests

`src/middleware/__tests__/orgBinding.test.ts` asserts outcomes, not mechanism,
and includes bypass-injection cases that reconstruct the production request.
Verified red on injection: removing the enforce fallback guard in
`getRequestOrganizationId` fails 5 cases; removing the mismatch refusal fails 1.
`src/routes/__tests__/monitoringEventsAuth.test.ts` covers the route gate (4 of
5 fail with the guard removed).
