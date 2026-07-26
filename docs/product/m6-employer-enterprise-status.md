# M6 — Employer Enterprise Surface & Workspace Graph — Status

**Date:** 2026-07-06

## Shipped this wave

- **M6-1 (partial) — workspace switch is now audited.** `/api/workspaces/switch`
  writes a durable `WORKSPACE_SWITCH` AuditEvent before returning 2xx (doctrine
  anti-drift #2). This also **closes an M1-2 P0 audit gap** — `workspace.ts` drops
  out of the audit-coverage baseline (93 → 92). Backend typecheck clean.

## Already present on main (Wave 180 runtime)

The Prisma models (`PersonProfile`, `OrganizationProfile`, `WorkspaceMembership`)
and the runtime exist: `workspaceService.ts` (`switchWorkspace`, `getWorkspacesForUser`,
`bootstrapFromNpi`, `ensureWorkspaceUser`), routes `/api/me/workspaces`,
`/api/workspaces/switch`, `/api/identity/bootstrap/:npi`. So M6-1's core switching
was built — this wave added the missing audit.

## Follow-up (large builds / external — not completed here)

| Item | Disposition |
|---|---|
| **M6-2 Team management** | Invite flow + seat/role assignment (needs M3-2 RBAC enforcement, which is shadow-mode). Real build. |
| **M6-3 Review GA hardening** | Reviewer queue + decision-capsule replay + refresh tracking. `employerActions.ts` is the audited core; UI build remains. |
| **M6-4 Packet export** | Audit-ready PDF/JSON evidence packet. Partial packet builder exists (`packet.manifest` in employerActions); committee-grade export is a build. |
| **M6-5 Notifications** | Transactional email (refresh-complete, packet-shared, license-expiring, acceptance). New service. |
| **M6-6 Admin operator console** | `apps/admin-api` + `/admin/platform` (Ops Center V1) exist; org mgmt + audit search + impersonation-with-audit is a build. |
| **M6-7 Billing & entitlements** | **External** — Stripe integration + entitlement enforcement + invoicing. Cannot be completed in-repo without Stripe keys + pricing wiring. |
| **M6-8 Partner SDK GA** | `packages/sdk` + `packages/embed-sdk` exist; versioning + API-key scoping + quickstart docs remain. |

## Assessment

The surgical, high-value slice (audit the workspace switch — a real gap that also
advances M1-2) is shipped and verified. The rest of M6 is multi-day enterprise
feature work, and M6-7 billing is genuinely external (Stripe).
