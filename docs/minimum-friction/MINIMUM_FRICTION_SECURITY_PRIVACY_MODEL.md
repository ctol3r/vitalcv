# Minimum Friction — Security & Privacy Model

**Program:** Minimum Friction (MF-WAVE-00, research/architecture only)
**Baseline:** `origin/main` @ `df0ff184c2da9fbc8cfaf73f26e1928188113e61` (2026-08-16)
**Status:** Research deliverable. No runtime, schema, or policy change is proposed here.
**Scope note:** This document is documentation only. It describes designs and records
findings; it does **not** implement enforcement. The one exception in urgency is
§1 (share-path audit), which is flagged for separate remediation.

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior,
> animation, information hierarchy, customer-facing copy, navigation presentation, and brand
> expression. It may not change application truth, authentication, authorization, consent
> semantics, data models, APIs, readiness calculations, agent policy, source behavior, employer
> decisions, business logic, or pricing behavior. If the proposed experience requires one of
> those changes, record it as a product dependency and stop.

---

## 1. CURRENT SHARE-PATH SECURITY AUDIT — findings (flagged for separate remediation)

This section verifies or falsifies the seven claims in the founder brief (§11) against the
actual code, traced end to end. **Severity is stated conservatively.** Exploitability today is
bounded by an authorization gate the brief did not mention; that gate, and its trajectory, are
called out explicitly.

### 1.0 Files traced

- `apps/api/backend/src/services/distribution/applyShareService.ts` — the share service.
- `apps/api/backend/src/routes/apply.ts` — the sole production caller (`POST /api/apply/share`).
- `apps/api/backend/src/middleware/verifiedActor.ts` — `requireVerifiedClerkUserId`, `requireNpiAuthorization`.
- `apps/api/backend/src/services/ownership/npiOwnershipState.ts` — what "authorized for an NPI" means.
- `apps/api/backend/src/services/distribution/recipientResolution.ts` — server-side recipient resolution (C3).
- `apps/api/backend/src/routes/ownership.ts` — how a binding becomes VERIFIED/DELEGATED.
- `apps/api/backend/prisma/schema.prisma` — `EmployerWebhookConfig` model.

### 1.1 The authorization gate that bounds everything below

`POST /api/apply/share` (`apply.ts:89`) is **not** anonymous. Before any dispatch:

1. `requireVerifiedClerkUserId(req)` — identity comes from the JWKS-verified Clerk session JWT,
   never the `x-clerk-user-id` header; fails closed even while `CLERK_JWT_VERIFICATION` is
   `off`/`shadow` (`verifiedActor.ts:72`).
2. `requireNpiAuthorization(clerkUserId, npi, req)` — the caller must hold a **VERIFIED or
   DELEGATED** `NpiOwnership` binding for the NPI being shared. A self-asserted `CLAIMED`
   (pending) row does **not** authorize (`npiOwnershipState.ts:59`, `authorizesPrivateAccess`).

**How a binding becomes VERIFIED/DELEGATED today:** only through `POST /api/ownership/verify`,
which requires `requireVerifierRole(req)` — an **admin/verifier** action (`ownership.ts:258-284`).
`VERIFIED_METHODS` also lists `NPPES_IDENTITY_MATCH` and `ISSUER_ATTESTED`, but **no code path
writes either** (grep across `apps/api/backend/src` returns nothing outside the enum
definition). There is no self-serve verification. The route comment says so outright:
"no secure automated proof path exists yet."

**Consequence for exploitability:** every finding below requires the actor to be a clinician
whose NPI binding an admin has already verified. That is a small, vetted, pre-pilot population
(the volunteer cohort), not the anonymous internet. This is **authenticated, admin-gated**
abuse — real, but not a P0 mass-exposure today.

