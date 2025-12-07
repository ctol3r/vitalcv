export interface FairnessAnalysis {
  overall: 'fair' | 'unfair' | 'needs_review';
  score: number; // 0-1, higher = fairer
  outliers: Array<{ term: string; value: unknown; norm: unknown; deviation: number }>;
  recommendations: string[];
}

// Normative data (would come from database in production)
const NORMATIVE_TERMS: Record<string, Record<string, { min: number; max: number; avg: number }>> = {
  'physician': {
    'salary': { min: 200000, max: 400000, avg: 280000 },
    'notice_period_days': { min: 30, max: 90, avg: 60 },
  },
  'nurse': {
    'salary': { min: 60000, max: 120000, avg: 85000 },
    'notice_period_days': { min: 14, max: 30, avg: 21 },
  },
};

/**
 * Analyze contract fairness against norms
 */
export function analyzeContractFairness(
  contract: Record<string, unknown>,
  specialty: string,
  region: string,
): FairnessAnalysis {
  const outliers: FairnessAnalysis['outliers'] = [];
  const recommendations: string[] = [];
  let score = 1.0;

  // Get norms for specialty
  const norms = NORMATIVE_TERMS[specialty.toLowerCase()] || NORMATIVE_TERMS['physician'];

  // Check salary
  if (contract.salary && typeof contract.salary === 'number') {
    const salary = contract.salary as number;
    const salaryNorm = norms.salary;
    if (salary < salaryNorm.min) {
      const deviation = (salaryNorm.min - salary) / salaryNorm.avg;
      outliers.push({
        term: 'salary',
        value: salary,
        norm: salaryNorm,
        deviation,
      });
      score -= 0.2;
      recommendations.push(`Salary ($${salary.toLocaleString()}) is below market minimum ($${salaryNorm.min.toLocaleString()})`);
    } else if (salary > salaryNorm.max) {
      // Above max is not necessarily bad, but flag for review
      recommendations.push(`Salary ($${salary.toLocaleString()}) is above market maximum ($${salaryNorm.max.toLocaleString()}) - verify accuracy`);
    }
  }

  // Check notice period
  if (contract.noticePeriodDays && typeof contract.noticePeriodDays === 'number') {
    const notice = contract.noticePeriodDays as number;
    const noticeNorm = norms.notice_period_days;
    if (notice > noticeNorm.max) {
      const deviation = (notice - noticeNorm.max) / noticeNorm.avg;
      outliers.push({
        term: 'notice_period_days',
        value: notice,
        norm: noticeNorm,
        deviation,
      });
      score -= 0.15;
      recommendations.push(`Notice period (${notice} days) exceeds market norm (${noticeNorm.max} days)`);
    }
  }

  // Determine overall fairness
  let overall: FairnessAnalysis['overall'] = 'fair';
  if (score < 0.7) {
    overall = 'unfair';
  } else if (score < 0.85 || outliers.length > 0) {
    overall = 'needs_review';
  }

  if (recommendations.length === 0) {
    recommendations.push('Contract terms appear aligned with market norms');
  }

  return {
    overall,
    score: Math.max(0, score),
    outliers,
    recommendations,
  };
}

