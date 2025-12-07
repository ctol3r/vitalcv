import type { LatencyMetrics } from './aggregate';

export interface SLACheck {
  compliant: boolean;
  violations: Array<{ step: string; expected: number; actual: number }>;
  score: number; // 0-1, higher = more compliant
}

const SLA_THRESHOLDS = {
  PSVCompleted: 72 * 60 * 60 * 1000, // 72 hours in milliseconds
  VCVerified: 2 * 1000, // 2 seconds
};

/**
 * Check SLA compliance
 */
export function checkSLACompliance(metrics: LatencyMetrics): SLACheck {
  const violations: SLACheck['violations'] = [];
  let compliant = true;

  // Check PSV completion
  const psvDuration = metrics.stepDurations['PSVCompleted'];
  if (psvDuration && psvDuration > SLA_THRESHOLDS.PSVCompleted) {
    compliant = false;
    violations.push({
      step: 'PSVCompleted',
      expected: SLA_THRESHOLDS.PSVCompleted,
      actual: psvDuration,
    });
  }

  // Check VC verification
  const verifyDuration = metrics.stepDurations['VCVerified'];
  if (verifyDuration && verifyDuration > SLA_THRESHOLDS.VCVerified) {
    compliant = false;
    violations.push({
      step: 'VCVerified',
      expected: SLA_THRESHOLDS.VCVerified,
      actual: verifyDuration,
    });
  }

  // Compute compliance score
  const totalChecks = 2;
  const passedChecks = totalChecks - violations.length;
  const score = passedChecks / totalChecks;

  return {
    compliant,
    violations,
    score,
  };
}

