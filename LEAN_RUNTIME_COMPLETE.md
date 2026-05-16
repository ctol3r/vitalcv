# Lean Runtime Complete

This pass reduced runtime cost without changing the product shape.

## Dead code paths identified and removed from the launch wedge

- Global app chrome is now skipped on static-first builds:
  - `CommandPalette`
  - `Toaster`
- The onboarding loading step no longer depends on `framer-motion`.
- The static wedge is now explicit instead of relying on incidental runtime behavior.

## Static rendering optimized

The following public surfaces are static where safe:
- `/`
- `/signup`
- `/sign-up/[[...sign-up]]`
- `/pilot`
- `/contact`
- `/get-ready`
- `/clinician/onboarding`
- `/onboarding/success`

## SSR reduced

- Root layout skips Clerk session resolution during static-first builds.
- Public marketing and signup pages do not require request-time rendering.
- Employer demo and contact intake now ship as static content.

## Hydration load reduced

- Homepage hydration remains focused on the NPI input only.
- The onboarding loading path is lighter after removing motion dependencies.
- Static-first builds avoid mounting global shell chrome that the public wedge does not need.

## Runtime complexity reduced

- Deployed backend resolution no longer falls back to localhost.
- DB-backed employer worklist remains dynamic by design instead of contaminating the static wedge.
- Public relaunch surfaces are separated from live trust-hydration surfaces.

## Unused dependencies

- No package dependency was removed in this pass.
- The remaining dependency graph still supports non-public surfaces in the monorepo.
- The safe optimization here was removing a runtime import path and skipping unnecessary shell chrome on static-first builds.

## Remaining dynamic surfaces by design

- `/passport`
- `/onboarding`
- `/holder`
- employer review and operator surfaces

These remain dynamic because they depend on live trust, activation, or authenticated workspace state.

## Validation

- Focused web tests passed.
- TypeScript typecheck passed.
- Production build passed.

## Result

The public wedge is cheaper to serve, faster to hydrate, and simpler to keep alive on a constrained runway.
