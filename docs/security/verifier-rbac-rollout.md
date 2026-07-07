# Verifier org-role RBAC — enforcement & rollout

**Closes:** launch blocker #2 (`docs/ops/launch-blockers.md`) — *"Verifier org-role RBAC enforcement — no role checks on mutating verifier routes."*

**Status:** guard + web plumbing landed on `main` (guard **#591**, `x-org-role` forwarding **#593**), gated **off** by default — zero runtime change. **All code is in place; the remaining steps are Railway ops flips** (shadow → enforce), starting at step 3 below.

---

## What this adds

A backend guard, `requireOrgRole(...)`, in `apps/api/backend/src/middleware/orgRoleGuard.ts`, applied to the three verifier **mutation** routes that previously had *no* role check:

| Route | Mutates | Guard |
|---|---|---|
| `PATCH /api/applications/:appId/review` | application status → REVIEWED/ACCEPTED/DECLINED + decision capsule | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |
| `POST /api/applications/:appId/workflow-action` | accept / request_info / reject workflow | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |
| `POST /api/verifier/accept` | credential-presentation acceptance + audit entry | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |

## Role model

The canonical vocabulary lives in `apps/web/lib/verifier/orgRolesFoundation.ts` and is mirrored on the backend as `OrgRole`:

| Role | May mutate? | Intent |
|---|---|---|
| `admin` | ✅ | org owner — full verifier authority |
| `reviewer` | ✅ | can review applications and run workflow actions |
| `read_only` | ❌ | view-only member; the whole point is view-without-mutate |

`VERIFIER_MUTATION_ROLES = ['admin', 'reviewer']`. `super-admin` (platform operator, resolved from the existing `x-user-role` header via `isSuperAdminRequest`) bypasses org-role checks.

## Modes — `VERIFIER_RBAC_MODE`

Read per-request (an ops flip takes effect without a redeploy):

- **`off`** (default) — no-op. Guard calls `next()` immediately. **This is what merges.**
- **`shadow`** — evaluate the check; on a would-be denial, emit a structured `verifier_rbac_shadow_would_block` log line and **allow the request through**. Observe before enforcing.
- **`enforce`** — on an insufficient or missing org-role, respond `403 { error: 'insufficient_org_role' }`. **Fail-closed:** a request with no resolvable org-role is denied.

## Trust boundary — read before trusting this as a control

The guard reads the caller's org-role from the **`x-org-role`** request header. A header is only as trustworthy as the layer that sets it:

- **Today (UI path):** the Next.js proxy verifies the Clerk session before forwarding, so for real UI traffic the header reflects a verified `org_role` claim. This is genuine defense-in-depth.
- **The gap:** the Express backend does not itself verify the caller yet, so a crafted request sent **directly** to the backend with a spoofed `x-org-role` would pass. That is the same header-trust gap tracked as **G1 / verified-identity middleware (PR #589, `CLERK_JWT_VERIFICATION`)**.
- **Hard boundary:** reached when G1 is at `enforce` and strips/rewrites client-supplied identity headers (populating `x-org-role` from the verified JWT). This guard is forward-compatible: it already reads `x-org-role`, so G1 becomes its trusted source with no change here.

**Do not describe this as a complete authorization boundary until G1 is at enforce.** Until then it is: (a) a real fix for the "no role check at all" gap, and (b) defense-in-depth for the UI path.

## Rollout sequence

1. **✅ Done — PR #591 (merged).** Guard landed, gated `off`. Backend unit tests green (`orgRoleGuard.test.ts`, 11 cases). No runtime change.
2. **✅ Done — PR #593 (merged).** Plumb `x-org-role` from the verified Clerk session (`org_role` claim), server-side, never a client-supplied value. Correction to the original plan: the two `applications` proxies **do** share a header-builder — `review` and `workflow-action` both use `buildMarketplaceHeaders` (`apps/web/lib/server/marketplace-proxy.ts`), so `x-org-role` was added there once (it also forwards `x-user-role`, so the super-admin bypass keeps working through these proxies). `POST /api/verifier/accept` had **no** server proxy — its only caller, the archived `components/verifier/AcceptancePanel.tsx`, hit the backend directly — so `apps/web/app/api/verifier/accept/route.ts` was added and the panel repointed to it. `x-org-role` is strictly the `org_role` claim (the org-membership role), not the app role, which the guard would reject.
3. **← NEXT ACTION. `VERIFIER_RBAC_MODE=shadow`** on Railway (web + backend). Watch `verifier_rbac_shadow_would_block` logs: confirm legitimate `admin`/`reviewer` traffic is **not** appearing (i.e., the header is arriving and correct), and that only genuine read-only/anonymous attempts show up.
4. **`VERIFIER_RBAC_MODE=enforce`** once shadow is quiet for legitimate traffic. Flip `orgRolesFoundation.rbacEnforced` → `true` in the same change (and update its foundation test).
5. **Tighten with G1**: once `CLERK_JWT_VERIFICATION=enforce`, confirm G1 sets `x-org-role` from the verified claim and strips client-supplied identity headers — that closes the trust-boundary caveat above.

## Guardrails preserved

- Audit-first mutations, canonical path, revoked/expired/missing fail-closed — unchanged; this only adds an authz gate in front.
- Default `off` ⇒ no behavior change on merge; safe to land ahead of the rollout.
- Fail-closed in `enforce`: missing/unknown org-role ⇒ 403, never an implicit allow.