**Trajectory (the reason this still matters now):** MF's own Progressive Identity Assurance
ladder (§3 of this doc) proposes exactly the self-serve `NPPES_IDENTITY_MATCH` corroboration
(assurance level A3) that the enum is already waiting for. **The moment self-serve verification
ships, the gate opens and the SSRF below jumps from admin-gated to any-clinician.** Remediate
the share path *before* building A3.

### 1.2 Claim-by-claim verdict

| # | Claim (brief §11) | Verdict | Evidence |
|---|---|---|---|
| A | `applyShareService.ts` is `@ts-nocheck` | **TRUE** | Line 1: `// @ts-nocheck`. The whole consequential share/webhook path is exempt from type checking. |
| B | Webhook signing can fall back to a predictable default secret | **TRUE — and worse than stated** | Line 140: `config?.signingSecret ?? process.env.APPLY_WEBHOOK_DEFAULT_SECRET ?? 'vcv-default-secret'`. The literal `'vcv-default-secret'` is a public constant (repo was public until 2026-08-11). See §1.3 for why the per-org secret path never runs. |
| C | Callback validation claims HTTPS but accepts HTTP | **TRUE** | `URL_RE = /^https?:\/\/.+/` (line 76) accepts `http://`; the rejection message (line 96) says "must be a valid https:// URL". The check and its own error message disagree. |
| D | Caller-controlled callback URL may reach server-side `fetch()` | **TRUE** | `organization_context.callback_url` → `orgContext.callback_url` → `dispatchToOrganization` → `webhookUrl` → `fetch(webhookUrl, …)` (line 171). Only shape/length validation stands between client input and the socket. |
| E | This is SSRF after tracing caller/auth/recipient | **TRUE (authenticated, admin-gated, blind)** | See §1.4. |
| F | Redirects / private IPs / loopback / link-local / metadata / DNS rebinding / employer endpoints | **NO DEFENCES** | No allowlist, no IP filtering, no redirect control anywhere in `distribution/` (grep for `169.254`/`isPrivate`/`allowlist`/`redirect:` is empty). `fetch` uses undici's default `redirect: 'follow'` (up to 20 hops). |
| G | Email fallback can send bundle info to a generic/global recipient | **TRUE** | `sendEmailFallback` sends to a single `process.env.APPLY_EMAIL_FALLBACK_TO` address (line 212), never the chosen organization. See §1.5. |

### 1.3 Root cause amplifier — the "safe" webhook path is dead code

`dispatchToOrganization` (line 128) looks up the enterprise webhook config:

```ts
const config = await prisma.employerWebhookConfig.findUnique({
  where: { employerId: organizationId },
  select: { webhookUrl: true, signingSecret: true, active: true },   // ← fields that do not exist
}).catch(() => null);
```

The `EmployerWebhookConfig` model (`schema.prisma:2326`) actually has `secret` and `isActive`,
**not** `signingSecret` and `active`. Selecting unknown fields makes Prisma reject the query;
`.catch(() => null)` swallows the rejection, so **`config` is always `null`**. Therefore:

- `webhookUrl = (config?.active ? config.webhookUrl : null) ?? orgContext.callback_url` **always
  resolves to the client-supplied `callback_url`**. The registered, server-verified employer
  webhook target is never consulted.
- `signingSecret` is **never** the per-org secret — always the env default or `'vcv-default-secret'`.

This is the `@ts-nocheck` (Claim A) directly causing Claims B–F: type checking would have caught
`signingSecret`/`active`. The brief's preferred posture ("webhook targets come from verified
organization configuration") is not merely absent — the code that *tries* to implement it is
silently disabled. This matches the repo's own memory note *`ts_nocheck_hides_prisma_crashes`*
and *untestable = defect*.

> Runtime caveat: I did not execute this against a live database (documentation-only wave). The
> field mismatch is confirmed against schema + code; the runtime "always null" conclusion follows
> from Prisma's unknown-field validation behaviour and should be confirmed with one integration
> test during remediation.

### 1.4 SSRF characterization (do not overstate)

