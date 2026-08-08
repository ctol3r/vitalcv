/**
 * A2.4 — which cadence table governs a scheduled refresh.
 *
 * There are THREE unreconciled cadence tables in this repo:
 *
 *  - `SOURCE_REGISTRY` (packages/source-adapters) — 5 sources with `cadence`
 *    and `freshnessTtl` in ms;
 *  - `SOURCE_POLL_CONFIGS` (backend pollingScheduler) — a different 11-source
 *    table with DAILY/WEEKLY/MONTHLY/ANNUAL bands, which does not import
 *    the registry;
 *  - `MONITOR_CRON` / `NURSYS_POLL_CRON` / `OIG_CRON` env vars in
 *    `continuousMonitor`.
 *
 * **A2 uses `SOURCE_REGISTRY`**, because it is the one the canonical adapters
 * themselves declare and the one decision-grade eligibility is keyed to.
 * Reconciling the other two is out of scope, but the choice has to be
 * explicit here or the agent silently disagrees with the sweeps and nobody
 * can tell which clock is authoritative.
 *
 * A lane the registry does not know is deliberately NOT given a default
 * cadence. Inventing one would be the same class of error as inventing an
 * expiry date: we would be asserting how often an authority changes when we
 * have never asked.
 */
import { SOURCE_REGISTRY } from '@vitalcv/source-adapters';

/** Which registry entry, if any, governs an agent lane id. */
const LANE_TO_SOURCE: Array<{ match: (laneId: string) => boolean; sourceId: string }> = [
  { match: (l) => l.startsWith('nppes'), sourceId: 'NPPES' },
  { match: (l) => l.startsWith('oig') || l.includes('leie'), sourceId: 'OIG_LEIE' },
  { match: (l) => l.startsWith('pecos'), sourceId: 'PECOS_ENROLLMENT' },
  // Only the CA physician-assistant board is in the registry today. A
  // `state_license:XX` lane for any other jurisdiction has no cadence, and
  // saying so is more useful than pretending CA's applies everywhere.
  { match: (l) => l === 'state_license:ca', sourceId: 'CA_PA_BOARD' },
];

export interface LaneCadence {
  sourceId: string;
  /** Minimum interval between reads, in ms, as the registry declares it. */
  cadenceMs: number;
  freshnessTtlMs: number;
  requiredForDecisionGrade: boolean;
}

export function cadenceForLane(laneId: string): LaneCadence | null {
  const mapping = LANE_TO_SOURCE.find((entry) => entry.match(laneId.toLowerCase()));
  if (!mapping) return null;
  const entry = SOURCE_REGISTRY.find((e) => e.sourceId === mapping.sourceId);
  if (!entry) return null;
  return {
    sourceId: entry.sourceId,
    cadenceMs: entry.cadence,
    freshnessTtlMs: entry.freshnessTtl,
    requiredForDecisionGrade: entry.requiredForDecisionGrade,
  };
}

/**
 * Whether enough time has passed since the last reading for another read to
 * tell us anything. A source that publishes daily, polled hourly, produces
 * load and no information.
 */
export function cadenceSatisfied(input: {
  cadence: LaneCadence;
  observedAt?: string;
  now: string;
}): boolean {
  // Never observed ⇒ nothing to wait for.
  if (!input.observedAt) return true;
  const last = Date.parse(input.observedAt);
  const now = Date.parse(input.now);
  if (Number.isNaN(last) || Number.isNaN(now)) return true;
  return now - last >= input.cadence.cadenceMs;
}
