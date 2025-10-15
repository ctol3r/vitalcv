# VitalCV — Copilot instructions (repo-level)

## Overview
This repository is part of the VitalCV project. Purpose: clinician credentialing + onboarding UX (frontend/backend). Default branch: main.

## Build & run (local)
# Frontend (Next.js)
pnpm install
pnpm dev
pnpm build
pnpm test

# Backend (Go/Java/Python)
# Replace with the backend's exact run/test commands
make dev
make test

## Key paths
- Frontend UI: app/, pages/, components/
- Backend API: services/api/, cmd/, internal/
- Important config: .env.*, .github/, infra/

## Coding conventions
- TypeScript: strict mode, noImplicitAny, use `tsc --noEmit` to check
- Lint: pnpm lint (ESLint + Prettier)
- Commit message style: feat(scope): short description. Include ticket number when applicable.

## Tests & CI
- Run unit tests before PR: pnpm test | make test
- Ensure status checks: unit-tests, linting, typecheck pass

## What to avoid
- Do not modify secrets or .env files
- Do not commit large binary files
- Exclude node_modules/ and build artifacts

## Acceptance for automated edits
- For any code change > 10 LOC, generate a PR with a clear title & description
- Include unit tests for behavior changes

## Contacts / reviewers
- Primary: Christopher Toler <christopher.toler@sutterhealth.org>
- Secondary: Backend lead / Frontend lead (update as needed)