**What it is:** a verified clinician calls `POST /api/apply/share` with
`organization_context.callback_url` set to an internal target. The server issues a `POST` with a
JSON body (the bundle summary — the caller's own NPI, name, readiness) to that URL. Reachable
targets include `127.0.0.1`, `169.254.169.254` (cloud metadata), link-local, RFC-1918 hosts, and
internal service names. Redirects are followed, enabling naive-allowlist bypass and DNS
rebinding (there is no allowlist to bypass today, but this matters for any future fix).

**Even the C3 "resolved recipient" path does not close it.** When `opportunityId` is supplied,
`apply.ts:128-140` overwrites `organization_id`, `name`, and `purpose_of_use` from the verified
opportunity — but **not `callback_url`**. The client-chosen callback survives server-side
recipient resolution.

**Why impact is bounded (blind, POST-only):**
- The response **body is not returned** to the caller. Only `res.ok` (a boolean), the HTTP
  status text on failure, connection-error messages, and timing are observable — persisted to
  `BundleShareEvent.webhookStatus`/`webhookError` and surfaced in `ShareResult.webhookDelivered`.
  So this is a **blind SSRF with a coarse oracle** (up/down, status class, latency), useful for
  internal port/host enumeration, not a read primitive.
- It is `POST`-only with a partly-attacker-controlled JSON body. Classic GET-based metadata
  exf(IMDSv1) does not apply cleanly; GCP metadata needs a header the code does not send.
- Population is admin-verified clinicians (§1.1).

**Severity:** **P1** today (authenticated + admin-gated + blind), with a **P0 trajectory** once
self-serve NPI verification ships. Recommend remediation *before* MF-WAVE progressive-assurance
work, not after.

### 1.5 Recipient-mismatch on the email fallback

`sendEmailFallback` (line 206) sends to `process.env.APPLY_EMAIL_FALLBACK_TO` — one global
mailbox — whenever the webhook is skipped or fails. It does **not** send to the organization the
clinician authorized. The email contains the clinician's name, NPI, readiness, credential count,
and a link to `/apply/{bundleId}`. Because `GET /api/apply/bundle/:bundleId` (`apply.ts:60`) has
**no authentication** (capability-URL by unguessable UUID, returns full credentials until
expiry), that link is a working, unauthenticated view of the bundle delivered to a party the
clinician never chose. `APPLY_EMAIL_FALLBACK_TO` is ops-controlled (not attacker-controlled), so
this is a **disclosure-to-wrong-recipient / consent-mismatch** issue, not arbitrary exfiltration.
Neither `APPLY_EMAIL_FALLBACK_TO` nor `APPLY_WEBHOOK_DEFAULT_SECRET` appears in any committed env
template, so their production values are unknown from the repo (no prod probe performed).

### 1.5b Consent-integrity defects on the same live path (found while mapping the data model)

Two further issues, both on the **legacy `BundleShareEvent` path that backs the live homepage
Apply** (the sealed `ApplicationPacket`/`ConsentGrant` path is better but is only reachable via
`/apply/[requestUri]` Apply Intents):

- **Revocation does not close the public bundle link.** `revokeShare` sets
  `BundleShareEvent.revokedAt`, and the UI copy promises "Revocation is immediate and permanent
  for this share." But `GET /api/apply/bundle/:bundleId` (`apply.ts:60`, anonymous, backing the
  public `/apply/<bundleId>` page) checks **only `expiresAt`, never `revokedAt`**. A revoked
  bundle link keeps serving the full bundle until its 24h expiry. The revocation is enforced in
  the employer review queue and the snapshot route, but not on the one surface the clinician was
  handed. **This is a consent-integrity defect: the product tells the clinician a capability was
  withdrawn while it still works.** Severity: **P1** (promise vs behaviour on a consent control).
