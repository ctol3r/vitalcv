# Passport Convergence Hardening

Scope:
- `apps/web/app/api/passport/[npi]/route.ts`
- `apps/web/app/api/passport/npi/[npi]/route.ts`
- `apps/web/app/api/passport/entity/[id]/route.ts`
- `apps/web/lib/trust/passport-runtime.ts`
- `apps/web/lib/trust/buildDegradedPassportStub.ts`
- `apps/web/lib/trust/passport-runtime-metadata.ts`
- `apps/web/app/passport/[id]/PassportEntityClient.tsx`

## 1. Remaining degraded areas
- UUID entity lookups remain degraded because there is no source-backed entity record on this route.
- NPI lookups remain partially degraded because the passport is still source-incomplete even when NPPES is available.
- Safety, authority, and eligibility remain pending in the degraded fallback path.
- Replay continuity is explicit, but only identity-confirmed NPI lookups can claim a verified replay posture.

## 2. Remaining external dependencies
- CMS NPPES is still the only external dependency on this passport hydration path.
- If NPPES is unavailable, the route still returns truthful JSON, but the passport remains degraded.
- No legacy backend runtime is required by these routes.

## 3. Replay coherence status
- Every emitted passport now carries:
  - `checkedAt`
  - `lineageKey`
  - `replayPosture`
  - `continuityPosture`
  - `issuerPosture`
- The runtime payload shape is stable across NPI and UUID lookups.
- Replay language is now explicit instead of implied by transport errors.

## 4. Institutional readability status
- Source coverage now reads in plain operational terms:
  - `checked`
  - `pending`
  - `unavailable`
- Trust posture uses readable labels instead of proxy/runtime jargon.
- Degraded passports say what is missing rather than describing infrastructure failure.

## 5. Remaining blockers to production-grade hydration
- There is still no fully hydrated UUID entity path inside the App Router.
- Degraded passports still do not represent a fully source-verified operational record.
- The live deployed endpoint should be re-probed in a stable network environment before launch gates depend on it.

## 6. Recommended next non-infrastructure priorities
1. Keep the passport route contract pinned with the current shape test.
2. Add a small smoke check that validates the passport response shape from the deployed site.
3. Keep the degraded-language copy aligned with source-level states, not transport errors.
4. If a source-backed UUID entity record appears later, wire it into the same local runtime shape instead of adding a proxy layer.

## Validation
- Local route tests passed: `4/4`.
- A live production probe earlier in this session returned `200` JSON from `https://vitalcv.com/api/passport/npi/1346053246`.
- A fresh re-probe in this turn was blocked by transient DNS resolution failure in the shell environment, so the live result above is the latest confirmed production evidence from this session.
