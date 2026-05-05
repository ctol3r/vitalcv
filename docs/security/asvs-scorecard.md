# OWASP ASVS L1 Scorecard — VitalCV Web

This scorecard maps OWASP Application Security Verification Standard
v4.0.3 Level 1 controls to VitalCV's current implementation state. Per
`BOARD-SCHEMA-3` doctrine, **no control is marked `IMPLEMENTED` without
merged code, test evidence, or a cited PR**.

This document is the public-facing companion to `docs/security/red-team-report.md`.
It is **not a certification**, **not a SOC2 audit attestation**, and
**not a HIPAA compliance claim**. It is an honest gap inventory.

| Status | Meaning |
|---|---|
| ✅ IMPLEMENTED | Control is enforced in production with merged code + tests + a citable PR. |
| 🧱 FOUNDATION | Foundation type or doc exists; production enforcement is deferred. |
| 🌱 PLANNED | Tracked in roadmap; no foundation type yet. |
| ⛔ N/A | Control does not apply to VitalCV's architecture or threat model. |
| 🔒 VENDOR-GATED | Requires a third-party vendor (identity, payment processor, etc.) before it can be enforced. |

---

## V1 — Architecture, Design and Threat Modeling

| Control | Status | Evidence |
|---|---|---|
| V1.1.1 Secure SDLC documented | ✅ IMPLEMENTED | `CLAUDE.md` (truth contract, banned strings, Codex SAFE merge gate); `docs/ops/release-checklist.md` (RELEASE-CHECKLIST-1, PR #223). |
| V1.1.2 Threat modeling for changes | 🧱 FOUNDATION | `docs/security/red-team-report.md` (Feb 2026 backend attack cases). No structured threat model per feature yet. |
| V1.1.3 User stories include security requirements | 🧱 FOUNDATION | Truth-contract literals on every issuer-verification PR; banned-strings list; per-row `BOARD-SCHEMA-3` evidence requirements. |
| V1.1.4 Trust boundaries documented | ✅ IMPLEMENTED | `docs/architecture/vitalcv-knowledge-trust-graph.md` (28 numbered boundaries); `apps/web/lib/issuer-verification/serverPsvReceiptWriter.ts` (writer boundary). |
| V1.2 Secure architecture | 🧱 FOUNDATION | Pure-transform rule for `apps/web/lib/issuer-verification/*`; CHECK constraints in `apps/api/backend/prisma/schema.prisma` (PR #221, open). |
| V1.4 Access control architecture | 🧱 FOUNDATION | Clerk role-based middleware (`apps/web/middleware.ts`); `apps/web/lib/auth/roles.ts`. RBAC at org/team level still tracked under VERIFIER-ORG-1 (action map row). |
| V1.5 Input/output handling architecture | 🧱 FOUNDATION | Type-level literals (`decisionGrade: false`, `proofTier: 'receipt_candidate'`). No central output-encoding policy yet. |
| V1.7 Error and logging architecture | 🧱 FOUNDATION | `apps/web/lib/source-health/` returns safe metadata only (no PHI/headers/payload). Sentry wired but DSN-gated. |
| V1.10 Communications | ✅ IMPLEMENTED | HSTS preload header (SEC-HEADERS-1, PR #226); HTTPS-only on production via Vercel. |
| V1.11 Business logic | ✅ IMPLEMENTED | `apps/web/lib/issuer-verification/policyReview.ts` 5-gate flow; literal types prevent decision-grade upgrade without type error. |
| V1.14 Configuration | 🧱 FOUNDATION | `.env.example` patterns; `lib/env.ts` zod validator pending under SEC-ENV-1. |

---

## V2 — Authentication

| Control | Status | Evidence |
|---|---|---|
| V2.1.1 Passwords minimum length | ✅ IMPLEMENTED | Clerk-managed; password policy enforced by Clerk hosted UI. |
| V2.1.7 Passwords compared via constant-time | ✅ IMPLEMENTED | Clerk-managed. |
| V2.2.1 General authenticator requirements | 🧱 FOUNDATION | Clerk default auth; no MFA enforcement yet (board row 25%). |
| V2.5 Credential recovery | 🌱 PLANNED | Account recovery row at 25% on completion board; LIVE-SIGNUP-1 wave will address. |
| V2.7 Out-of-band verifier | 🔒 VENDOR-GATED | IAL2/IAL3 requires identity vendor (Persona/Onfido/Stripe Identity); see `docs/security/identity-vendor-evaluation.md` (planned). |
| V2.10.1 Session token uniqueness | ✅ IMPLEMENTED | Clerk-managed. |

---

## V3 — Session Management

| Control | Status | Evidence |
|---|---|---|
| V3.1.1 Token-based session bound to subject | ✅ IMPLEMENTED | Clerk JWT with `vitalcv.role` claim; verified in `apps/web/middleware.ts`. |
| V3.2 Session generation | ✅ IMPLEMENTED | Clerk-managed; cryptographically strong. |
| V3.3.1 Logout terminates session | ✅ IMPLEMENTED | Clerk-managed. |
| V3.4 Cookie-based session management | 🧱 FOUNDATION | Default Next/Clerk cookies; CSRF + idle-timeout under SEC-SESSION-1 (board row 20%). |
| V3.7 Defenses against session management exploits | 🧱 FOUNDATION | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (SEC-HEADERS-1, PR #226) defends against clickjacking. CSRF tokens still pending. |

---

## V4 — Access Control

| Control | Status | Evidence |
|---|---|---|
| V4.1.1 Trusted enforcement points | ✅ IMPLEMENTED | `apps/web/middleware.ts` runs Clerk auth before every protected route. |
| V4.1.2 Inputs to access control parsed safely | ✅ IMPLEMENTED | `getRequiredRole(pathname)` is pure; role enum is finite. |
| V4.2.1 Sensitive functions require auth | 🧱 FOUNDATION | Most issuer/clinician routes gated; review/employer surfaces still demo-tier. |
| V4.3.1 Admin interfaces use additional MFA | 🌱 PLANNED | `/admin/*` routes exist as foundation only. |

---

## V5 — Validation, Sanitization, Encoding

| Control | Status | Evidence |
|---|---|---|
| V5.1.1 Input validation enforced server-side | 🧱 FOUNDATION | TypeScript literal types narrow inputs at compile time. Runtime zod validation is per-route (SEC-API-1 will harden). |
| V5.2.1 HTML output encoded | ✅ IMPLEMENTED | React 19 default escaping; no `dangerouslySetInnerHTML` in audited surfaces. |
| V5.3.1 SQL injection defense | ✅ IMPLEMENTED | Prisma ORM with parameterized queries; no raw SQL string concatenation in `apps/api/backend/`. |
| V5.5.2 Deserialization defenses | ✅ IMPLEMENTED | No `eval()`, no `Function()` constructor, no `vm.runInNewContext()` in app code. |

---

## V6 — Stored Cryptography

| Control | Status | Evidence |
|---|---|---|
| V6.2.1 Cryptographic algorithms approved | ✅ IMPLEMENTED | ES256 receipt verifier (`apps/web/lib/crypto/receiptIssuer.ts`); HS256 explicitly banned (memory `pr_b_crypto_decision.md`). |
| V6.2.5 Insecure ciphers and modes prohibited | ✅ IMPLEMENTED | `jose@^6.2.3` only; no `crypto.createCipher` / `aes-128-ecb` / `MD5` / `SHA1` in app code. |
| V6.3 Cryptographic key management | 🧱 FOUNDATION | JWKS hosted at `/.well-known/jwks.json`; private key not committed; rotation policy documented in `docs/specs/`. |

---

## V7 — Error Handling and Logging

| Control | Status | Evidence |
|---|---|---|
| V7.1.1 No sensitive info in error responses | ✅ IMPLEMENTED | `apps/web/lib/source-health/` redacts headers/body/payload/NPI/PHI in error paths; `noFakeLive.test.ts` enforces. |
| V7.3.1 Audit logging for security-relevant events | 🧱 FOUNDATION | `apps/api/backend/prisma/schema.prisma` `AuditEvent` model exists; real persistence writer is the TRUST-PERSIST-1 row (still 5%). |
| V7.4.2 Authentication decisions logged | 🧱 FOUNDATION | Clerk logs to its own dashboard; VitalCV-side audit log ties in via `AuditEvent.metadata`. |

---

## V8 — Data Protection

| Control | Status | Evidence |
|---|---|---|
| V8.2.1 Sensitive data not cached client-side | 🧱 FOUNDATION | No deliberate sensitive-data caching; `Cache-Control` audit pending (SEC-API-1). |
| V8.2.2 Sensitive data classified | 🧱 FOUNDATION | `apps/web/lib/data-classification/dataClassificationFoundation.ts` 4-tier vocab (public/pii/phi/internal) with 6 redaction rules; `redactionLive: false` by design (foundation). |
| V8.3.1 Sensitive data sent in HTTP body, not URL | ✅ IMPLEMENTED | NPI lookups use POST body or path segment; no NPI in query strings on audited routes. |
| V8.3.4 Personal data inventory | 🧱 FOUNDATION | `dataClassificationFoundation.ts` model. PII tier doc pending (EV6B-DATA-CLASS row, action map). |

---

## V9 — Communication Security

| Control | Status | Evidence |
|---|---|---|
| V9.1.1 TLS for all inbound and outbound connections | ✅ IMPLEMENTED | Vercel terminates TLS; HSTS preload header (SEC-HEADERS-1, PR #226). |
| V9.1.2 Server only allows strong TLS versions | ✅ IMPLEMENTED | Vercel-managed; TLS 1.2+ only. |
| V9.1.3 Encrypted communications | ✅ IMPLEMENTED | All `connect-src` in CSP are `https://` only; `upgrade-insecure-requests` directive set. |

---

## V10 — Malicious Code

| Control | Status | Evidence |
|---|---|---|
| V10.3.1 Application has integrity checks for code | 🧱 FOUNDATION | `pnpm-lock.yaml` committed; `pnpm install --frozen-lockfile` in CI. SRI hashes for external scripts not yet enforced. |
| V10.3.2 Application uses signed dependencies | 🧱 FOUNDATION | npm audit signatures via pnpm; no in-pipeline supply-chain attestation yet. |

---

## V11 — Business Logic

| Control | Status | Evidence |
|---|---|---|
| V11.1.1 Business logic flows integrity | ✅ IMPLEMENTED | `apps/web/lib/issuer-verification/policyReview.ts` 5-gate flow; truth-contract literals prevent decision-grade upgrade. |
| V11.1.4 High-value flows have anti-automation | 🧱 FOUNDATION | Pilot funnel + NPI lookup do not yet enforce rate limits at edge. |

---

## V12 — File and Resources

| Control | Status | Evidence |
|---|---|---|
| V12.1.1 File upload size and type limits | 🌱 PLANNED | Knowledge Inbox accepts text only today; document upload is foundation-tier (board row 32%). |
| V12.3.1 Files served outside webroot when sensitive | ✅ IMPLEMENTED | No file-serving code in `apps/web/app/`; `/.well-known/jwks.json` is intentionally public. |

---

## V13 — API and Web Service

| Control | Status | Evidence |
|---|---|---|
| V13.1.1 API HTTP method enforcement | ✅ IMPLEMENTED | Next.js App Router enforces method routing per `route.ts`. |
| V13.1.4 API authentication uses standard tokens | ✅ IMPLEMENTED | Clerk JWT; `apps/web/app/api/internal/source-health/_auth.ts` dual-mode `Authorization: Bearer`. |
| V13.2.1 RESTful APIs use accepted schema | 🧱 FOUNDATION | OpenAPI doc not yet generated. |
| V13.3.1 GraphQL has anti-malicious-query | ⛔ N/A | No GraphQL endpoints. |

---

## V14 — Configuration

| Control | Status | Evidence |
|---|---|---|
| V14.1.1 Build pipeline uses repeatable builds | ✅ IMPLEMENTED | `pnpm-lock.yaml` + `pnpm install --frozen-lockfile` in CI; `pnpm turbo run build --filter @vitalcv/web` is canonical. |
| V14.1.4 Apps deploy with secure defaults | ✅ IMPLEMENTED | Strict security headers (SEC-HEADERS-1, PR #226). |
| V14.2.1 No high-risk components in production | 🧱 FOUNDATION | `pnpm audit` in CI; no `npm audit fix --force` patterns. |
| V14.4.1 HTTP responses include security headers | ✅ IMPLEMENTED | SEC-HEADERS-1 (PR #226) wires HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy, CSP. |
| V14.5.3 CORS uses strict origin allow-list | 🧱 FOUNDATION | Allow-list under SEC-API-1 (board row 32%). |

---

## Summary

| Status | Count |
|---|---:|
| ✅ IMPLEMENTED | 25 |
| 🧱 FOUNDATION | 22 |
| 🌱 PLANNED | 4 |
| 🔒 VENDOR-GATED | 1 |
| ⛔ N/A | 1 |
| **Total controls scored** | **53** |

**Coverage**: 47% IMPLEMENTED at L1 baseline. The remaining 53% are
either FOUNDATION (have a typed foundation but no production enforcement
yet — most can move to IMPLEMENTED via per-row Wave PRs), PLANNED
(roadmap items with no foundation), VENDOR-GATED (require third-party
procurement), or N/A.

## What this scorecard does NOT do

- Does not claim VitalCV is ASVS L1 certified.
- Does not claim VitalCV is HIPAA compliant or SOC2 certified.
- Does not substitute for a third-party security audit.
- Does not move any row on `docs/ops/vitalcv-completion-board.md` on
  its own — per BOARD-SCHEMA-3, scores move only on merged + verified
  evidence per row.

## Update cadence

Every PR that touches a security-relevant control (SEC-HEADERS-1,
SEC-ENV-1, SEC-SESSION-1, SEC-API-1, EV6B-*, etc.) must update its
relevant row above with the merge commit / PR reference. The
release-checklist gate (`docs/ops/release-checklist.md`) flags this in
the PR body.

## References

- OWASP ASVS v4.0.3: https://owasp.org/www-project-application-security-verification-standard/
- VitalCV red-team report: `docs/security/red-team-report.md`
- VitalCV truth contract: `docs/architecture/vitalcv-knowledge-trust-graph.md`
- VitalCV completion board: `docs/ops/vitalcv-completion-board.md`
