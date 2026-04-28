import type { SourceHealthSnapshot } from './sourceHealthTypes';

/**
 * PLACEHOLDER deterministic seed for SourceHealth snapshots.
 *
 * This is NOT live data. Until the probe scheduler is wired up to a runtime
 * health store, surfaces render this seed so the UI shape can be exercised
 * without making false claims about source liveness.
 *
 * Honest defaults:
 *   - NPPES, OIG_LEIE, PECOS: posture is "configured", but we do NOT mark
 *     them LIVE without a real probe reading. We mark them UNKNOWN with a
 *     reason that says exactly that.
 *   - STATE_BOARD: UNKNOWN — there is no generic state-board probe yet.
 *
 * When real probes land, replace this with a server-side reader that returns
 * the latest probe result per source.
 */
export function getLaneSnapshots(
  options: { now?: () => Date } = {},
): SourceHealthSnapshot[] {
  const now = options.now ?? (() => new Date());
  const observedAt = now().toISOString();

  return [
    {
      sourceId: 'NPPES',
      state: 'UNKNOWN',
      reason: 'placeholder_seed_no_live_probe',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastLatencyMs: null,
      observedAt,
    },
    {
      sourceId: 'OIG_LEIE',
      state: 'UNKNOWN',
      reason: 'placeholder_seed_no_live_probe',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastLatencyMs: null,
      observedAt,
    },
    {
      sourceId: 'PECOS',
      state: 'UNKNOWN',
      reason: 'placeholder_seed_no_live_probe',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastLatencyMs: null,
      observedAt,
    },
    {
      sourceId: 'STATE_BOARD',
      state: 'UNKNOWN',
      reason: 'no_generic_state_board_probe_wired',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastLatencyMs: null,
      observedAt,
    },
  ];
}
