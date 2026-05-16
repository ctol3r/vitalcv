/**
 * Benchmarking — W2-PR70A barrel.
 *
 * Trust-Layer Operational Benchmarking surface for the audit pipeline:
 *   - trustOperationalBenchmark — core builder + lineage digest
 *   - replayEfficiencyComparison — replay-efficiency vs baseline
 *   - auditSurvivabilityComparison — containment-boundary survivability
 *   - operationalFrictionMetrics — runtime mutation cohesion friction
 *   - benchmarkChaosSimulation — black-box chaos harness
 *   - trustLayerPerformanceDashboard — operator surface projection
 */
export * from './trustOperationalBenchmark';
export * from './replayEfficiencyComparison';
export * from './auditSurvivabilityComparison';
export * from './operationalFrictionMetrics';
export * from './benchmarkChaosSimulation';
export * from './trustLayerPerformanceDashboard';
