# Runbook: MATCHA Fuzzy Specialty Scoring

## Scope

Guidance for managing MATCHA’s specialty distance map and fuzzy specialty scoring.

## Preconditions

- Matching service is deployed with `services/matching/matchaConfig.ts`.
- Specialty distance map is loaded at process boot.

## Verify Behavior

1. Run matching unit tests:
   - `pnpm test -- services/matching/__tests__/score.test.ts`
2. Confirm explanation output includes `specialty_adjacent_match` when appropriate.

## Update the Distance Map

1. Edit `services/matching/specialtyDistance.ts`.
2. Add or adjust entries under `DEFAULT_SPECIALTY_DISTANCE_MAP`.
3. Keep distance values in range **0–1**.
4. Redeploy services to reload the boot-time map.

## Monitoring Hooks

- Track match explanation tags for `specialty_adjacent_match`.
- Alert on abrupt changes in specialty match distribution after updates.

## Rollback

1. Revert changes to `DEFAULT_SPECIALTY_DISTANCE_MAP`.
2. Redeploy to restore previous matching behavior.
