# VitalCV Architecture (As-Is)

This document describes the **current** VitalCV repository layout at a high level.

- **Authoritative snapshot**: [`.ai/snapshot.md`](../../.ai/snapshot.md)
- **Scope**: `apps/web`, `apps/api`, and `packages/*`
- **Non-goal**: future/planned architecture

## `apps/web` (Frontend)

`apps/web` is the primary web frontend (Next.js / React) and is the canonical UI surface.

## `apps/api` (Backend)

`apps/api` is the canonical backend API surface (Node / TypeScript) for VitalCV.

## Other `apps/*` directories present (not described here)

In addition to `apps/web` and `apps/api`, the following app directories currently exist in `apps/`:

- `apps/admin-api`
- `apps/authz`
- `apps/compliance-api`
- `apps/docs`
- `apps/issuer-api`
- `apps/router`
- `apps/sample-api`
- `apps/status-api`
- `apps/verifier-api`

This list is intentionally descriptive-only (presence), not an endorsement of runtime status or ownership.

---

## `packages/*` (Shared libraries)

`packages/` contains shared libraries and utilities consumed across the monorepo.

Current package directories present:

- `packages/agent-core`
- `packages/auto-tag`
- `packages/command-registry`
- `packages/domain-common`
- `packages/domain-identity`
- `packages/domain-provider`
- `packages/generated-api-types`
- `packages/logging`
- `packages/logging-core`
- `packages/messaging-guard`
- `packages/metrics-core`
- `packages/oidc-utils`
- `packages/partner-sdk`
- `packages/public-api-client`
- `packages/queue-core`
- `packages/redis-client`
- `packages/shared`
- `packages/shared-utils`
- `packages/ui`
- `packages/vc-formats-csdjwt`
- `packages/vc-schemas`
- `packages/vitalcv-ci`
- `packages/vitalcv-cli`
- `packages/vitalcv-plugin-sdk`

### Canonical domain package names from the snapshot

The operational snapshot defines canonical domain package names. **If a domain package is absent, that domain is missing in-repo** (it is not an external dependency).

As of the current repo state:

- **Present**: `packages/ui`
- **Not present as directories**: `packages/config`, `packages/credentials`, `packages/identity`, `packages/compliance`

---

## Other top-level directories present (context only)

This repo also contains additional top-level directories, including:

- `blockchain/`
- `docs/`
- `infra/`
- `k8s/`
- `scripts/`
- `services/`

These are listed for context only; they are outside the scope of this document.

---

## Explicitly NOT present (current runtime boundary)

Per [`.ai/snapshot.md`](../../.ai/snapshot.md), the current system explicitly does **not** include:

- Dependency on other VitalCV repositories at runtime
- External monorepos
- Shared code pulled from legacy repositories
- On-chain PHI storage
