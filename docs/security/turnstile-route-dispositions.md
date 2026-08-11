# Turnstile route dispositions (gap G1, second half)

> **Redaction note.** This file is a live remediation register for a control
> that is not yet enforcing, published in a public repository. Specific
> route-level targets, per-route reachability findings, and the request shapes
> that reach them have been withheld. Method, counts, dispositions, closed
> batches and rules-learned are kept, because those are the record and the
> record has value. See the internal gap register for the withheld detail.

The G1 report was about org **scope**: the organization identifier was
caller-supplied, so a route that scoped a query by it could be pointed at
another tenant. That is real and is fixed by `TENANT_ORG_BINDING`
([tenant-org-binding.md](./tenant-org-binding.md)).

It was also the smaller half. Most routes behind `requireTenantContext` never
read the org at all — for them the header was a **turnstile token**, not a
scope, and the payload is platform-global. Closing those is not a middleware
change; it is a per-route disposition. This file is the register.

## Method

Route paths are classified with the real `shouldSkipTenantContext`, not a
re-implementation. Mutations are detected by scanning each registration's
middleware chain **and** handler body for an authorization vocabulary.

Two false-positive classes cost a correction on the first pass, and any future
sweep must handle both:

1. **Locally-named guards** — `requireMonitoringSecret`, `requireAdminRequest`,
   `requireClerkUserId`, `requireVerifiedUserId` and friends. Grepping only for
   the shared names over-reports.
2. **Named handlers** — `app.post('/api/internal/run-monitoring', runMonitoringNow)`
   is fully guarded *inside* `runMonitoringNow`. A scanner that only reads from
   the registration line to the next one sees an empty body and calls it open.
3. **Inline identity reads** — a route may read the identity header directly and
   401 without it, with no named helper for a scanner to match on. Found the
   hard way: batch 5 operator-gated one such route, and its existing suite caught
   the 401→403 regression. Because that route records the actor, it is an
   **identity** surface — an operator secret is the wrong control there even
   though the header is not yet a real boundary. [Route withheld — see internal
   gap register.]

*Validation* helpers (`requireBodyField`, `requireParam`, `requireUuid`) are
deliberately **not** in the vocabulary: they answer "is this well-formed?",
never "may this caller do it?".

Correcting the first two brought the mutation register from a claimed 129 to
**111**. The third class means 111 is still an upper bound, not a count of
genuinely open routes — treat every entry as a candidate to verify, not a
verdict.

## Counts (origin/main, 2026-08-08)

| | |
|---|---|
| Route paths total | 647 |
| Behind the tenant guard | 412 |
| …using org as an actual data **scope** | 17 |
| Param-free guarded GETs that did **not** fail closed | 117 |
| **Mutations** behind the guard with no other authorization | **111** |

## Disposition vocabulary

- **public** — intentionally unauthenticated. Belongs in
  `shouldSkipTenantContext`, not behind a guard. Being *reachable* is the point.
- **operator** — machine/ops surface. `requireInternalSecret`
  (`x-monitoring-secret`), fail-closed when unconfigured.
- **identity** — clinician- or employer-owned. Needs a verified session **plus
  an ownership check**. Depends on `CLERK_JWT_VERIFICATION` being on: `verifiedAuth`
  is undefined at `off`, so an identity gate today denies everyone.
- **machine** — issuer/verifier integrations. `x-api-key` via `apiKeyAuth`.

## Closed so far

| batch | routes | disposition |
|---|---|---|
| #1219 | `/api/monitoring/events` | operator |
| #1223 b1 | `/api/index/{clinicians,stats}`, `/api/influence/providers`, `/api/internal/{funnel-report,verifier-funnel}` | operator |
| #1223 b2 | `/api/mission-ops/*` (7), `/api/api-keys` (3), `/api/analytics/*` (5), `/api/learning/*` (6) | operator |
| #1223 b3 | `/api/crypto/{sign,resign,batch-resign}` (5), `/api/did/*` (3), `/api/coordination/*` (3) | operator |
| #1223 b4 | `/api/credentials/export/wallet`, `/api/credentials/sd-jwt/issue` | operator |
| #1223 b5 | `/api/network/{federate,peers/:id/status,federation/validate,issuer/register}` (4), `/api/trust/{events/batch,monitoring/cycle}` (2) | operator |
| #1223 b6 | `/api/simulation/*` (4), `/api/trust/events`, `/api/network/federation/discover` | operator |

