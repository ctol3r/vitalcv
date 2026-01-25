# VitalCV — Tier-3 Operational Snapshot (As-Is)

Last Updated: 2026-01-07
Status: Authoritative for operational decisions until superseded

---

## 1. Canonical Repository

- **Repository:** ctol3r/vitalcv
- **Role:** Single authoritative monorepo for the VitalCV platform
- **All active development must occur here**
- Other VitalCV-related repositories are legacy / reference-only

If it is not present in this repository, it is not part of the current system.

---

## 2. Monorepo Layout (As-Is)

### apps/

Canonical application surfaces. Expected to exist or be created here only.

- `apps/web`

  - Primary frontend (Next.js / React)
  - Clinician + Employer + Issuer UI
  - Canonical UI surface

- `apps/api`
  - Backend API (Node / TS)
  - VC issuance, verification, job matching, auth
  - Canonical backend surface

(Other apps may be introduced **only** if clearly justified and documented.)

---

### packages/

Shared libraries and domain logic.

Expected / canonical package domains (some may be stubs or partial):

- `packages/ui`

  - Shared UI components / design system

- `packages/config`

  - Shared TS configs, linting, env helpers

- `packages/credentials`

  - VC schemas, issuance helpers, verification logic
  - W3C VC / OID4VCI / OID4VP aligned

- `packages/identity`

  - DID logic, key management abstractions
  - NPI-anchored identity workflows

- `packages/compliance`
  - Audit logging, policy helpers, compliance scaffolding
  - NCQA / SOC2 / HIPAA-adjacent constructs (no PHI)

Not all packages may be fully implemented yet; absence implies **missing domain**, not external dependency.

---

## 3. Tooling Expectations

### Package Management

- **pnpm** is the required package manager
- Single lockfile at repo root only
- No `package-lock.json` or `yarn.lock` files allowed anywhere

### Monorepo Orchestration

- **Turborepo** is canonical
- `pnpm-workspace.yaml` defines all workspaces
- `turbo.json` defines build/test/lint pipelines

### Entry Points (Expected)

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm test`

Exact scripts may evolve but must live at repo root.

---

## 4. Runtime Boundaries

### In-Repo (Canonical)

- Frontend web application
- Backend API services
- Credential issuance & verification logic
- Identity / DID abstractions
- Job matching logic
- Compliance scaffolding
- CI/CD definitions
- Documentation

### Explicitly NOT Present

- No dependency on other VitalCV repos at runtime
- No external monorepos
- No shared code pulled from legacy repos
- No on-chain PHI storage

If functionality is missing, it must be implemented **inside this repo**.

---

## 5. Known Legacy Repositories (Reference-Only)

These names may appear in comments, docs, or old code and should be purged:

- `ctol3r/chai-vc-platform`
- `ctol3r/v0-vital-cv-frontend-mvp`

Policy:

- Remove references where found
- Replace with canonical `ctol3r/vitalcv`
- Do not re-introduce dependencies

---

## 6. Governance Notes

- This snapshot is Tier-3 operational truth
- It may be updated when architecture meaningfully changes
- All AI agents must read this file before making changes
- If this file is empty or stale, work must stop

---

End of Snapshot
