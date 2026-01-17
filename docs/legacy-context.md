# VitalCV Legacy Context

> **Note:** Important historical context for understanding codebase evolution. Last reviewed: 2026-01-16.

This document centralizes historical references to legacy repositories. It is the only place where legacy repo names should appear.

## Prior Repository History (Reference-Only)

VitalCV was previously developed across multiple repositories that have since been consolidated into this monorepo. Those repos are **legacy / reference-only** and must not be used for active development or runtime dependencies.

Known legacy repository identifiers:

- `ctol3r/chai-vc-platform`
- `ctol3r/v0-vital-cv-frontend-mvp`

## Current Policy

- All active development occurs in `ctol3r/vitalcv`.
- If a capability is missing, it must be implemented in this repo.
- Do not introduce dependencies on legacy repositories.
- Remove legacy-repo references from docs, code, and scripts outside this file.

## Legacy Context (Reference-Only)

VitalCV work existed across multiple repositories during early prototyping and MVP phases. The current project is consolidated into a **single canonical monorepo**: `ctol3r/vitalcv`.

### Legacy repositories

Multiple repositories were used during early prototyping/MVP phases and are considered **legacy and reference-only**.

Legacy identifiers may be mentioned in older documentation or historical notes, but they must not be treated as sources of truth and must not be relied on for runtime behavior. For the canonical list of legacy repo identifiers to purge, see `../.ai/snapshot.md`.

### Why this matters

The canonical rule is simple: if something is not present in the canonical repository, it is not part of the current system. When you encounter legacy names, treat them as historical artifacts and prefer the documentation and implementation that exists in the canonical monorepo.