Every one of those was an **orphan** — no caller anywhere in the repo — which is
what made operator-secret safe. That property is the reason the batches were
safe, and it runs out here.

## The credentials family — why it could not be closed the same way

13 unguarded mutations, **11 with live callers**. This family needs product
decisions, not a guard.

**[Per-route table withheld — see internal gap register.]** The dispositions
break down as: 2 probably **public** (they sit on the anonymous onboarding
preview, so an identity gate there breaks clinician activation — the answer is
rate limiting and subject-scoping, not a session), 5 **identity** (needs G1 plus
an ownership check on the subject; two of those are destructive), and 4
**machine** (`apiKeyAuth`, gated on confirming every SDK integration actually
sends a key).

`routes/credentials.ts` contains **no identity signal at all** — no ownership
check anywhere in the file. It is already on the header-trust baseline, so it
*may* read the identity header when the identity work lands; nothing has to be
added to the baseline.

## Proxy-fronted routes: "forward the secret" is not the default answer

Batch 2 fixed `app/api/internal/{source-health,mission-ops/sources}` to forward
`MONITORING_SECRET` to the backend. That was right **only because #1210 had
already machine-authenticated those two proxies**. The general rule is:

> A proxy may forward the operator secret only if it authenticates its own
> caller. An unauthenticated proxy that holds the secret **launders** it — it
> hands operator access to anyone who can reach the web origin.

Batch 6 hit the other case. Three web proxies had **no auth of their own**, and
their UI is dead (`LiveSimulationPanel`, `SimulationControlPanel`, `DebugPanel`
are imported by no page). So the backend was gated and the proxies simply 403 —
no laundering, nothing broken.

### Still deferred

**[Route/proxy pair withheld — see internal gap register.]** One backend
mutation is fronted by a genuinely live proxy — reached by a command surface
mounted on every page, so gating the backend without a disposition would break
signed-in navigation. Disposition **identity**, blocked on
`CLERK_JWT_VERIFICATION`.

Note the asymmetry that made batch 5 safe: every *component* caller in these
families (`FederationHealthPanel`, `IssuerOnboardingPanel`,
`MonitoringStatusPanel`, `LiveSimulationPanel`, `SimulationControlPanel`,
`DebugPanel`) is imported by **no page** — same as `EventFeed` in batch 1. A
component caller is not evidence of a live consumer; a proxy route is, because
it is reachable on the web origin whether or not the UI calls it.

## Remaining register

~84 unguarded mutations after batch 6, spread across roughly eight route
families. The largest is `credentials` (11, above); the remainder are mostly
**operator** dispositions with a smaller **identity** tail and one **machine**
family that implements a specified protocol flow (check the spec before gating
it). **[Per-family breakdown withheld — see internal gap register.]**

Reads: ~90 anonymously-reachable remain. Some are **public and should be
allowlisted rather than gated** — issuer public keys are documented in
`packages/verifier-sdk` as an external fetch target, and the protocol/schema/API
transparency surfaces are meant to be readable. One read is worth a second look
rather than an allowlist: an endpoint that reports **security toggle and
enforcement posture** tells a caller which controls are on. **[Route names
withheld — see internal gap register.]**

## Rules learned

- **Caller analysis decides safety, and a literal grep is not caller analysis.**
  Exclude paths under a web catch-all proxy
  (`app/api/{predictions,polling,investigators,graph-engine,actions,storylines,system-health,findings}/[...path]`)
  and template-literal construction; then check non-web callers (SDKs, scripts,
  e2e) before calling anything an orphan.
- **Unguarded is not the same as exploitable.** One family had no authorization
  at all but could not execute, because its service layer queried one model with
  another model's fields. Guard it anyway: repairing that drift would land on an
  open door.
- **For write routes, assert the writing service was never invoked.** A 403
  returned after the service already ran still means the write happened.
- **Never probe writes against production.** A reachability probe on a
  re-signing route means re-signing a real clinician's artifacts.
- **The anonymous-only test case is theatre.** A wholly anonymous request is
  refused by the tenant guard before the route's own guard runs, so an
  anonymous-only assertion passes even with that guard removed. The proof case
  is the one that satisfies the turnstile and *then* asserts refusal.
