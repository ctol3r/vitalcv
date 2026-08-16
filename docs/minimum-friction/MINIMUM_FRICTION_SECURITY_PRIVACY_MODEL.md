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

## 1. CURRENT SHARE-PATH SECURITY AUDIT — findings (REDACTED)

The full share-path audit (files, line references, the SSRF characterisation, the signing-secret
fallback, the dead webhook-config path, and the email-fallback finding) was moved OUT of this
committed document by founder ruling (2026-08-16): exploit specifics do not belong in a PR or a
committed doc. The repository was public until 2026-08-11 and the standing rule survives the switch
to private.

**Summary that is safe to state here:** the Apply-with-VitalCV outbound share/webhook path has a
confirmed security weakness class (server-side request reachable from caller-influenced
configuration, plus a weak-default signing fallback and an unclosed revocation link). It is
**admin-gated today** — it requires an admin-only VERIFIED/DELEGATED NPI binding — so it is not an
outsider-reachable hole in the current product. It becomes materially worse the moment self-serve
NPI verification ships (Minimum Friction assurance rung A3), so it must be remediated **before**
that work.

**Where the detail lives:** a local-only, uncommitted note held by the coordinating session
(`SHARE_PATH_SECURITY_FINDINGS_LOCAL_ONLY.md`). Remediation is tracked in its own security PR (see
the PR that supersedes this stub); that PR references the local note, not this doc.

**Status:** flagged; remediation authorised by the founder 2026-08-16; not fixed in MF-WAVE-00
(research-only wave).

## 2. AI truth-promotion boundary (candidate quarantine)

**Founder rule:** *AI may propose truth. AI may not create professional truth.*

### 2.0 One live boundary violation to flag (P1, truth-promotion)

The archaeology found a concrete truth-boundary regression on the opportunity-matching surface:
an unverified, AI-adjacent document upload the clinician has merely confirmed can reach the highest
requirement level without source corroboration, and a nearby lane stores a *creation* timestamp in
a field named `verifiedAt`. This is a `FALSE_TRUTH_PROMOTION`-class issue (zero-invariant #1) and is
the clearest argument for the promotion contract below.

**File references, the exact promotion threshold, and the fix location are held in the local-only
note** (`SHARE_PATH_SECURITY_FINDINGS_LOCAL_ONLY.md`), not committed here, per the same
2026-08-16 redaction ruling. Recommended fast fix: cap the candidate lane at L2 or gate the top
level on real source corroboration. Flag, do not fix here.

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
the pipeline's confidence/timing fields but never records which model produced the text.
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
