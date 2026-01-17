# VitalCV Architecture (As-Is)

Last updated: 2026-01-14
Source of truth: `.ai/snapshot.md`

## Canonical Scope

- `ctol3r/vitalcv` is the single source of truth for the platform.
- If something is not present in this repo, it is not part of the current system.

## Monorepo Boundaries

### Apps (runtime surfaces)

- `apps/web` — Primary frontend (Next.js / React).
- `apps/api` — Primary backend API (Node / TS).

Other app directories in `apps/` are in-repo services that support the platform; they are not external repos.

### Packages (shared domains)

Expected domain packages per the operational snapshot:

- `packages/ui` — Shared UI components / design system.
- `packages/config` — Shared TS configs, linting, env helpers.
- `packages/credentials` — VC schemas, issuance helpers, verification logic.
- `packages/identity` — DID logic, key management abstractions.
- `packages/compliance` — Audit logging and compliance scaffolding.

If any expected domain package is missing, it must be implemented inside this repo (no external dependency).

### Services (internal utilities)

`services/*` contains internal services and cross-cutting capabilities (observability, logging, queueing, etc.) that are part of the monorepo.

### Other top-level areas

- `blockchain/` — Substrate and blockchain integrations.
- `docs/` — Documentation.
- `infra/` — Infrastructure definitions and env mapping.

## Runtime Boundaries

### In-Repo (Canonical)

- Frontend web application
- Backend API services
- Credential issuance & verification logic
- Identity / DID abstractions
- Job matching logic
- Compliance scaffolding
- CI/CD definitions
- Documentation

### Explicitly Not Present

- No dependency on other VitalCV repos at runtime
- No external monorepos
- No shared code pulled from legacy repos
- No on-chain PHI storage

## Tooling (Canonical)

- Package manager: `pnpm`
- Orchestration: Turborepo (`turbo.json`)
- Root entry points: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`