- **The apply-share audit is process-local.** `shareBundle` and `revokeShare` record only through
  the in-memory `auditLedger.ts` (a module-level array). `POST /api/apply/share` and
  `DELETE /api/apply/share/:shareId` write **zero** durable `prisma.auditEvent` rows — every
  `BUNDLE_EXPORT`/`REVOCATION` entry vanishes on restart. The durable pattern exists two files
  away (`passportEntity.ts`, `readinessSnapshot.ts`). For a disclosure/revocation event this is a
  compliance-evidence gap, not an exploit. Severity: **P2**.
- **`selectiveClaims` subset-sharing cannot do what its UI promises.** The Apply widget sends
  `VcvCredential.credentialType` values (`NPI_IDENTITY`, `OIG_LEIE`, …) but the server filters on
  `VcvCredentialDomain` enum members (`LICENSURE`, `IDENTITY`, …); only `MEDICARE_ENROLLMENT`
  overlaps. A partial selection is expected to *fail* (Prisma rejects invalid enum members) rather
  than over-disclose — so the fail-direction is safe — but the "share a subset" control is
  effectively non-functional, and no test exercises `selectiveClaims` on the share path. This is a
  **correctness/minimization gap**, not an exposure. Severity: **P3** (safe-fail, but the
  minimization feature does not work).

### 1.6 Recommended remediation (separate hardening PR, not MF-WAVE-01)

Ordered, minimal, each independently shippable:

1. **Remove `@ts-nocheck`** from `applyShareService.ts` and fix the resulting errors — this alone
   surfaces the `signingSecret`/`active` mismatch (§1.3). *Highest leverage; do first.*
2. **No predictable signing fallback.** If no configured secret exists, either sign with a real
   per-org secret or **do not claim authenticated delivery** (omit the signature and mark the
   delivery unauthenticated). Never sign with a literal constant.
3. **Callback target policy.** Prefer verified `EmployerWebhookConfig` (once §1.3 is fixed) as the
   only source of webhook URLs. If a client `callback_url` is retained at all: HTTPS-only (fix the
   regex to match the message), block loopback/RFC-1918/link-local/metadata, resolve-then-pin the
   IP, set `redirect: 'manual'` (or re-validate each hop), and enforce an egress allowlist.
4. **Fix the HTTP/HTTPS regex** (`URL_RE`) to `^https:\/\/` so code and message agree.
5. **Email fallback** must target the resolved organization, or be disabled until a per-org
   contact exists; never a single global mailbox for consequential bundle links.
6. **Reconsider unauthenticated `GET /api/apply/bundle/:bundleId`** — capability-URL is acceptable
   for a recipient with no account, but pair it with expiry (already present) and revocation
   enforcement at read time (verify `revokedAt` is checked on this path).

These are hardening items. They are recorded here and in the final report; **MF-WAVE-00 does not
implement them.**

---

## 2. AI truth-promotion boundary (candidate quarantine)

**Founder rule:** *AI may propose truth. AI may not create professional truth.*

### 2.0 One live boundary violation to flag (P1, truth-promotion)

The archaeology found a concrete place where unverified, AI-adjacent output already influences a
decision surface — the exact defect this section exists to prevent:

> `apps/api/backend/src/services/opportunities/opportunityTruth.ts:1428` promotes a
> `CandidateCredential` (status `PENDING_VERIFICATION`, an *unverified user upload*) to requirement
> level **L3** when `overallConfidence >= 0.9`. That `overallConfidence` is **not a model output** —
> it is a hardcoded per-regex-pattern constant (0.82–0.90) assigned in
> `services/ai/documentPipeline.ts`. So a document the OCR/regex path parsed, which the clinician
> has merely confirmed, can reach the highest requirement level on the opportunity-matching surface
> without any source corroboration.

