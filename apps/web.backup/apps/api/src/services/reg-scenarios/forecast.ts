import type { ScenarioImpact } from './impact';

export interface ScenarioForecast {
  workload: {
    current: number;
    predicted: number;
    increase: number;
  };
  timeToCompliance: number; // days
  economicImpact: {
    cost: number;
    savings: number;
    net: number;
  };
}

/**
 * Forecast scenario outcomes
 */
export function forecastScenarioOutcomes(impact: ScenarioImpact): ScenarioForecast {
  const currentWorkload = 1000; // baseline
  const predictedWorkload = currentWorkload * (1 + impact.verification.loadIncrease);
  const workloadIncrease = predictedWorkload - currentWorkload;

  // Estimate time to compliance based on complexity
  const complexity = impact.compliance.gaps.length + impact.compliance.riskLevel === 'high' ? 2 : 1;
  const timeToCompliance = complexity * 30; // days

  // Economic impact (simplified)
  const costPerClinician = 100; // dollars
  const cost = impact.clinicians.affected * costPerClinician;
  const savingsPerEmployer = 500; // dollars
  const savings = impact.employers.affected * savingsPerEmployer;
  const net = savings - cost;

  return {
    workload: {
      current: currentWorkload,
      predicted: predictedWorkload,
      increase: workloadIncrease,
    },
    timeToCompliance,
    economicImpact: {
      cost,
      savings,
      net,
    },
  };
}

