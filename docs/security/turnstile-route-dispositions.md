# Turnstile route dispositions (gap G1, second half)

The G1 report was about org **scope**: `x-org-id` was caller-supplied, so a
route that scoped a query by it could be pointed at another tenant. That is real
and is fixed by `TENANT_ORG_BINDING`
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

*Validation* helpers (`requireBodyField`, `requireParam`, `requireUuid`) are
deliberately **not** in the vocabulary: they answer "is this well-formed?",
never "may this caller do it?".

Correcting both brought the mutation register from a claimed 129 to **111**.

## Counts (origin/main, 2026-08-08)

| | |
|---|---|
| Route paths total | 647 |
| Behind the tenant guard | 412 |
| …using org as an actual data **scope** | 17 |
| Param-free guarded GETs returning **200** to one bogus header | 117 (1.9 MB) |
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

Every one of those was an **orphan** — no caller anywhere in the repo — which is
what made operator-secret safe. That property is the reason the batches were
safe, and it runs out here.

## The credentials family — why it could not be closed the same way

13 unguarded mutations, **11 with live callers**. This family needs product
decisions, not a guard.

| route | callers | disposition | blocked on |
|---|---|---|---|
| `POST /api/credentials/ingest` | web onboarding proxy, `EvidenceUploadPanel`, `CredentialReview`, `OnboardingFlowSteps` | **public** (probably) | `/onboarding` is public end-to-end — an "anonymous NPI preview". An identity gate here breaks clinician activation. Needs rate limiting / NPI-scoping instead. |
| `POST /api/credentials/ingest-npi` | same | **public** (probably) | same |
| `POST /api/credentials/present` | wallet-sdk, verifier-sdk, `CredentialPresentationActions` | identity | G1 + ownership on the subject |
| `POST /api/credentials/present/selective` | wallet-sdk, verifier-sdk, `SelectiveDisclosureModal` | identity | same |
| `DELETE /api/credentials/wallet/:credentialId` | wallet-sdk, `credential-wallet-paths.ts` | identity | same — destructive |
| `DELETE /api/credentials/:id` | `credential-wallet-paths.ts` | identity | same — destructive |
| `PATCH /api/credentials/:id/confirm` | — | identity | same |
| `POST /api/credentials/issue` | issuer-sdk, e2e | machine | `apiKeyAuth`; confirm every issuer integration sends a key |
| `POST /api/credentials/verify` | verifier-sdk, e2e | machine | verifier-sdk sends `X-API-Key` only when configured |
| `POST /api/credentials/verify/presentation` | — | machine | same |
| `POST /api/credentials/accept` | verifier-sdk, e2e | machine | same |

`routes/credentials.ts` contains **no identity signal at all** — no
`clerkUserId`, no ownership check anywhere in the file. It is already on the
header-trust baseline, so it *may* read `x-clerk-user-id` when the identity work
lands; nothing has to be added to the baseline.

## Remaining register

~98 unguarded mutations after batch 4. Largest families:

| family | count | likely disposition |
|---|---|---|
| `credentials` | 11 | identity / machine — see above |
| `trust` | 6 | operator |
| `referrals` | 5 | identity |
| `network` | 5 | operator |
| `simulation` | 4 | operator |
| `oid4vci` | 4 | machine (OID4VCI is a spec'd flow — check the spec before gating) |
| `decisions` | 4 | identity |
| `actions` | 4 | identity |

Reads: ~90 anonymously-reachable remain. Some are **public and should be
allowlisted rather than gated**:

- `/api/crypto/keys` — issuer public keys, documented in `packages/verifier-sdk`
  as an external fetch target. Publishing them is the point.
- `/api/crypto/suites`, `/api/protocol/*`, `/api/schemas`, `/api/docs/endpoints`
  — protocol/API transparency.
- `/api/security/posture` — advertised on a marketing endpoint directory. Worth
  a second look: "security toggle and enforcement posture" tells an attacker
  which controls are on.

## Rules learned

- **Caller analysis decides safety, and a literal grep is not caller analysis.**
  Exclude paths under a web catch-all proxy
  (`app/api/{predictions,polling,investigators,graph-engine,actions,storylines,system-health,findings}/[...path]`)
  and template-literal construction; then check non-web callers (SDKs, scripts,
  e2e) before calling anything an orphan.
- **Unguarded is not the same as exploitable.** `/api/api-keys` had no
  authorization at all but could not execute — `apiKeyService` targets
  `subscriptionApiKey` with the *`ApiKey`* model's fields. Guard it anyway:
  repairing that drift would land on an open door.
- **For write routes, assert the writing service was never invoked.** A 403
  returned after the service already ran still means the write happened.
- **Never probe writes against production.** A reachability probe on
  `batch-resign` means re-signing a real clinician's artifacts.
- **The anonymous-only test case is theatre.** Without `x-org-id` the tenant
  guard 401s first, so an anonymous-only assertion passes even with the route's
  guard removed. The `x-org-id` case carries the proof.