This is a `FALSE_TRUTH_PROMOTION`-class issue (zero-invariant #1). It is not a share-path exploit;
it is a truth-boundary regression on the matching surface, and it is the single clearest argument
for the promotion contract below. Also note `services/trust/trustStateEngine.ts:1431` mints facts
from the same lane with `source: 'DocumentIntelligence'` and `verifiedAt: cred.createdAt` — a
*creation* timestamp stored in a field named `verifiedAt`. **Recommend: cap `CandidateCredential`
at L2 (or gate L3 on real source corroboration) as a fast, isolated fix.** Flag, do not fix here.

### 2.1 What exists to build the contract on (Q2/Q3, settled from code)

**Promotion contract (design):**

```
CV / artifact
   │  AI extraction (model version, artifact ref, source passage, confidence)
   ▼
CandidateClaim            ← quarantined; never decision-grade; never a Career Graph canonical edge
   │  clinician confirmation
   ▼
USER_ENTERED / attested   ← human authority; explicitly NOT "source verified"
   │  authoritative source corroborates (source policy permitting)
   ▼
source-backed evidence    ← eligible for "checked" under source rules
```

Hard invariants (also expressed as optimizer hard constraints, see OPTIMIZATION_MODEL §Hard
constraints):

- `INFERRED → VERIFIED` may **never** be performed by AI. Confirmation lands at `USER_ENTERED`,
  a distinct state, not at `VERIFIED`.
- Conflicting AI extractions produce `CONFLICT`/review, **never silent selection**.
- AI-suggested Career Graph links are **candidate links**, never canonical edges, until backed by
  a canonical record, user attestation, deterministic projection, or institutional decision.

**Q2 — which current model represents AI candidate claims?** `CandidateCredential`
(`schema.prisma:321`) is the live AI-lane candidate store (thin: `data Json`, `status`
`UNVERIFIED`→`PENDING_VERIFICATION`). The richer source-check lane is `ClaimRecord`
(`evidenceModel.ts:126`, FK-backed, with `parserVersion`, `confidenceScore`, supersession, review
fields). **Do not add a new enum or model** — extend `CandidateCredential`/`ClaimRecord`. The
provenance *vocabulary* already exists at the type level in `apps/web/lib/profile/provenance.ts`
(`VERIFIED / USER_ENTERED / INFERRED / UNKNOWN / CONFLICT`).

**Q3 — how does candidate state stay separate from source-backed truth?** It already does
structurally: `CandidateCredential` writes never touch `PersonProfile`; the boundary was traced and
holds. The leak is *downstream reads* (§2.0), not the store.

**Q6 — what metadata is genuinely missing?** Two things: (a) **source passage / provenance of
inference** — nothing records "this claim came from chars 412–460 of page 2"; the closest is a
whole-artifact `rawArtifactRef` + checksum. (b) **model identity** — the OCR path stores
`overallConfidence`/`processingTimeMs` but never records that `gpt-4o` produced the text.
`parserVersion` names the *parser*, not the *model*. These two fields are the real gap the promotion
contract needs; everything else (confidence, artifact ref, timestamps, supersession) exists.

**Caveat — `CONFLICT` and `INFERRED` are unreachable today.** `provenance.ts` is *display-only*:
provenance is a JSX literal at every call site, never persisted per field. So there is no persisted
per-field provenance for two sources to disagree in — `CONFLICT` is styled and documented but cannot
be produced. Any candidate lane MF designs "starts from zero persistence," not from an existing
per-field provenance store. This is the biggest single gap for the AI-quarantine contract.

---

## 3. Progressive Identity Assurance ladder (VitalCV-specific — NOT NIST conformance)

A VitalCV-specific ladder that increases with consequence. **This is explicitly not a claim of
NIST 800-63 IAL/AAL conformance** (see PRIOR_ART); the labels are internal.

| Level | Meaning | Established by (today) |
|---|---|---|
| VCV-A0 | Public / anonymous browsing | none |
| VCV-A1 | Authenticated account | Clerk session (verified JWT) |
| VCV-A2 | Claimed professional identity | `NpiOwnership` row, `CLAIMED` (self-asserted, pending) |
| VCV-A3 | Corroborated ownership | today: `ADMIN_VERIFIED`/`DELEGATED` only. `NPPES_IDENTITY_MATCH`/`ISSUER_ATTESTED` reserved but **unbuilt** |
| VCV-A4 | Step-up strong auth / passkey | **does not exist today** (no WebAuthn/passkey/step-up path — see ARCHITECTURE_MAP) |
| VCV-A5 | External identity proofing | not built; only if a real transaction requires it |

**Action → minimum sufficient assurance (design):**

| Action | Minimum assurance | Today's reality |
|---|---|---|
| Public NPI lookup (`/directory/[npi]`) | A0 | anonymous ✓ |
| Save a preference | A1 | authenticated ✓ |
| Claim an NPI | A1 → writes A2 | self-serve claim ✓ |
| Edit an identity-critical fact | A3 | *gap — profile edits are not assurance-gated to A3* |
| Upload a document | A2 | — |
| Share evidence (Apply) | **A3** | enforced: VERIFIED/DELEGATED required ✓ (`requireNpiAuthorization`) |
| Submit an application | A3 | via share path ✓ |
| Revoke a share | A3 (owner-bound) | owner check present ✓ (`revokeShare`) |
| Employer accept | employer-actor assurance | separate surface |
| Confirm actual first day | A3+ | — |
| Admin/support action | privileged role | `requireVerifierRole` ✓ |

**First step-up to build (Q10):** the highest-consequence action currently gated only at A1/A2 is
**editing an identity-critical fact** (name, NPI binding target). Recommend A3/A4 step-up there
before A4 (passkey) is built, because that edit changes what every downstream share asserts.
The A4 (passkey/WebAuthn) rung is a genuinely-new build; see EXECUTION_PLAN.

**Goal:** stronger security *without* forcing maximum proofing at signup. The ladder is the
mechanism for "the secure path stays easier than the insecure path" (north star #8).

---

## 4. Live data-handling enforcement (`deriveHandlingDecision`)

`apps/web/lib/security/dataClassificationFoundation.ts` classifies data (public / pii / phi /
internal) but its own module notes redaction/retention are **not yet live**. Design (not
implementation):

```
deriveHandlingDecision({ dataDescriptor, actor, action, recipient, purpose, assurance })
  → one or more of:
    ALLOW | DENY | MASK | STEP_UP | NO_LOG | NO_CACHE | NO_INDEX
    | PURPOSE_BOUND | EXPIRES | REQUIRES_AUDIT
```

**Recommended FIRST enforcement seam (Q11): structured logs on the share path.**
Rationale: it is the narrowest, highest-signal, lowest-blast-radius seam. `applyShareService.ts`
already logs NPI + Clerk user id + org + purpose (`log('info', 'apply_share_start', …)`), and the
codebase already demonstrates the *discipline* of payload-free audit logging in
`verifiedActor.ts`/`ownership.ts` (deliberately omitting NPI/name from denial and verify logs).
A `deriveHandlingDecision`-backed log wrapper that enforces `NO_LOG`/`MASK` on classified fields
generalizes an existing, proven local practice into one seam — no user-facing change, no new
platform. It is pure-function testable and does not touch the transaction loop.

Candidate order after logs: Apply payload field-scoping → admin/support display → AI prompts →
browser cache → analytics. Do **not** build a generic policy platform first (DO-NOT-BUILD).

---

## 5. Purpose-bound consent — representability audit (Q12)

**There is no `ConsentReceipt` model.** There are **two parallel Apply transactions** with different
consent records, and the live homepage Apply runs the weaker one:

- **Legacy path** (`BundleShareEvent` + `ReadinessSnapshot` + in-memory ledger) — backs the live
  `/` "Apply with VitalCV" widget.
- **Sealed path** (`ApplicationPacket` + `ConsentGrant` + durable `AuditEvent`) — better designed
  (canonical hashing, replay verification, withheld-vs-absent distinction, scope binding) but only
  reachable via `/apply/[requestUri]` Apply Intents.

**Q12 field-by-field (can the models represent a purpose-bound authorization artifact?):**

| Attribute | Legacy (live `/`) | Sealed (Apply Intent) |
|---|---|---|
| subject | ✅ | ✅ |
| recipient | ⚠️ unvalidated free text unless `opportunityId` given; no FK | ✅ `employerOrgId` (uuid) + `recipient` |
| purpose | ⚠️ free text, no enum, 3 vocabularies | ⚠️ free text, defaulted |
| transaction | ⚠️ `bundleId` only; **not tied to a job** | ✅ `applicationId`/`opportunityId`/version |
| exact fields | ❌ types-only summary; no per-field values | ✅ `fields[]` w/ value+evidenceState+source+withheld — best in repo |
| issuedAt | ✅ | ✅ |
| expiresAt | ✅ column; enforced in 1 of 5 readers | ❌ `validUntil` exists but always null, never read |
| revokedAt | ⚠️ written & enforced in 2 of 5 readers; **not on public bundle route** | ❌ columns exist on both models, **written by nobody** |
| assurance context | ❌ no column; biometric gate is client-only | ⚠️ `authenticationMethod` exists but hardcoded `'clerk_session'` |
| integrity | ⚠️ bundle "signature" is a plain sha256, no key | ✅ `packetHash` + `grantHash` (canonical sha256, replayable) |

**Verdict:** the sealed path can express ~7½ of 10; it is missing *enforcement* (expiry, revocation)
and real *assurance*. The legacy path — the one live on `/` — expresses ~4½, missing the two that
matter most for a disclosure record: **exact fields** and **share-event integrity**. `ConsentGrant`
is **write-only** (zero reads outside idempotency; every validity/revocation/supersession property
it models is inert). **Answer to Q12: yes, purpose-bound authorization is *representable* — on the
sealed path — but it is not *enforced*, and the live path is the weaker one.** The MF move is to
converge `/` onto the sealed path and wire the dead enforcement columns, **not** to add a new
consent model.

Summary of the gate this enforces (Disclosure Admission Gate):

```
recipient resolved & authorized → purpose explicit → transaction known →
required requirements identified → can a proof replace raw data? →
minimum evidence set computed → clinician sees & authorizes that set →
authorization still valid → SHARE
```

RFC 9396 (Rich Authorization Requests) is cited as **prior art for structured, fine-grained
authorization detail** (see PRIOR_ART) — borrow the *shape* (typed, per-recipient, per-purpose,
scoped authorization objects) if useful; **do not** adopt OAuth RAR machinery merely because it
exists. Reuse never means silent resharing: each new employer is a separately authorized event.

---

## 6. Security-by-construction invariants (make dangerous states unrepresentable)

Target invariants (design goals for MF, not claims about today):

- cannot mark `INFERRED` as decision-grade;
- cannot accept without an employer actor;
- cannot share without recipient + purpose + valid consent;
- cannot sign a production webhook with a fallback constant (§1.6 item 2);
- cannot log a field classified `NO_LOG` (§4);
- cannot send restricted data to an AI prompt without a handling decision;
- cannot mutate a sealed historical packet;
- cannot silently reuse consent across employers.

Several are partially enforced already (employer-actor on acceptance; recipient/consent shape on
share). The invariants above are the checklist MF-WAVE-01+ works down — **as constraints, not
weights** (OPTIMIZATION_MODEL).

---

## 7. Compliance posture (no claims)

No HIPAA/SOC2 conformance is claimed anywhere in this program (banned-strings contract). MF builds
controls that are *independently* valuable (data classification, least privilege, strong auth,
auditability, minimum-necessary, purpose limitation, provenance, tamper detection). Legal
applicability remains a separate assessment. "Minimum necessary" is used as a sound engineering
principle, not as an assertion that every HIPAA rule applies to VitalCV.
