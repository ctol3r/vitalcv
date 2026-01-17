# VitalCV Agent Rules

These rules apply to all automated agents working in this repository.

## Canonical Repository

- **Canonical repo:** `ctol3r/vitalcv`
- **Single source of truth:** all active development happens here.
- If it is not present in this repo, it is not part of the current system.

## Mandatory Preflight

- Read `.ai/snapshot.md` before making changes.
- If the snapshot is missing, empty, or stale for the task, stop and request a refresh.

## No Cross-Repo Assumptions

- Do not reference or depend on legacy repositories.
- Legacy names are allowed **only** in `docs/legacy-context.md`.

## Tooling & Boundaries

- Use `pnpm` (single root lockfile).
- Use Turborepo (`turbo.json`) for orchestration.
- Keep all docs and code within this monorepo.

## Change Discipline

- If information is missing or ambiguous, state the assumption explicitly.
- For architectural, data-model, or security changes: propose first and wait for confirmation before implementing.

## VitalCV — Agent Guidelines

This repository is the operational source of truth for VitalCV. These rules exist to keep agent work aligned with the **canonical monorepo** and to prevent cross-repo drift.

## Canonical repository rule

- **Canonical repository**: `ctol3r/vitalcv` (this repo) is the single authoritative repository for VitalCV.
- **All active development**: must occur here.

## No cross-repo assumptions

- Do not assume any other VitalCV repositories are available, current, or correct.
- Do not introduce runtime/build-time dependencies on legacy repositories.

**Known legacy repositories (reference-only):** See the canonical list in [`.ai/snapshot.md`](./.ai/snapshot.md).

## Mandatory preflight (before any change)

- Read the operational snapshot: [`.ai/snapshot.md`](./.ai/snapshot.md)
- Treat it as authoritative for the current system boundaries and constraints.
- If the snapshot is missing, empty, or clearly stale, **stop** and ask for guidance before proceeding.

## Documentation & safety constraints

- Write **as-is** documentation only (no speculative future architecture).
- If information is missing/ambiguous, state the assumption explicitly and ask before acting.
