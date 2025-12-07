import type { RiskScore } from './risk-score';
import type { FairnessAnalysis } from './fairness';

export interface RenegotiationSuggestion {
  term: string;
  currentValue: unknown;
  suggestedValue: unknown;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  complianceAlignment: boolean;
}

/**
 * Suggest contract renegotiation terms
 */
export function suggestRenegotiations(
  riskScore: RiskScore,
  fairness: FairnessAnalysis,
): RenegotiationSuggestion[] {
  const suggestions: RenegotiationSuggestion[] = [];

  // High-risk terms
  for (const factor of riskScore.factors) {
    if (factor.severity >= 0.2) {
      suggestions.push({
        term: factor.name,
        currentValue: 'Present',
        suggestedValue: 'Review and clarify',
        rationale: factor.description,
        priority: 'high',
        complianceAlignment: factor.name.includes('Compliance'),
      });
    }
  }

  // Unfair terms
  for (const outlier of fairness.outliers) {
    suggestions.push({
      term: outlier.term,
      currentValue: outlier.value,
      suggestedValue: outlier.norm,
      rationale: `Deviates ${(outlier.deviation * 100).toFixed(1)}% from market norm`,
      priority: outlier.deviation > 0.2 ? 'high' : 'medium',
      complianceAlignment: false,
    });
  }

  // Missing compliance clauses
  if (riskScore.missingCompliance > 0) {
    suggestions.push({
      term: 'Compliance Clauses',
      currentValue: 'Missing',
      suggestedValue: 'Add HIPAA, OSHA, and accreditation requirements',
      rationale: 'Ensure regulatory compliance alignment',
      priority: 'high',
      complianceAlignment: true,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}

