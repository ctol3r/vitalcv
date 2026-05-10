/**
 * economic-trust — Wave W2-PR60A.
 *
 * Pure-function metrics module: takes ReplayEvidence in, returns
 * EconomicTrustReport out. No DB, no I/O, no side effects. Deterministic given
 * the same input + options.
 *
 * Public surface deliberately minimal — orchestrator + harness + types.
 * Sub-module computers are exported for tests and future composition only.
 */

export {
  computeEconomicTrustReport,
  ECONOMIC_METRICS_METHODOLOGY_VERSION,
  VERDICT_THRESHOLDS,
} from './economicMetricsEngine';
export type { EconomicMetricsEngineOptions } from './economicMetricsEngine';

export { computeTimeToStart } from './timeToStart';
export type { TimeToStartSummary } from './timeToStart';

export { computeReplayReuseEfficiency } from './replayReuse';
export type { ReplayReuseSummary } from './replayReuse';

export {
  computeTrustEfficiencyScore,
  TRUST_EFFICIENCY_METHODOLOGY_VERSION,
  TRUST_EFFICIENCY_WEIGHTS,
  TRUST_EFFICIENCY_IDEAL_CHAIN_DEPTH,
} from './trustEfficiency';
export type { TrustEfficiencySummary } from './trustEfficiency';

export { computeOperationalSavings } from './operationalSavings';
export type { OperationalSavingsSummary } from './operationalSavings';

export { computeVerifierEfficiency } from './verifierEfficiency';
export type { VerifierEfficiencyOptions } from './verifierEfficiency';

export { applyChaosScenario, summariseChaosScenario } from './roiChaos';
export type { ChaosScenario, ChaosScenarioName } from './roiChaos';

export {
  buildMetric,
  bootstrapInterval,
  clamp01,
  clamp,
  digestToSeed,
  mean,
  quantile,
} from './statUtil';

export { DEFAULT_MANUAL_COST_BASELINE } from './types';
export type {
  AmbiguousMetric,
  ChaosScenarioResult,
  EconomicTrustReport,
  EconomicVerdict,
  LongitudinalDatapoint,
  ManualCostBaseline,
  ReplayEvidence,
  VerdictReason,
  VerifierEfficiencyReport,
} from './types';
