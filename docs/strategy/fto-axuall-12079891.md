# Freedom-to-operate note — Axuall US 12,079,891

**Date:** 2026-08-11
**Status:** RESEARCH NOTE — not legal advice, and not a freedom-to-operate opinion
**Owner of the legal question:** outside counsel. This file exists to give them a scoped
question and to constrain the acceptance-intelligence design before it is written.

---

## The patent

| | |
|---|---|
| Number | **US 12,079,891 B2** |
| Title | Systems and methods for verifying and managing digital credentials |
| Assignee | **Axuall Inc** |
| Inventors | Charles Lougheed III, Lakshman Tavag, Jeffrey Stern |
| Application | 16/735,241 (pre-grant pub. US 2020/0220726 A1) |
| Priority | **2019-01-04** · Filed 2020-01-06 · Granted 2024-09-03 |
| Size | **13 claims, two independent** — claim 1 (method), claim 6 (system) |
| Family | No continuations or other members visible on Google Patents. **Caveat:** applications publish 18 months after filing, so a continuation filed shortly before the Sept-2024 grant would not be indexed yet. Counsel should check Patent Center directly. |

Claim 6 is claim 1's steps wrapped in an "administrator device providing a subscriber agent to a
subscriber device" architecture — narrower, and VitalCV has no agent-provisioning architecture of
that shape.

## What claim 1 requires

A patent claim is conjunctive: infringement needs **every** element.

1. selecting a credential schema **stored on a verifiable data registry**
2. configuring **at least one rule** on the required attributes
3. defining a **configurable requisite collection** from schema + rule
4. generating a **presentation request** for that collection
5. transmitting it **to a holder**
6. receiving a **collection proposal from the holder** containing digital credentials
7. determining satisfaction by comparing the collection to the holder's credentials
8. analyzing a cryptographic proof of **validity, non-revocation, and ownership**
9. verifying all three against that proof and the registry, using a public verification key and
   a private signing key

## As-built overlap — read this before assuming there is none

An earlier pass of this analysis concluded the presentation flow lived only in the undeployed
`apps/verifier-api`. **That was wrong**, and the error is worth recording: the check was a grep
for `app.post('/api/...presentation...')`, which misses routes registered through a router module.

The **deployed** backend (`apps/api/backend`, which ships under the root `railway.toml`) contains
a working OpenID4VP presentation layer, mounted at `app.ts:3656` via `registerOID4VPRoutes(app)`:

| Claim element | Where it appears |
|---|---|
| rules on required attributes | `services/oid4vp/presentationServer.ts` — `InputDescriptor.constraints.fields[]` with JSONPath `path` and a `filter` carrying `pattern` / `const` / `enum` |
| requisite collection | `PresentationDefinition { input_descriptors[] }`; `buildMedicalCredentialDefinition()` composes a licence + NPI set, `purpose: 'Verify clinician credentials for privileging'` |
| presentation request → holder | `POST /api/oid4vp/request`, `GET /api/oid4vp/request/:id` |
| proposal from holder | `POST /api/oid4vp/response/:id` — `vp_token` + `presentation_submission`, with `definition_id` matched against the request |
| validity / non-revocation / ownership | `services/credentials/credentialVerifier.ts` — ES256 `jwtVerify` bound to `credential.subject`, issuer trust via registry, and `isRevoked()` from the revocation registry |
| public/private keypair | `importSPKI` + `jwtVerify`; `/.well-known/jwks.json`, `did.json`, `trust-register` |

That is a closer read on most elements than is comfortable.

### What materially cuts the other way

- **Nothing in the product calls it.** The only web caller of `/api/oid4vp/request` is
  `components/verifier/AcceptancePanel.tsx`, which **is imported by no page** — the
  `AcceptancePanel` rendered on `/verify/[npi]` is a different function defined locally in that
  file. `packages/wallet-sdk` calls `/api/oid4vp/present`, which is not among the registered
  routes. `buildMedicalCredentialDefinition()` is labelled a sample and has **zero callers**.
- **A method claim is infringed by performing the steps.** A mounted route that no product surface
  exercises does not perform them — though the endpoints are reachable, so a third party could.
  Counsel's call, not ours.
- **Element 1 may not be met.** The definitions are composed in TypeScript, not "selected from a
  credential schema stored on a verifiable data registry." That is exactly the kind of limitation
  claim construction turns on.
- **No production credentials exist.** `docs/gtm/30-day-psv-readiness-pilot.md`: *"we do not issue
  production DIDs or Verifiable Credentials (the trust container operates in Mock/Dev mode)."*

### Separate finding, security not patent

The five `/api/oid4vp/*` routes carry no visible auth middleware — no `requireUserId`, no rate
limit, no policy enforcer. That belongs to the `web /api is the unswept authz surface` register and
should be triaged on its own merits regardless of anything here.

## The cheapest action available

**The OID4VP layer is unexercised.** If a holder-presents-credentials architecture is not on the
roadmap, deleting it — or gating it behind a flag that is off — removes the patent question, closes
five unauthenticated endpoints, and costs nothing, because no product surface depends on it. That
is a stronger position than any argument about claim construction, and it is available today.

If it *is* on the roadmap, it needs an FTO opinion first.

## Design constraint on the acceptance layer

"Acceptance intelligence" — what employers accept, for which roles, under which conditions — is
the declared moat and is conceptually adjacent to a "configurable requisite collection." Until
counsel says otherwise, build it so the claim does not read on it:

- **Evaluate employer requirements server-side against VitalCV-held source reads** (NPPES, OIG,
  PECOS) rather than by requesting a presentation from the clinician. This drops elements 4–7.
- **Do not source the requirement set from a schema on a verifiable data registry** (element 1).
- **Do not make the clinician a credential-presenting holder in the loop.** Elements 5 and 6 both
  require the holder to receive a request and return a proposal.
- Verification by reading the source of truth is what VitalCV already does, is what the truth
  contract already describes, and is the actual differentiator. The design-around and the
  product's stated position are the same thing.

## The question for counsel

Scoped, so it is cheap to answer:

1. Does US 12,079,891 claim 1 or 6 read on `apps/api/backend/src/{routes/oid4vp.ts,
   services/oid4vp/presentationServer.ts, services/credentials/credentialVerifier.ts}` as mounted
   today, given that no product surface invokes them?
2. Does the "credential schema stored on a verifiable data registry" limitation exclude
   definitions composed in application code?
3. Is the design constraint above sufficient to keep the acceptance layer clear?
4. Validity, if it comes to that: the proof-request → presentation → verify-against-ledger-with-
   revocation-registry pattern was in Hyperledger Indy / Sovrin by 2017–2018 and in DIF
   Presentation Exchange work, all before the 2019-01-04 priority date. Worth a prior-art look.

## Related

`docs/strategy/name-clearance-2026-08-10.md` (the other IP question, same week).
Tripwire: `apps/web/__tests__/presentation-exchange-baseline.test.ts` fails when a deployed tree
gains a new presentation-exchange surface, and points here.
