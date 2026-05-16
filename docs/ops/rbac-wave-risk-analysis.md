# RBAC Wave 2 — Risk Analysis
**Wave:** Wave 2 — Verifier RBAC Hardening  
**Date:** 2026-05-07  
**Classification:** HIGH_RISK  
**Status:** Planning only  

---

## Pre-Implementation Risk Classification

Wave 2 is HIGH_RISK overall due to auth path changes. Individual PRs are classified:

| PR | Classification | Reason |
|---|---|---|
| W2-PR1 | HIGH_RISK | `middleware.ts` modification — auth routing change |
| W2-PR2 | HIGH_RISK | Employer-review mutation gate — trust chain path |
| W2-PR3 | HIGH_RISK | Auth guards on previously unguarded routes |
| W2-PR4 | GUARDED | New routes only — foundation, not live activation |

**Scope lock:** All Wave 2 PRs combined touch exactly:
- `apps/web/middleware.ts` (W2-PR1 only)
- `apps/web/lib/auth/` (W2-PR1 + W2-PR3)
- `apps/web/app/api/employer-review/` (W2-PR2 only)
- `apps/web/app/api/audit/`, `apps/web/app/api/psv/`, `apps/web/app/api/hiring/`, `apps/web/app/api/employer/` (W2-PR3)
- `apps/web/app/api/verifier/`, `apps/web/app/verifier/` (W2-PR4)

**Not touched:** `prisma/schema.prisma`, `packages/crs/`, `packages/trust-state/`, `lib/issuer-verification/`, any clinician or passport routes.

---

## Risk Register

### RISK-01: Middleware Rebase Breaks Existing Auth Guards
**Probability:** Medium  
**Impact:** HIGH — could remove auth from existing protected routes  
**Mitigation:** Codex diff audit must confirm all existing `PROTECTED_ROUTES` patterns are preserved. Run vitest auth tests post-rebase. If any pattern is dropped, revert immediately.  
**Trigger for revert:** Any authenticated route returning 200 without credentials.

### RISK-02: Role Check Breaks Demo/Pilot Walkthroughs
**Probability:** Medium-High  
**Impact:** MEDIUM — founder can't demo without VERIFIER role claim in JWT  
**Mitigation:** Before W2-PR2 merge, confirm founder Clerk account has `vitalcv.role: VERIFIER` in `publicMetadata`. If not, add it before merge. This is a Clerk admin action, not a code change.  
**Action required:** Verify founder's role claim in Clerk dashboard before merging W2-PR2.

### RISK-03: OrgId Not Present in Demo Clerk Session
**Probability:** High  
**Impact:** MEDIUM — employer-review mutations fail 403 in demo  
**Mitigation:** W2-PR2 must check `orgId` is present in the Clerk session. If demo mode uses a personal (non-org) session, add a `DEMO_ORG_ID` env bypass for pilot sessions only. OR: ensure the demo Clerk account is enrolled in a demo org.  
**Action required:** Verify demo Clerk account has an org context before merging W2-PR2.

### RISK-04: Backend Proxy Doesn't Validate `x-clerk-org-id`
**Probability:** High  
**Impact:** MEDIUM — org header is forwarded but not enforced backend-side  
**Mitigation:** W2-PR2 forwards `x-clerk-org-id` to the backend. The backend (apps/api) must be updated separately to validate this header. Until that backend change, the org check is enforced at the web API layer only. This is acceptable for pilot — document it explicitly.  
**Documented limitation:** "Org-scoped acceptance enforcement is web-layer only until apps/api backend validates x-clerk-org-id."

### RISK-05: Auth Guard on `/api/audit/events` Breaks Ops Dashboard
**Probability:** Medium  
**Impact:** MEDIUM — internal ops surfaces that call `/api/audit/events` stop working  
**Mitigation:** ADMIN role check added. Confirm all surfaces that call this endpoint are in the `/internal/*` route group (which requires ADMIN via middleware). If any non-internal surface calls audit events, identify it before adding the guard.  
**Action required:** `grep -rn "audit/events" apps/web/app components --include="*.tsx"` before W2-PR3 implementation.

