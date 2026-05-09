# Adoption-Coverage Scanner Test Fixture

This is a documentation file describing the intended behavior of `scripts/governance/check-adoption-coverage.ts` under representative scenarios.

The scanner runs in CI; an executable fixture-test would require a temporary file inside `apps/` or `packages/` (which would itself be a violation). This doc records the manual verification steps an engineer can run locally.

## Scenarios

### Scenario 1 — Allowed reference (canonical use)

A file inside `apps/web/` that imports a state literal from `@vitalcv/governance-runtime`:

```ts
import { type IntegrityState } from "@vitalcv/governance-runtime";
const initial: IntegrityState = "CI-GREEN";
```

**Expected:** 1 governance surface counted; `importsRegistry: true`; 0 violations. Surface is registry-grounded.

### Scenario 2 — Missing import (BYPASS)

A file inside `apps/web/` that uses a literal without importing the package:

```ts
const initial = "CI-GREEN" as const; // bypass: no @vitalcv/governance-runtime import
```

**Expected:** 1 governance surface; `importsRegistry: false`; 1 violation tagged `missing-registry-import`. CI exit code 1.

### Scenario 3 — Ad-hoc rendering (BYPASS)

A file inside `apps/web/` that defines a local state-to-color map:

```ts
const localColors = {
  "CI-GREEN": "green",      // bypass: local mapping
  "CI-DEGRADED": "yellow",
};
```

**Expected:** N violations tagged `ad-hoc-rendering`. CI exit code 1.

### Scenario 4 — Switch case (ALLOWED, not a violation)

A file inside `apps/web/components/governance/` (the approved primitives directory) using switch cases:

```tsx
switch (state) {
  case "CI-GREEN": return greenStyle;
  case "CI-DEGRADED": return yellowStyle;
}
```

**Expected:** 0 violations. The directory is allowlisted (it IS the approved primitives location). Switch-case syntax `case "X":` is excluded from the ad-hoc detection regex via negative-lookbehind.

### Scenario 5 — Approved primitive USE (canonical adoption)

A page in `apps/web/app/some-page/page.tsx` that imports the approved primitive:

```tsx
import { IntegrityBadge } from "@/components/governance";
// ...
<IntegrityBadge state={runtimeIntegrityState} />
```

**Expected:** Could match `@vitalcv/governance-runtime` indirectly via the components/governance directory's exports (if it transitively imports). The scanner is heuristic; full transitive-import graph analysis is out of scope. Manual review in PR remains the final gate.

## Verifying locally

```sh
pnpm dlx tsx@4 scripts/governance/check-adoption-coverage.ts
pnpm dlx tsx@4 scripts/governance/check-adoption-coverage.ts --json | jq .summary
pnpm dlx tsx@4 scripts/governance/check-adoption-coverage.ts --min-coverage 95
```

Exit code 0 = clean; exit code 1 = violations or coverage below threshold.

## CI integration

`.github/workflows/governance-enforcement.yml` runs the scanner on every PR. A clean baseline (no governance surfaces outside the approved package) means the scanner fails CI on any introduction of:
- A literal like `"CI-GREEN"` without importing `@vitalcv/governance-runtime`.
- A local map like `{ "CI-GREEN": "..." }`.
- A new replay-state literal outside the approved primitives.

Any subsequent integration of governance UI in `apps/web/` MUST go through the approved primitives in `apps/web/components/governance/` or import the registry directly.
