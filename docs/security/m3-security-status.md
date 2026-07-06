# M3 — Enterprise Security Baseline — Status

**Date:** 2026-07-06
**Anchor:** `origin/main`. Canonical gap register: `docs/security/ASVS-scorecard-2026-07.md`
(gaps **G1–G12**). This wave closes the safe, code-doable gaps and documents the
rest with an honest disposition.

## Already done on main (verified — not re-done)

- **M3-8 SCA + Dependabot** — `security-audit.yml` (critical-only SCA gate) +
  `.github/dependabot.yml` landed via #572. **Done.**
- **M3-6 HTTP hardening** — strong web headers (`security-headers.mjs`: HSTS 2y+preload,
  X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`,
  `object-src 'none'`, `upgrade-insecure-requests`); API uses `helmet()` + structured
  CORS allowlist. Only relaxation is documented `unsafe-inline/eval` for Next 15 RSC +
  Clerk (nonce migration tracked). **Effectively done** (grade-A baseline; prod verified live).

## Shipped this wave

| Gap | Fix | File |
|---|---|---|
| **G3** rate-limit keying (per-process, no trust-proxy → all anons share one `req.ip` bucket) | `app.set('trust proxy', 1)` — trust exactly Railway's 1 edge hop so `req.ip` = real client; spoofed XFF is overwritten by the proxy | `apps/api/backend/src/app.ts:3440` |
| **1.2.1** containers run as root | `USER node` on both Dockerfile runtime stages (API: read-only, clean; web: `--chown=node:node` on `.next` for cache writes) | `apps/api/Dockerfile`, `apps/web/Dockerfile` |

## Documented — NOT implemented (with reasons)

- **G1 header-trust authentication (highest priority, deferred by design).** Backend
  trusts `x-clerk-user-id` / `x-user-role:super-admin` / `x-org-id` without crypto
  verification (`middleware/authMiddleware.ts`). The correct fix — verify a Clerk
  **session JWT** server-side (issuer/audience/exp) and derive identity+org from
  verified claims — is a **breaking change to the web→backend trust contract** (web
  currently sets these headers *after* Clerk auth). It needs: a network boundary so
  only the web tier can reach the API, or mTLS/signed service tokens between web and
  API, plus a staged rollout. Too risky to change blind on a live auth path; **needs
  an owner-reviewed design + staging test.** Tracked as launch-blocker / Wave 2C.
- **G2 verifier RBAC enforcement (rollout-gated, not a code gap).** The RBAC decision
  core runs in **shadow mode** (`VERIFIER_RBAC_ENFORCED=false`) — denials are logged,
  not blocked, *by design* pending shadow-telemetry review (launch blocker #2). Flip
  is an **operational decision after reviewing shadow logs**, not a code change I
  should make unilaterally.
- **Web/Nixpacks container user.** The `USER node` Dockerfile changes harden the
  **alternative** builder; the **canonical Railway builder is Nixpacks**
  (`nixpacks.toml`/`railway.toml`), which builds as root and is non-trivial to run
  non-root. Real prod container-user hardening is a **Nixpacks follow-up**.
- **G4 unsalted claim digests** (`routes/public.ts` exposes raw SHA-256 claimHashes) —
  fix is HMAC/salt before exposure; medium change, follow-up.
- **14.2.3 SRI** (no `integrity` on CDN scripts) and **14.2.5 SBOM** — infra follow-ups.
- **M3-2 RBAC breadth / M3-3 tenant-isolation Prisma extension / M3-5 zod-everywhere**
  — large per-route builds; the middleware primitives exist (`tenantGuard`,
  `employerActionRbac`) but blanket enforcement + a cross-tenant deny-matrix test suite
  is multi-day work.

## Assessment

The two safe, high-value gaps (G3 rate-limit keying, container non-root) are shipped.
The highest-priority gap (G1 header-trust) is real but is a deliberate,
owner-gated auth-model change, not a blind edit. Security posture on main was
already stronger than the plan assumed (SCA + headers done).
