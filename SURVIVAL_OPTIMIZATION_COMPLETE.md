# Survival Optimization Complete

VitalCV now has a materially cheaper public wedge and a clearer boundary around the remaining dynamic runtime.

## Implemented

### 1. Static-first optimization

Public launch surfaces are now static where safe:
- `/`
- `/signup`
- `/sign-up/[[...sign-up]]`
- `/pilot`
- `/contact`
- `/get-ready`
- `/clinician/onboarding`
- `/onboarding/success`

### 2. Reduced SSR

- Root layout skips Clerk session resolution during static-first builds.
- Public marketing and signup pages no longer rely on request-time rendering.
- The employer demo and contact intake are cached as static content.

### 3. Reduced hydration weight

- Homepage hydration is limited to the NPI input interaction.
- Signup and public informational pages avoid extra server work.
- Passport and onboarding remain dynamic only where live trust state or activation state is required.

### 4. Eliminated unnecessary runtime execution

- Shared backend resolution no longer falls back to localhost in deployed runtimes.
- DB-backed employer worklist stays dynamic instead of polluting the static wedge.
- Static-first pages no longer depend on server auth during build.

### 5. Onboarding reliability hardened

- The public launch path still preserves the real NPI → passport → onboarding flow.
- Safe continuation pages remain available without adding architecture.
- The onboarding continuation pages still save and restore state across the flow.

### 6. Dead build/runtime complexity removed

- The public wedge is now clearly separated from dynamic trust and operator surfaces.
- Static route classification is explicit and reproducible from the build.

## Verified

- Focused web tests passed.
- TypeScript typecheck passed.
- Production build passed.
- The build route table confirms the intended static/dynamic split.

## Remaining dynamic surfaces by design

- `/passport`
- `/onboarding`
- `/holder`
- employer review and operator flows

These remain dynamic because they depend on live state, trust hydration, or authenticated workspace data.

## Operational result

The public relaunch wedge is now cheaper to serve, simpler to reason about, and easier to keep alive on a constrained runway.
