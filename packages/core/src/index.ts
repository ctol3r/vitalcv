/**
 * @vitalcv/core — cross-app shared services.
 */

// Risk engine (WAVE C69)
export {
  SPECIALTY_RISK_PROFILES,
  evaluateMarketRisk,
  isRuralZipHeuristic,
  isKnownTaxonomyForRisk,
  listSupportedTaxonomiesForRisk,
} from './services/riskEngine';
export type {
  SpecialtyRiskProfile,
  MarketRiskResult,
  EvaluateMarketRiskInput,
  RiskBand,
} from './services/riskEngine';
