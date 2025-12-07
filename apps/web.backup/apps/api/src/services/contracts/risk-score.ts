import type { ClassifiedContract } from './classify';

export interface RiskScore {
  overall: number; // 0-1, higher = more risk
  hiddenRisk: number;
  misalignedObligations: number;
  missingCompliance: number;
  factors: Array<{ name: string; severity: number; description: string }>;
}

/**
 * Score contract risk
 */
export function scoreContractRisk(classified: ClassifiedContract): RiskScore {
  const factors: RiskScore['factors'] = [];
  let hiddenRisk = 0;
  let misalignedObligations = 0;
  let missingCompliance = 0;

  // Check for missing compliance clauses
  if (classified.summary.compliance.length === 0) {
    missingCompliance = 0.3;
    factors.push({
      name: 'Missing Compliance Clauses',
      severity: 0.3,
      description: 'No explicit compliance requirements found',
    });
  }

  // Check for restrictive covenants (higher risk)
  if (classified.summary.restrictiveCovenants.length > 0) {
    hiddenRisk += 0.2;
    factors.push({
      name: 'Restrictive Covenants Present',
      severity: 0.2,
      description: `${classified.summary.restrictiveCovenants.length} restrictive covenant(s) found`,
    });
  }

  // Check for vague termination clauses
  const terminationClauses = classified.clauses.filter(c => c.type === 'termination');
  if (terminationClauses.length > 0) {
    const vagueTermination = terminationClauses.some(c =>
      c.text.toLowerCase().includes('at will') ||
      c.text.toLowerCase().includes('without cause')
    );
    if (vagueTermination) {
      misalignedObligations += 0.15;
      factors.push({
        name: 'Vague Termination Terms',
        severity: 0.15,
        description: 'Termination clause may be too broad',
      });
    }
  }

  // Check for missing compensation details
  if (classified.summary.compensation.length === 0) {
    hiddenRisk += 0.1;
    factors.push({
      name: 'Missing Compensation Details',
      severity: 0.1,
      description: 'No explicit compensation terms found',
    });
  }

  // Overall risk is weighted average
  const overall = Math.min(1, (hiddenRisk * 0.4 + misalignedObligations * 0.3 + missingCompliance * 0.3));

  return {
    overall,
    hiddenRisk,
    misalignedObligations,
    missingCompliance,
    factors,
  };
}

