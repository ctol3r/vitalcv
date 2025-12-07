/**
 * Coupling Graph Service
 *
 * Exports all coupling graph functionality:
 * - PropagationEngine: Propagate impact through graph
 * - RippleScenarioSimulator: Simulate scenario events
 * - SystemSensitivityAnalyzer: Analyze system sensitivity
 * - CrossDomainImpactJoiner: Join multiple domain impacts
 */

export * from './types.js';
export * from './models/couplingGraphStore.js';
export * from './propagationEngine.js';
export * from './simulator/rippleSimulator.js';
export * from './analytics/sensitivity.js';
export * from './joiners/crossDomainImpact.js';