### RISK-06: OIG/Hiring Auth Guard Breaks Public Verification Flows
**Probability:** Low  
**Impact:** HIGH — if any public surface (e.g., passport page, review page) calls PSV routes directly  
**Mitigation:** Audit all callers of `/api/psv/*` and `/api/hiring/*` before adding guards. If a public surface is calling these, that surface must be refactored to use an authenticated client route first.  
**Action required:** `grep -rn "psv/oig\|hiring/accept\|hiring/start" apps/web/app components --include="*.tsx"` before W2-PR3.

### RISK-07: Timing-Safe Comparison Not Implemented
**Probability:** Medium  
**Impact:** HIGH — timing oracle in cross-tenant orgId comparison  
**Mitigation:** `orgInvitations.ts` (W2-PR1) must use `timingSafeEqual` from `node:crypto` for any string comparison that could leak org membership information. Codex must explicitly verify this.

### RISK-08: Verifier Invitation Without Proper Expiry
**Probability:** Low  
**Impact:** MEDIUM — invitation codes don't expire  
**Mitigation:** W2-PR4 must include expiry logic. Codex verifies invitation state machine includes `expired` state.

---

## Rollback Strategy

### Per-PR Rollback

Each PR is independently revertable:
```bash
# Revert a specific PR
gh pr revert <PR_NUMBER> --title "revert: [PR title]"
# The revert itself requires Codex SAFE before merging
```

### Wave-Level Rollback Order

If multiple PRs have merged and a critical regression is found:
```
1. Revert W2-PR4 first (lowest risk, foundation only)
2. Revert W2-PR3 (API guards — safe revert)
3. Revert W2-PR2 (employer-review role check)
4. Revert W2-PR1 last (middleware — highest risk revert)

Never revert in reverse order (W2-PR1 first) — creates a window where 
employer-review role check references a type that no longer exists.
```

### Rollback Triggers

Automatically revert without investigation if:
- Any existing authenticated page route returns 200 without credentials after W2-PR1 merge
- A VERIFIER-role user returns 403 on a legitimate accept action after W2-PR2 merge
- Audit events return 403 to ADMIN users after W2-PR3 merge
- Any CLINICIAN-role user successfully calls `accept` after W2-PR2 merge

Investigate before reverting if:
- Ops surface that was calling an unguarded route now returns 401 (expected behavior, but surface needs updating)
- Demo walkthrough fails due to missing org context (fix in Clerk, not a revert)

---

## Non-Negotiable Invariants

These must be true before AND after every Wave 2 PR merge:

1. `isPublicRoute('/api/anything')` returns `true` (API routes self-auth — no regression here)
2. `/verifier/*` page routes require VERIFIER role (middleware)
3. `/issuer/*` page routes require ISSUER role (middleware)
4. `/internal/*` page routes require ADMIN role (middleware)
5. `decisionGrade: false` on receipt candidate (untouched by Wave 2)
6. AuditEvent write fires before 2xx on accept action (Wave 2 must not remove this)
7. No banned strings in any new copy introduced

---

## Architectural Constraints

### What Wave 2 does NOT solve (explicitly out of scope)

| Gap | Reason deferred | Wave to address |
|---|---|---|
| Backend org validation (`x-clerk-org-id` enforcement in apps/api) | Requires backend changes + potentially schema | Wave 3+ |
| Full ABAC (attribute-based access control) | Complex; not needed for pilot | Post-pilot |
| Verifier invite system going live (`invitationSystemLive: true`) | Separate flag flip PR, after pilot confirms need | Post-pilot |
| All unguarded intelligence/graph routes behind stricter auth | Currently AUTHENTICATED (any user) — acceptable for pilot | Post-pilot |
| Prisma-backed permission rows | Requires schema migration | Founder decision |
| Session expiry and rotation | Clerk handles; out of scope | Clerk configuration |
