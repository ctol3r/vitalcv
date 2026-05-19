/**
 * @vitalcv/core — cross-app shared services.
 */

export {
  TRADITIONAL_CVO_DAYS,
  CREDENTIALING_BY_PROXY_DAYS,
  DAYS_SAVED,
  TAXONOMY_DAILY_RATES,
  calculateOpportunityCost,
  isKnownTaxonomy,
  listSupportedTaxonomies,
} from './services/roiCalculator';
export type {
  TaxonomyRate,
  OpportunityCostResult,
} from './services/roiCalculator';
