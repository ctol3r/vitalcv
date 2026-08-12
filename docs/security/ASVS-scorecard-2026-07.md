# OWASP ASVS 4.0.3 — Level 2 Scorecard (2026-07)

**Status date:** 2026-07-05 · **Baseline:** `4cc556e77` (origin/main)
**Closes:** `docs/ops/launch-blockers.md` item #5 (Wave B task 6, god-mode plan).

This document extends `docs/security/asvs-scorecard.md` (the L1 scorecard,
2026-06) to OWASP ASVS v4.0.3 **Level 2**. It scores the chapters in scope for
the L2 pass — V1 (architecture), V2 (authentication), V3 (sessions), V4
(access control), V5 (validation), V7 (errors/logging), V9 (communications),
V10 (malicious code), V12 (files), V13 (API), V14 (configuration). Chapters
V6 (stored cryptography), V8 (data protection), and V11 (business logic) are
**not re-scored here** — their rows in the L1 scorecard remain the current
statement, except for the path correction noted below.

**What this document is:** a self-assessment gap inventory. Every row cites a
file path (and usually a line) verified on disk at the baseline commit —
no row is marked Met on intent, roadmap, or memory.

**What this document is not:** it is not a third-party audit, not an
attestation, and not a claim that any regulatory or accreditation bar has
been met. Open gaps are listed plainly in the [gap register](#known-gap-register)
and several are launch blockers.

> **Redaction note (public repository).** Gap statuses, owners, evidence file
> paths and the gap register are unchanged. Request shapes and route-level
> reachability findings for gaps that are still **open** have been withheld;
> those rows say so inline. See the internal gap register for the detail.

| Status | Meaning |
|---|---|
| **Met** | Control implemented and verifiable in the cited file(s) on the baseline commit. Vendor-delegated rows say so explicitly. |
| **Partial** | A real mechanism exists but coverage, enforcement, or verification is incomplete. The evidence cell says what is missing. |
| **Gap** | No effective control today. |
| **N-A** | Not applicable to VitalCV's architecture (the evidence cell says why). |

---

## Corrections to the L1 scorecard

Found while re-verifying L1 claims for this pass. The L1 document is a
point-in-time statement; these rows supersede it.

1. **V14.2.1 ("pnpm audit in CI") is stale.** No workflow under
   `.github/workflows/` runs a dependency audit (verified against the full
   listing: `ci.yml`, `ci-preflight.yml`, `monorepo.yml`, `a11y-gate.yml`,
   `openid-conformance.yml`, `deploy-*.yml`, `release-verify.yml`,
   `source-health-probe.yml`). Scored as **Gap** at 14.2.1 below.
2. **V5.2.1 ("no `dangerouslySetInnerHTML` in audited surfaces") is stale.**
   Four sites exist today: `apps/web/components/compare/JsonLd.tsx:8`,
   `apps/web/components/developers/ApiSandbox.tsx:128`,
   `apps/web/components/matcha/MatchaConstellation.tsx:356`,
   `apps/web/components/matcha/buyer/EcosystemMap.tsx:85`. Scored at 5.3.3.
3. **V14.5.3 (CORS) has landed since L1.** Web: default-deny allowlist on
   `/api/*` (`apps/web/middleware.ts:110-126`,
   `apps/web/lib/security/corsAllowlist.ts`). Backend: `CORS_ORIGIN` may not
   be `*` in production (`apps/api/backend/src/config/env.ts:111-118`;
   enforced again at `apps/api/backend/src/app.ts:3444-3452`). Now **Met**.
4. **V13.2.1 (OpenAPI) has landed since L1.** `apps/api/backend/src/openapi.ts`
   is served at `/openapi.json` and `/api-docs` (`app.ts:3705-3706`).
5. **V8.2.2 evidence path moved.** The classification foundation now lives at
   `apps/web/lib/security/dataClassificationFoundation.ts` (imported by
   `apps/web/app/status/page.tsx:17` and
   `apps/web/app/api/compliance/evidence/route.ts:4`), not
   `lib/data-classification/`.

---

## V1 — Architecture, Design and Threat Modeling (all L2)

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 1.1.1 | Secure SDLC in use | Met | `CLAUDE.md` (roles, merge gates, truth contract, banned-string discipline); standing guardrails block in `docs/ops/launch-blockers.md`; tiered merge policy (Chris, 2026-07-01). |
| 1.1.2 | Threat modeling for design changes | Partial | `docs/security/red-team-report.md` (10 attack simulations, 2026-02); `docs/architecture/vitalcv-knowledge-trust-graph.md` numbered boundaries. No per-feature threat-model step in the PR process. |
| 1.1.3 | Security constraints in user stories | Partial | Truth-contract literals enforced per `CLAUDE.md`; per-PR guardrails in `docs/ops/launch-blockers.md`. Not a systematic per-story practice. |
| 1.1.4 | Trust boundaries documented | Met | `docs/architecture/vitalcv-knowledge-trust-graph.md` (numbered boundaries; add-only rule in `CLAUDE.md`). |
| 1.1.5 | High-level architecture + remote services analyzed | Met | Knowledge-trust graph; `docs/ops/REBASELINE-2026-07-04.md` (on-disk verification of every component claim, incl. NPPES v2.1 pinning). |
| 1.1.6 | Centralized, vetted security controls | Partial | Single sources exist for headers (`apps/web/security-headers.mjs`) and public-API safety (`apps/api/backend/src/middleware/publicSafety.ts`), but three parallel authn modules coexist (`middleware/apiAuth.ts`, `middleware/authMiddleware.ts`, `publicSafety.apiKeyAuth`) — consolidation needed. |
| 1.1.7 | Security checklist available to developers | Partial | Standing guardrails in `docs/ops/launch-blockers.md`; this scorecard + L1. No single checklist wired into PR review. |
| 1.2.1 | Low-privilege service accounts | Gap | Neither `apps/api/Dockerfile` nor `apps/web/Dockerfile` sets a `USER` directive — containers run as root. No documented DB role separation. |
| 1.2.2 | Inter-component authentication | Partial | API-key gate on mutating ingest (`app.ts:2067` → `publicSafety.apiKeyAuth`); but web→backend user identity travels as an unauthenticated `x-clerk-user-id` header (see 14.5.4). |
| 1.2.3 | Single vetted authn mechanism | Partial | Clerk is canonical for users (`apps/web/middleware.ts`); backend retains a legacy HS256 util with a hardcoded fallback secret (`apps/api/backend/src/auth/jwt.ts:8`) and an in-memory keystore module (`middleware/apiAuth.ts:41-53`). |
| 1.4.1 | Access control enforced at trusted service layer | Partial | Web: role middleware (`apps/web/middleware.ts:47-108`). Backend: tenant guard mounted globally (`app.ts:3478` → `middleware/tenantGuard.ts`). Weakened by caller-supplied role/org headers (4.1.2). |
| 1.4.4 | Single well-vetted access-control mechanism | Partial | The pure decision-core pattern exists (`services/authz/employerActionRbac.ts`) but currently covers only employer-review mutations. |
| 1.4.5 | Attribute-based access control | Partial | RBAC decisions use server-side role **and** status attributes (`employerActionRbac.ts:49-70`); scope limited as above, enforcement off (4.1.3). |
| 1.5.1 | Input/output requirements defined | Partial | Typed env contracts (`apps/web/lib/env.ts`, `apps/api/backend/src/config/env.ts`); no central request-schema policy — `middleware/validateRequest.ts` is an explicit no-op ("MVP: validation intentionally deferred"). |
| 1.5.2 | No untrusted-client serialization trust | Met | JSON-only request bodies; no custom deserializers; no `eval`/`vm` in request paths (L1 sweep, unchanged). |
| 1.5.3 | Server-side input validation | Partial | zod in 8 backend modules (incl. `config/env.ts`); UUID/format guards on id params; but 0 zod imports across `apps/web/app/api/**` and the shared `validateRequest` middleware is a no-op. |
| 1.5.4 | Output encoding near the interpreter | Met | React 19 auto-escaping (web); Prisma parameterization (SQL). |
| 1.7.1 | Common logging format | Met | Structured event logging via `apps/api/backend/src/obs/logger` (`log(level, msg, {event, ...})` used across `config/env.ts`, `app.ts`); structured audit entries (`services/audit/auditLedger.ts`). |
| 1.7.2 | Logs transmitted securely | Partial | Sentry over HTTPS (`apps/web/sentry.{client,edge,server}.config.ts`, `@sentry/node` in `middleware/errorHandler.ts`); Railway log transport is platform-managed, not verifiable in repo. |
| 1.8.1 | Sensitive data classified | Partial | `apps/web/lib/security/dataClassificationFoundation.ts` (consumed by `app/api/compliance/evidence/route.ts:4`); classification is a foundation vocabulary, not enforced at write time. |
| 1.8.2 | Protection requirements per classification level | Partial | Same foundation; redaction rules not live enforcement. |
| 1.9.1 | Encrypted communications between components | Partial | Browser↔web and web↔backend over HTTPS (CSP `connect-src` is https-only, `security-headers.mjs:59`; `BACKEND_URL=https://api.vitalcv.com` per `CLAUDE.md`). `DATABASE_URL` TLS mode not pinned in repo. |
| 1.9.2 | Components verify each other's authenticity | Partial | API keys on write paths; `CRON_SECRET`/`RELEASE_WEBHOOK_TOKEN` bearer gates for probes (`apps/web/lib/env.ts:100-126`). User-identity headers unauthenticated (14.5.4). |
| 1.10.1 | Source control + code review + issue tracking | Met | GitHub PR flow with merge gates (`CLAUDE.md`); CI on every PR (`.github/workflows/ci.yml`, `monorepo.yml`). |
| 1.11.1 | Components and business logic documented | Met | `docs/architecture/vitalcv-knowledge-trust-graph.md`; issuer 5-gate policy flow pinned by literal types (`CLAUDE.md` truth contract). |
| 1.11.2 | No unsynchronized state in high-value flows | Partial | Employer-review mutations are transactional and audit-first (`routes/employerActions.ts:13-20`); but several security stores are per-process in-memory (rate limits, `apiAuth.ts` sessions), which desynchronize across instances. |
| 1.12.2 | User-uploaded files served safely | Partial | Uploads buffered in memory, not written to webroot (`routes/documents.ts:26-28`); `X-Content-Type-Options: nosniff` set; no separate serving domain. |
| 1.14.1 | Component segregation | Met | Separate deployable services (`apps/web`, `apps/api/backend`, `apps/issuer-api`, `apps/status-api`); Railway service isolation (`railway.toml`, `apps/web/railway.toml`). |
| 1.14.3 | Build pipeline flags outdated/insecure components | Gap | No dependency-audit step in any workflow and no `dependabot.yml`/renovate config (`.github/` contains only `pull_request_template.md` + `workflows/`). |
| 1.14.4 | Build pipeline performs security steps | Partial | `pnpm install --frozen-lockfile` everywhere (`ci.yml:41`, `monorepo.yml:50`); typecheck/lint enforced at build (`CLAUDE.md`); no SAST step. |
| 1.14.5 | Deployment sandboxing / containerization | Met | Per-service Docker images (`apps/api/Dockerfile`, `apps/web/Dockerfile`); Railway-managed runtime. |
| 1.14.6 | No unsupported/insecure client-side tech | Met | React 19 + Next 15 only; no plugins/applets/Flash. |

---

## V2 — Authentication

User authentication is **delegated to Clerk** (custom Frontend API domain
`clerk.vitalcv.com`; the CSP allowances that make production sign-in work are
pinned with rationale in `apps/web/security-headers.mjs:42-51` — PR #536).
VitalCV stores no first-party passwords: `apps/api/backend/prisma/schema.prisma`
contains zero password fields (verified by grep). Clerk **dashboard**
configuration (password policy details, MFA factors, Google OAuth state) is
not expressible in this repo and is tracked as launch blocker #3 — rows that
depend on it are Partial, not Met.

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 2.1.1–2.1.12 | Password security (length, breach check, paste, no rotation rules, …) | Partial | Vendor-delegated to Clerk hosted auth; no local password storage (schema verified). Policy values live in the Clerk dashboard, not the repo → unverifiable here (launch blocker #3). |
| 2.2.1 | Anti-automation on authentication | Met | Clerk bot protection via Cloudflare Turnstile, active for `pk_live` and allow-listed in CSP (`security-headers.mjs:49-51,55,60`); public-API rate limits (`publicSafety.ts:158-189`). |
| 2.2.2 | Weak authenticators restricted | Partial | Email OTP is deliberately scoped to identity binding, not session auth (`services/identity/otpCore.ts:1-8`); Clerk factor configuration unverified in repo. |
| 2.2.3 | Secure notifications after auth events | Partial | Clerk-managed emails; not verifiable in repo. |
| 2.3.1 | System-generated initial secrets: random, expiring | Met | OTP: CSPRNG 6-digit code, 10-minute TTL, single-use (`otpCore.ts:13-31`). |
| 2.4.1–2.4.5 | Credential storage (password hashing) | N-A | No first-party password storage (schema verified). The only stored authenticator secret is the OTP challenge, stored as salted SHA-256, plaintext never persisted (`otpCore.ts:23-31`). |
| 2.5.1–2.5.7 | Credential recovery | Partial | Clerk-managed recovery flows; production OAuth/recovery state unconfirmed (launch blocker #3). |
| 2.6.x | Look-up secrets | N-A | None issued. |
| 2.7.2 | Out-of-band verifier expires in ≤10 min | Met | `OTP_TTL_MS = 10 * 60 * 1000` (`otpCore.ts:13`). |
| 2.7.3 | Out-of-band verifier single-use | Met | `consumedAt` guard + per-challenge attempt cap of 5 (`otpCore.ts:14,59-79`). |
| 2.7.6 | Code entropy + hashed storage | Met | `randomInt` CSPRNG; salted SHA-256 at rest; constant-time comparison (`otpCore.ts:19-57`). 6 digits ≈ 19.9 bits — compensated by the 5-attempt lockout, 10-min TTL, and 5-issues/hour cap (`otpCore.ts:14-16`). |
| 2.8.x | Single-factor OTP devices (TOTP) | N-A | Not implemented; passkey/AAL2 path tracked as launch blocker #12. |
| 2.9.x | Cryptographic authenticators | N-A | Same as 2.8. |
| 2.10.1 | Service-account authn without static default creds | Partial | `API_KEYS` env-injected and required in production (`config/env.ts:38-41,57-59`); rotation process undocumented. |
| 2.10.2 | No default credentials | Met | Legacy HS256 verifier deleted 2026-07-05 (closes G6): `auth/jwt.ts` removed and `middleware/organizationContext.ts` no longer parses Authorization bearer tokens, so no JWT shared secret — and no default — exists in the backend (`JWT_SECRET` is no longer read anywhere). Pinned by `middleware/__tests__/organizationContext.test.ts` (forged dev-secret tokens must not inject org context). The remaining query/`x-org-id` org sources stay tracked at 4.1.2 / 14.5.4. |
| 2.10.3 | Service secrets stored with protection | Partial | API keys fingerprinted (not logged raw) for rate-limit identity (`publicSafety.ts:41-44`); the Wave-125 `apiAuth.ts` keystore is in-memory/dev-tier (`apiAuth.ts:41-53`). |
| 2.10.4 | Secrets via secrets manager, not source code | Partial | Railway env vars + `apps/web/.env.example` pattern; no committed live secrets found (the former 2.10.2 fallback default was deleted 2026-07-05). |

---

## V3 — Session Management

Sessions are Clerk's (cookie-based). VitalCV adds one cookie of its own: the
HMAC-signed role cookie, explicitly documented as a routing convenience and
not the security boundary (`apps/web/lib/auth/roleCookie.ts:19-22`).

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 3.1.1 | No session tokens in URLs | Met | Clerk cookie sessions. (`RELEASE_WEBHOOK_TOKEN` accepts `?token=` — machine webhook, not a user session; noted in `apps/web/lib/env.ts:121-126`.) |
| 3.2.1 | New session token on authentication | Met | Vendor-delegated (Clerk). |
| 3.2.2 | Session token entropy ≥64 bits | Met | Vendor-delegated (Clerk JWTs). |
| 3.2.3 | Session tokens stored securely in browser | Met | Clerk cookies; role cookie set `httpOnly` + `secure` + `sameSite: 'lax'` (`apps/web/app/api/auth/resolve-role/route.ts:81-83`). |
| 3.3.1 | Logout invalidates the session | Met | Vendor-delegated (Clerk). |
| 3.3.2 | Re-authentication after idle/absolute period (L2: 12h / 30min idle) | Partial | Clerk session lifetimes are dashboard-configured and not pinned to L2 windows; the role cookie self-expires in 15 min (`roleCookie.ts:32`). |
| 3.3.3 | Logout-everywhere capability | Partial | Available through Clerk account surface; not exposed in-app. |
| 3.3.4 | Users can view active sessions | Partial | Clerk user-profile surface; not exposed in-app. |
| 3.4.1 | Cookie `Secure` attribute | Met | `resolve-role/route.ts:82`; Clerk defaults. |
| 3.4.2 | Cookie `HttpOnly` attribute | Met | `resolve-role/route.ts:81`. |
| 3.4.3 | Cookie `SameSite` | Met | `sameSite: 'lax'` (`resolve-role/route.ts:83`). |
| 3.4.4 | `__Host-` cookie prefix | Gap | Role cookie is named `vitalcv_role` (`roleCookie.ts:29`) — no `__Host-` prefix on first-party cookies. |
| 3.5.3 | Stateless tokens use secure, verified signatures | Partial | Clerk JWT verified in middleware; role cookie HMAC-SHA256 via WebCrypto (`roleCookie.ts:60-70`); legacy backend HS256 verifier has the 2.10.2 default-secret fallback (`auth/jwt.ts:8-16`). |
| 3.7.1 | Full valid session required for sensitive operations | Partial | Employer mutations resolve the server-side User row before acting (`routes/employerActions.ts:63-67,203`), but the `x-clerk-user-id` header itself is not cryptographically verified by the backend (14.5.4). |

---

## V4 — Access Control

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 4.1.1 | Enforced at a trusted service layer | Partial | Web role middleware (`apps/web/middleware.ts:47-108`); backend tenant guard mounted globally (`app.ts:3478`); weakened by 4.1.2. |
| 4.1.2 | Access-control attributes tamper-protected | Gap | Org context is accepted from caller-supplied request attributes rather than verified membership (`middleware/organizationContext.ts:20-40`), and a caller-asserted elevated platform role bypasses org-match checks (`middleware/tenantGuard.ts:153-167,184-205`). [Request shape withheld — see internal gap register.] Counter-example done right: RBAC roles come from the DB, "never from caller-supplied headers" (`services/authz/employerActionRbac.ts:5-8`). |
| 4.1.3 | Least privilege enforced | Gap | The employer-review RBAC decision core is merged and running in **shadow mode only**: `VERIFIER_RBAC_ENFORCED` defaults false (`config/env.ts:151-155`), so denials are logged (`routes/employerActions.ts:206-211`) but not blocked. Enforcement = flag flip after shadow telemetry review (launch blocker #2). `apps/web/lib/verifier/orgRolesFoundation.ts` pins `rbacEnforced: false`. |
| 4.1.5 | Access control fails securely | Met | Missing org context → 401 (`tenantGuard.ts:169-182`); org mismatch → 403 (`tenantGuard.ts:184-205`); BLOCKED passport fails closed (`docs/ops/REBASELINE-2026-07-04.md`, employer-accept row); empty CORS allowlist blocks all cross-origin API calls (`lib/security/corsAllowlist.ts`). |
| 4.2.1 | IDOR protections | Partial | UUID format guards before Prisma UUID-column queries — PR #501 idiom (`routes/public.ts:176-179`, `routes/employerActions.ts:69-71`, `apps/web/app/api/internal/pilot/start-outcome/route.ts`, `apps/web/lib/apply/bundle-id.ts`); `enforceOrganizationMatch` on org-scoped reads; employer-notes leak fixed (PR #498). Residual: acceptance-history is an NPI-keyed public read **by design**; super-admin header bypass (4.1.2). |
| 4.2.2 | CSRF defense | Partial | Cross-origin `/api/*` requests 403 unless allow-listed (`apps/web/middleware.ts:110-126`); `SameSite=lax` cookies. No synchronizer-token layer. |
| 4.3.1 | Admin interfaces require appropriate MFA | Gap | `/admin/*` gated by role middleware only; no MFA step-up. |
| 4.3.2 | Directory browsing disabled; no metadata leak | Met | Next.js static handling; Express serves JSON APIs only. |
| 4.3.3 | Additional authorization for sensitive data | Partial | Audit-first mutation rule (7.2.2) + shadow RBAC; enforcement pending (4.1.3). |

---

## V5 — Validation, Sanitization and Encoding

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 5.1.1 | HTTP parameter-pollution defense | Partial | Array-valued params handled defensively where parsed (`organizationContext.ts:23-25`); no systematic HPP middleware. |
| 5.1.2 | Mass-assignment protection | Partial | Prisma writes use explicit field lists in reviewed routes; no request-schema layer to guarantee it (`validateRequest.ts` no-op). |
| 5.1.3 | Positive (allowlist) input validation | Partial | Strong in spots: UUID guards (4.2.1), env schemas (zod in `config/env.ts`), OTP email checks (`otpCore.ts:33-44`). Sparse overall: zod in only 8 backend modules, 0 web API routes; shared `validateRequest.ts:1-11` is a deliberate no-op. |
| 5.1.4 | Structured data strongly typed and validated | Partial | TypeScript end-to-end; runtime validation sparse as 5.1.3. Body size capped at 1 MB globally (`app.ts:3481-3482`). |
| 5.1.5 | URL redirects restricted to allowlist | Partial | Middleware redirects are constructed from same-origin `req.nextUrl.clone()` (`middleware.ts:64-103`); the `/auth/resolving` `redirect_url` round-trip has not been audited against external absolute URLs. |
| 5.2.1 | Untrusted HTML sanitized | N-A | No user-supplied HTML / WYSIWYG input surface. |
| 5.2.4 | No `eval()` / dynamic code execution | Met | No `eval`/`new Function` in app code (L1 sweep, unchanged). CSP still *allows* `'unsafe-eval'` for framework runtime — tracked at 14.4.3. |
| 5.2.5 | Template-injection defense | Met | JSX rendering only; no server-side string templates fed user input. |
| 5.2.6 | SSRF-resistant outbound requests | Partial | Outbound fetches target fixed catalog hosts (NPPES v2.1 pinned + boot assertion, `docs/ops/REBASELINE-2026-07-04.md`); no user-supplied URL fetch surface found; no central egress allowlist (cross-ref 12.6.1). |
| 5.2.7 | User-supplied SVG/scriptable content sanitized | Partial | The scriptable-markup sinks render self-generated content (`MatchaConstellation.tsx:356`, `EcosystemMap.tsx:85`) — needs a source audit confirming no user-controlled data reaches them. |
| 5.3.1 | Context-aware output encoding | Met | React 19 default escaping across `apps/web`. |
| 5.3.3 | Escaping at dynamic HTML sinks | Partial | Four `dangerouslySetInnerHTML` sites (see L1-correction #2). `JsonLd.tsx:8` injects `JSON.stringify(data)` into a script tag — needs `</script>`-sequence escaping if data ever becomes user-influenced; `ApiSandbox.tsx:128` injects `highlighted` — escape order needs review. |
| 5.3.4 | Parameterized queries only | Met | Prisma ORM throughout; raw SQL confined to tagged-template `$queryRaw`/`$executeRaw` (parameterized by construction: `app.ts:580,1139,1162,1235`, `qa/*`); no string-concatenated SQL found. |
| 5.3.8 | OS command injection protection | Met | `child_process` appears only at boot (`server.ts:5`, `spawnSync` for migrations); no request-path command execution. |
| 5.3.9 | Local/remote file-inclusion protection | Met | No dynamic `require`/`import` or fs reads from user input in request paths. |
| 5.5.2 | XML parsers restricted (XXE) | N-A | No XML-parsing surface. |
| 5.5.3 | Untrusted deserialization avoided | Met | `JSON.parse` only; no object-graph deserializers. |

---

## V7 — Error Handling and Logging

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 7.1.1 | No credentials/secrets in logs | Partial | OTP plaintext never stored or logged by design (`otpCore.ts:4-7,18`); API keys logged only as fingerprints (`publicSafety.ts:41-44`). Discipline is per-call-site — no global redaction filter in `obs/logger`. |
| 7.1.2 | No unnecessary sensitive data in logs | Partial | Source-health surfaces return safe metadata only (`apps/web/lib/source-health/`); audit entries document "sanitised … no secrets" fields (`auditLedger.ts`). Same per-call-site caveat. |
| 7.1.3 | Security-relevant events logged | Met | Structured audit ledger with AUTH/DECISION/REVOCATION/FEDERATION/… categories (`services/audit/auditLedger.ts`); denied-authn audit rows (`middleware/apiAuth.ts:218-233`). |
| 7.1.4 | Logs carry enough context to investigate | Met | `traceId` propagation + SHA-256 `receiptHash` integrity anchor per entry (`auditLedger.ts`); request ids in error responses (`errorHandler.ts`). |
| 7.2.1 | Authentication decisions logged | Partial | Denials audited where `requireAuth` is used (`apiAuth.ts:218-233`); Clerk-side auth logs are vendor-held; coverage not uniform across all routes. |
| 7.2.2 | Access-control decisions logged | Met | Audit-first mutation contract — AuditEvent written in-transaction **before** any 2xx (`routes/employerActions.ts:13-20`; independently verified in `docs/ops/REBASELINE-2026-07-04.md`); shadow-mode would-deny logs (`employerActions.ts:206-211`) and denied-mutation audit rows on the enforce path (`employerActions.ts:221-227`). |
| 7.3.1 | Log-injection defense | Met | Structured JSON logging (`obs/logger` event objects), not string concatenation. |
| 7.3.3 | Logs protected from modification | Partial | Ledger is append-only by design with per-entry hashes (`auditLedger.ts:1-13`); transparency reads are read-only endpoints (`docs/security/red-team-report.md` §9). No DB-level immutability constraint. |
| 7.4.1 | Generic error messages to clients | Met | Central handler returns normalized `{error:{code,message}}` and "Never leaks stack traces in production" (`middleware/errorHandler.ts:6-14`). |
| 7.4.2 | Expected exceptions handled deliberately | Met | `HttpError` + `asyncHandler` pattern (`utils/httpError.ts`; `routes/employerActions.ts:58-60`). |
| 7.4.3 | Last-resort error handler | Met | `errorHandler` registered as the final middleware ("MUST be last middleware registered", `errorHandler.ts:10`), reporting to Sentry. |

---

## V9 — Communication Security

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 9.1.1 | TLS for all client connectivity | Met | Railway edge TLS on `vitalcv.com`/`api.vitalcv.com`; HSTS 2-year `includeSubDomains; preload` (`security-headers.mjs:84-87`); `upgrade-insecure-requests` CSP directive (`:68`). |
| 9.1.2 | Strong TLS configuration (verified with tools) | Partial | Platform-managed by Railway; cipher/protocol config is not pinned or test-asserted in this repo. |
| 9.1.3 | Old TLS versions disabled | Partial | Same platform delegation as 9.1.2. |
| 9.2.1 | Server-to-server connections use trusted certs | Met | Node default certificate validation on all HTTPS fetches; zero `rejectUnauthorized`/`NODE_TLS_REJECT_UNAUTHORIZED` overrides anywhere in `apps/**/*.ts` (verified by grep). |
| 9.2.2 | Encrypted inbound/outbound incl. DB and management | Partial | Web↔backend HTTPS (`BACKEND_URL`, `CLAUDE.md`); CSP `connect-src` https-only (`security-headers.mjs:59`); `DATABASE_URL` TLS mode not pinned in repo. |
| 9.2.3 | External connections carrying sensitive data are authenticated | Partial | Bearer/secret gates on probe + webhook channels (`apps/web/lib/env.ts:100-126`); API keys on ingest writes; user-identity header gap (14.5.4) applies to web→backend. |

---

## V10 — Malicious Code

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 10.2.1 | No unauthorized phone-home / data collection | Met | Telemetry limited to PostHog (consent-gated, `apps/web/lib/env.ts:136-140`) and Sentry (DSN-gated, `:129-134`); CSP `connect-src` pins the exact hosts (`security-headers.mjs:59`). |
| 10.2.2 | No unnecessary permissions requested | Met | Permissions-Policy disables sensors/peripherals not used (`security-headers.mjs:71-81`). |
| 10.3.1 | Signed, secure auto-updates | N-A | Server-deployed web app; no client auto-update channel. |
| 10.3.2 | Code integrity protections (signing / SRI) | Partial | `pnpm-lock.yaml` + `--frozen-lockfile` in every CI install (`ci.yml:41` et al.); Docker images built from repo source. No SRI on CDN scripts and no image signing. |
| 10.3.3 | Subdomain-takeover protection | Partial | Delegated subdomains exist (`clerk.vitalcv.com` → Clerk, `api.vitalcv.com` → Railway); no documented DNS inventory or takeover monitoring. |

---

## V12 — Files and Resources

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 12.1.1 | Upload size limits | Met | multer `fileSize: 10 MB` (`routes/documents.ts:26-28`); global 1 MB JSON body cap (`app.ts:3481-3482`). |
| 12.1.2–12.1.3 | Compressed-file / decompression limits | N-A | No archive intake; ZIP is outbound export only (`services/entity/employerPacketExport.ts`). |
| 12.2.1 | File type validated against content | Partial | MIME allow-list double-checked beyond the multer filter (`documents.ts:81-89`) — but header-declared, not magic-byte content sniffing. |
| 12.3.1 | Filename path-traversal protection | Met | `memoryStorage` — user input never forms a filesystem path (`documents.ts:27`). |
| 12.4.1 | Files stored outside webroot | Met | Memory buffer → DB persistence; no webroot writes; no file-serving from user paths. |
| 12.4.2 | Malware scanning of uploads | Gap | No antivirus/malware scan on uploaded documents. |
| 12.5.1 | Only required file types served | Partial | Download surfaces are explicit routes with `Content-Disposition` set (`routes/employerActions.ts:857,866`); no general static-file serving of uploads, but no extension allowlist either. |
| 12.5.2 | Uploads not executed as content | Met | `X-Content-Type-Options: nosniff` (`security-headers.mjs:88-91`); uploads never served from the web app's origin as active content. |
| 12.6.1 | Egress allowlist for server-side requests | Partial | Fetch targets are fixed source-catalog hosts (NPPES v2.1 boot assertion, `docs/ops/REBASELINE-2026-07-04.md`); allowlist is by-construction, not enforced at a network/egress layer. |

---

## V13 — API and Web Services

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 13.1.1 | Consistent parsing across components | Met | JSON-only bodies (`express.json`, `app.ts:3481`); Next.js route handlers; no mixed parsers. |
| 13.1.3 | API URLs do not expose sensitive information | Partial | Public verify/acceptance surfaces are NPI-keyed **by design** (deliberate public claim surface; employer-notes leak already fixed, PR #498); share links use unguessable UUIDs with format guards (`routes/public.ts:176-179`). |
| 13.1.4 | Authorization at URI and resource level | Partial | Global tenant guard with an explicit public-prefix skip-list (`tenantGuard.ts:46-115`) + per-route checks; verifier RBAC enforcement still off (4.1.3); header-trust gap (14.5.4). |
| 13.1.5 | Requests with unexpected content rejected | Partial | 1 MB body cap; no strict Content-Type rejection middleware. |
| 13.2.1 | REST method restriction | Met | Methods registered per route (Express `app.get/post` definitions; Next `route.ts` exports); unmatched → 404/405. OpenAPI served at `/openapi.json` (`app.ts:3705-3706`) — supersedes the L1 "not yet generated" row. |
| 13.2.2 | JSON schema validation of requests | Partial | zod in 8 backend modules; 0 web API routes; `validateRequest.ts` no-op (5.1.3). |
| 13.2.3 | CSRF protection for cookie-authenticated APIs | Partial | Default-deny CORS gate on `/api/*` (`middleware.ts:110-126`) + `SameSite=lax`; no token layer (4.2.2). |
| 13.2.5 | REST services verify Content-Type | Partial | Same as 13.1.5. |
| 13.x | Anti-automation / rate limiting on public APIs (cross-ref V11.1.4) | Partial | Live limiters: `publicApiRateLimit` 100/10 min on public reads (`app.ts:2568,2841,2865,2900`), `trustStateRateLimit` per-minute (`app.ts:2932`; `config/env.ts:131`), OTP issue caps (`otpCore.ts:15-16`). **Keying gap:** counters are per-process in-memory Maps (reset on deploy; per-instance under scale-out) keyed by API-key id else `req.ip` (`publicSafety.ts:55-68`) — and no `trust proxy` is set in `app.ts`/`server.ts` (verified), so behind Railway's proxy `req.ip` may collapse to the proxy hop, sharing one bucket across all anonymous callers. |
| 13.3.x / 13.4.x | SOAP / GraphQL | N-A | Neither exists (REST only). |

---

## V14 — Configuration

| Req | Requirement (paraphrased) | Status | Evidence / gap |
|---|---|---|---|
| 14.1.1 | Repeatable, automated build | Met | turbo + `pnpm install --frozen-lockfile` (`ci.yml:41`, `monorepo.yml:50`); per-service Dockerfiles. |
| 14.1.3 | Web/app server configuration hardened | Met | `helmet()` on the API (`app.ts:3439`); single-source security headers for web (`security-headers.mjs`, asserted by `apps/web/__tests__/security-headers.test.ts`). |
| 14.1.4 | Automated deployment with health verification | Met | Railway auto-deploy on `main` + deploy workflows that wait and smoke-test (`.github/workflows/deploy-api.yml`, `deploy-web.yml`; `CLAUDE.md` deployment section). |
| 14.2.1 | Components up to date; SCA in pipeline | Gap | **Corrects the stale L1 row**: no dependency-audit step exists in any workflow, and no dependabot/renovate config (`.github/` verified). |
| 14.2.2 | Unneeded features/samples removed | Met | helmet removes `X-Powered-By`; demo mode cannot run in production (`config/env.ts:225-235`). |
| 14.2.3 | SRI for third-party assets | Gap | CDN scripts (Stripe, PostHog, Clerk, Turnstile) are host-pinned via CSP only (`security-headers.mjs:31-51`); no `integrity` attributes. |
| 14.2.4 | Components from trusted sources | Met | npm registry + committed `pnpm-lock.yaml`; frozen-lockfile installs. |
| 14.2.5 | SBOM maintained | Gap | None generated. |
| 14.3.2 | Debug modes disabled in production | Met | `YC_DEMO_MODE` in production throws at boot unless explicitly frozen (`config/env.ts:225-235`); `NEXT_PUBLIC_DEBUG_PANEL` is dev-only (`apps/web/lib/env.ts:167-171`); strict-transition startup guard (`red-team-report.md` §10). |
| 14.3.3 | No stack traces / detailed version leaks | Met | `errorHandler.ts` production-safe messages; helmet header hygiene. |
| 14.4.1 | Content-Type with safe charset | Met | Express JSON + Next defaults (`application/json; charset=utf-8`). |
| 14.4.2 | Content-Disposition on downloads | Met | Packet exports set it explicitly (`routes/employerActions.ts:857,866`). |
| 14.4.3 | CSP mitigating XSS | Partial | CSP present and strong on `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action` (`security-headers.mjs:53-69`) — but `script-src` allows `'unsafe-inline'` + `'unsafe-eval'` for the framework runtime, documented with a nonce-migration note (`security-headers.mjs:14-17,25-26`). |
| 14.4.4 | X-Content-Type-Options: nosniff | Met | `security-headers.mjs:88-91`. |
| 14.4.5 | HSTS with includeSubdomains + preload | Met | `max-age=63072000; includeSubDomains; preload` (`security-headers.mjs:84-87`). |
| 14.4.6 | Referrer-Policy | Met | `strict-origin-when-cross-origin` (`security-headers.mjs:96-99`). |
| 14.4.7 | Anti-clickjacking (frame-ancestors / XFO) | Met | `X-Frame-Options: DENY` (`:92-95`) + CSP `frame-ancestors 'none'` (`:64`). |
| 14.5.1 | HTTP method allowlist | Met | Per-route method registration only; nothing wildcard-mounted. |
| 14.5.2 | Origin header not used for authn/authz | Met | Origin is only ever used to **deny** (CORS gate, `middleware.ts:115-126`); no trust decisions read it. |
| 14.5.3 | CORS strict allowlist | Met | Web: default-deny `ALLOWED_CORS_ORIGINS` allowlist — empty means all cross-origin API calls blocked (`lib/security/corsAllowlist.ts:1-11`; `middleware.ts:110-126`). Backend: wildcard banned in production (`config/env.ts:111-118`; `app.ts:3444-3452`). Supersedes the L1 FOUNDATION row. |
| 14.5.4 | Proxy/SSO-added HTTP headers authenticated | Gap | The backend trusts identity-bearing headers without verification: an asserted user id grants authenticated context (`middleware/authMiddleware.ts:4-11`; `routes/employerActions.ts:63-67`), asserted role claims bypass org-scope checks (`tenantGuard.ts:153-167`), and org context is accepted from caller-supplied request attributes (`organizationContext.ts:20-40`). The trust boundary is the API origin, which is directly addressable. [Request shape withheld — see internal gap register.] This is the highest-priority authn gap (Wave 2C follow-up). |

---

## Summary

| Status | Count |
|---|---:|
| Met | 67 |
| Partial | 64 |
| Gap | 11 |
| N-A | 9 |
| **Total rows scored** | **151** |

Of the 142 applicable rows: **47% Met, 45% Partial, 8% Gap**. Read this as an
honest midpoint: the header/config, error-handling, crypto-adjacent, and
audit-logging chapters are strong; the systemic weaknesses are concentrated
in **who the backend believes the caller is** (14.5.4 / 4.1.2), **enforcement
switched off** (4.1.3), and **pipeline supply-chain checks** (14.2.x / 1.14.3).

## Known gap register

The gaps that matter, in priority order. Nothing below is hidden in a Partial cell.

| # | Gap | Where | Tracking |
|---|---|---|---|
| G1 | Header-trust authentication: backend accepts caller-asserted identity, role and organization attributes without cryptographic verification | `authMiddleware.ts:4-11`, `tenantGuard.ts:153-167`, `organizationContext.ts:20-40` | **Remediation landed 2026-07-06:** `middleware/verifiedIdentity.ts` (Clerk JWKS verification, `CLERK_JWT_VERIFICATION=off/shadow/enforce`, 18-case suite; enforce rewrites `x-clerk-user-id` from the verified `sub` and strips role-bypass headers on unverified requests). Gap stays OPEN until the flag reaches `enforce` — rollout: `docs/security/verified-jwt-rollout.md`. Scored 14.5.4 / 4.1.2 |
| G2 | Verifier RBAC enforcement OFF (shadow mode) — mutations by non-permitted roles are logged, not blocked | `config/env.ts:151-155`, `employerActions.ts:206-211`, `apps/web/lib/verifier/orgRolesFoundation.ts` | Launch blocker #2; flag flip after shadow review |
| G3 | ~~Rate-limit keying: per-process in-memory counters, `req.ip` fallback with no `trust proxy` configured~~ **Partially closed 2026-07-06:** `app.set('trust proxy', 1)` landed (PR #586), so `req.ip` resolves to the real client behind Railway's edge. **Further closed 2026-07-20 (S3):** five of six `/api/passport/*` routes had *no limiter at all* (only `/trust` did) — the record read, disclose, both badge lanes and the full export were unmetered on a public NPI-addressable surface; `verify-professional` (both methods) and the OCR/AI document lanes were likewise unlimited. All now carry tiers. Buckets key by verified user id **only** under `CLERK_JWT_VERIFICATION=enforce` (keying on a caller-supplied header before that is worse than no limiter), degrading to API key then IP, with the applied scope advertised in `x-rate-limit-scope`. 429s now carry `Retry-After` + limit/window/scope. **Counters remain per-process in-memory** — with N instances the effective limit is N x configured. | `middleware/rateLimitFactory.ts`, `routes/passport.ts`, `routes/verifyProfessional.ts`, `routes/documents.ts`; suite `middleware/__tests__/rateLimitFactory.test.ts`; docs `docs/security/rate-limiting.md`. Residual: `publicSafety.ts:55-68` + `rateLimiter.ts:19` still hold separate in-memory stores | Distributed (Redis) store = follow-up, gated on horizontal scale-out; scored V13 rate-limit row |
| G4 | ~~Unsalted claim digests exposed publicly: raw SHA-256 `claimHashes` are dictionary-testable if the underlying claim payloads are low-entropy~~ **Closed 2026-07-07:** `extractPublicAuditHashes` now emits `HMAC-SHA256(leaf, CLAIM_DIGEST_HMAC_SECRET)` and **fails closed** (exposes nothing) when no secret is set; the raw anchored leaves never leave the trust boundary. 6-case suite `routes/__tests__/publicAuditHashes.test.ts`. Owner: set `CLAIM_DIGEST_HMAC_SECRET` on Railway to re-enable exposure (optional; default = no exposure). | `routes/public.ts` (`extractPublicAuditHashes`), `utils/deterministic.ts` (`hmacSha256Hex`) | Closed |
| G5 | No e2e signup happy-path or fail-closed test (BLOCKED passport acceptance) | no playwright/cypress config anywhere in repo (verified) | Launch blocker #4 |
| G6 | ~~Hardcoded `'development-secret'` JWT fallback; no production guard requires `JWT_SECRET`~~ **Closed 2026-07-05:** legacy HS256 util deleted (`auth/jwt.ts` removed; `organizationContext.ts` no longer parses bearer tokens; `JWT_SECRET` no longer read anywhere) | `middleware/__tests__/organizationContext.test.ts` pins the behavior | Closed; 2.10.2 re-scored Met |
| G7 | Shared request-validation middleware is a no-op; schema validation sparse (0 zod in web API routes) | `middleware/validateRequest.ts:1-11` | Scored 5.1.3 / 13.2.2 |
| G8 | No SCA/dependency audit, no SAST, no SBOM, no SRI in the pipeline | `.github/workflows/` (verified listing), `.github/` (no dependabot) | Scored 14.2.1/14.2.3/14.2.5, 1.14.3 |
| G9 | No MFA step-up on `/admin/*`; Clerk prod factor/OAuth config unverifiable from repo | `apps/web/middleware.ts` (role gate only) | Scored 4.3.1; launch blocker #3 |
| G10 | Wave-125 `apiAuth.ts` module is fail-open with in-memory key/session stores — must not be mistaken for production authn | `middleware/apiAuth.ts:41-53,106,208-212` | Consolidate under 1.2.3 |
| G11 | Containers run as root (no `USER` directive) | `apps/api/Dockerfile`, `apps/web/Dockerfile` | Scored 1.2.1 |
| G12 | No malware scanning on document uploads | `routes/documents.ts` | Scored 12.4.2 |
| G13 | ~~Fabricated verification data: the deterministic `NursysStubAdapter` derives license statuses from NPI digits and was served for every `NURSYS` verification (`REAL_NURSYS_ENABLED` off), letting live seams persist fabricated `VerificationArtifact` rows and present them as `VERIFIED` (share verify, audit bundles, daily monitoring re-verify; plus the unmounted wave2a `POST /api/v2/verify`)~~ **Closed 2026-07-12:** `sourceRegistry` refuses non-decision-grade adapters in production (`SourceAccessRequiredError`); the live seams fail closed with an honest `SOURCE_ACCESS_REQUIRED` state; `isDecisionGradeArtifact` downgrades any pre-existing stub-origin row on read; monitoring never overwrites decision-grade artifacts with stand-in data; the wave2a module (zero callers, never mounted) was deleted outright. Prod DB audited 2026-07-12: zero fabricated rows existed (21 `NURSYS` rows are quarantined gated-ingest rows). Dev/test keep the stub as pipeline stand-in. Suites: `__tests__/sourceAccessFailClosed.test.ts`, `src/services/__tests__/monitoringEngineFailClosed.test.ts` | `services/sourceRegistry.ts`, `services/artifactDecisionGrade.ts`, `app.ts` (share verify + bundle routes), `services/monitoringEngine.ts` | Closed |

## Update cadence

Same rule as the L1 scorecard: any PR touching a control cited here must
update the affected row(s) with the new evidence in the same PR. When G1–G4
close, re-score chapters V4, V13, V14 and refresh the summary counts.

## References

- OWASP ASVS v4.0.3 — https://owasp.org/www-project-application-security-verification-standard/
- L1 scorecard: `docs/security/asvs-scorecard.md` (chapters V6/V8/V11 remain scored there)
- Red-team simulation report: `docs/security/red-team-report.md`
- Canonical open blockers: `docs/ops/launch-blockers.md`
- Wave 0 re-baseline (evidence method): `docs/ops/REBASELINE-2026-07-04.md`
