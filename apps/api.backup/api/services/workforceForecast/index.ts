/**
 * B206A: Workforce Forecast Services
 *
 * Main entry point for workforce demand forecasting system
 */

export { DemandFeatureExtractor, DemandFeatures, FeatureExtractionOptions } from './extractors/demandFeatures.js';
export { DemandForecastModel, ModelType, ModelConfig, ForecastResult } from './model/demandModel.js';
export { DemandForecastEngine, ForecastRequest, ForecastResponse } from './demandEngine.js';
export { CriticalDemandForecastDetector, CriticalShortageConfig, CriticalShortageAlert, DetectionResult } from './detectors/criticalDemandDetector.js';
export { WorkforceSupplyGraph, SupplyReadinessRequest, SupplyReadiness, SimpleWorkforceSupplyGraph } from './graph/workforceSupplyGraph.js';
