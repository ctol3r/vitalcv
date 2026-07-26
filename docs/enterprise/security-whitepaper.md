# VitalCV Security & Trust Whitepaper (Buyer-Facing)

**Version:** 2026-07-06 · **Audience:** enterprise buyer security & compliance teams
**Principle:** every claim below is backed by code or an in-repo artifact. We never
claim a certification we don't hold.

## 1. What VitalCV is

The Provider Career Evidence Network. Reusable, source-backed clinician career
evidence that follows the provider across opportunities. The wedge:
`NPI → source checks → readiness snapshot → passport / proof packet → employer
review → accept as head start`.

## 2. Trust model — Recognition → Acceptance → Start

The canonical path is frozen and **fail-closed**: Recognition requires a valid
employer-signed event; Acceptance requires valid Recognition + countersignature +
PSV reference; Start requires Acceptance. Any expired / out-of-order / self-reported
/ wrong-signer event is rejected. Enforced by branded types
(`VerifiedCanonicalPath`, compile-time bypass-proof) and proven by a 67-case
fail-closed test suite gated in CI (`canonical-path-gate`).

**Revocation-first:** receipt validity (revoked / expired / stale) is re-checked at
**read time** on every surface — no cached "valid". Revocation overrides all prior
positive state.

## 3. Audit trail

Every mutating action writes an `AuditEvent` **before** returning success (doctrine
anti-drift rule #2). Coverage is measured and **regression-gated**: a CI gate
(`audit-coverage-gate`) freezes the current baseline so no new unaudited mutation
can land (`docs/security/audit-coverage.md`). Audit events are batched into a
Merkle tree for tamper-evidence.

## 4. Data protection & PHI

- **Data classes** and flows are mapped (`docs/compliance/data-map.md`). The wedge
  product handles credentialing evidence (public NPPES + source-check results +
  self-attested), **not clinical/treatment PHI**.
- **Zero PHI on-chain**, enforced in code: `assertHashOnlyAnchor` fails closed
  unless an anchored value is a pure hash, and denylists email/SSN/NPI/DOB
  patterns (15-case test). Only a Merkle **root hash** ever reaches the anchor
  boundary.
- **Encryption:** TLS everywhere; Railway Postgres encryption at rest.
- **HIPAA-aligned** (never "certified"); a BAA is available subject to counsel review.

## 5. Application security posture

Self-assessed against **OWASP ASVS 4.0.3 Level 2** with an open, honest gap
register (`docs/security/ASVS-scorecard-2026-07.md`). Highlights:

- **AuthN:** Clerk-managed identity; JWT verified at the web tier.
- **Access control:** tenant isolation (org-scoped) + employer-review RBAC decision
  core; least-privilege deny-by-default. (Verifier RBAC currently in shadow mode —
  see gap register.)
- **Rate limiting:** per-tier limiters; `trust proxy` configured so keying uses the
  real client IP behind the edge.
- **HTTP hardening:** HSTS (2y, preload), CSP, `frame-ancestors 'none'`, nosniff,
  Referrer-Policy, Permissions-Policy; `helmet()` on the API.
- **Supply chain:** critical-severity SCA gate + Dependabot in CI.
- **Containers:** non-root runtime user.
- **Observability:** Sentry with PII scrubbing (`sendDefaultPii:false` + `beforeSend`
  redaction).
- **Secrets:** no secrets in git (full-history scan clean); runtime secrets in the
  platform secret store.

### Known gaps (disclosed, not hidden)

The ASVS gap register lists open items in priority order — notably header-trust
authentication hardening (G1) and verifier-RBAC enforcement (G2, shadow→enforce).
These are tracked with owners; we disclose them rather than paper over them.

## 6. Honesty commitments (what we will NOT claim)

We never claim: NPDB, DEA, ABMS, SAM.gov, real-time Nursys/FSMB, all-50-states
coverage, "instant/guaranteed verification", or SOC 2 / NCQA / HIPAA
*certification*. Source coverage is always shown as **checked / gated / stale /
unknown**; revoked fails closed. These prohibitions are enforced by an automated
copy-compliance CI gate.

## 7. Compliance roadmap (honest status)

- **HIPAA-alignment packet** — in progress (`docs/compliance/`).
- **SOC 2 Type I** — planned; auditor engagement is the next step (not yet started;
  not claimed).
- **NCQA CR1–CR5 mapping** — drafted against implemented behavior only.

---
*Backing artifacts: `docs/security/`, `docs/compliance/`, `docs/architecture/`. This
whitepaper is reviewed against implemented behavior; if a control changes, this
document is updated.*
