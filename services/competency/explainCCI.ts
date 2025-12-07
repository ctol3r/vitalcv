/**
 * B205B-CCI-008: CCI explainability module
 *
 * LLM or rule-based explanation of which features most affected score;
 * ties into causal graph.
 */

import type { CCICalculationResult } from './calcCCI.js';
import { getServiceLogger } from '../logging/serviceLogger.js';

const log = getServiceLogger('services/competency/explainCCI');

export interface CCIExplanation {
  summary: string; // Human-readable summary
  topContributors: Array<{
    feature: string;
    contribution: number;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  recommendations?: string[]; // Actionable recommendations
  causalPath?: string[]; // Path in causal graph (if available)
}

export interface ExplainOptions {
  useLLM?: boolean; // Use LLM for explanation (if available)
  maxContributors?: number; // Max number of top contributors to include
  includeRecommendations?: boolean;
  causalGraphIntegration?: boolean; // Tie into causal graph
}

/**
 * Explain CCI score using rule-based approach
 */
export function explainCCI(
  result: CCICalculationResult,
  options: ExplainOptions = {}
): CCIExplanation {
  const {
    useLLM = false,
    maxContributors = 5,
    includeRecommendations = true,
    causalGraphIntegration = false,
  } = options;

  // Sort contributions by absolute value
  const contributions = Object.entries(result.contributionMap)
    .map(([feature, contribution]) => ({
      feature,
      contribution,
      absContribution: Math.abs(contribution),
    }))
    .sort((a, b) => b.absContribution - a.absContribution)
    .slice(0, maxContributors);

  // Build top contributors with descriptions
  const topContributors = contributions.map(({ feature, contribution }) => {
    const impact: 'positive' | 'negative' | 'neutral' =
      contribution > 0.5 ? 'positive' : contribution < -0.5 ? 'negative' : 'neutral';

    return {
      feature,
      contribution,
      impact,
      description: getFeatureDescription(feature, contribution, impact),
    };
  });

  // Generate summary
  const summary = generateSummary(result, topContributors);

  // Generate recommendations
  const recommendations = includeRecommendations
    ? generateRecommendations(result, topContributors)
    : undefined;

  // Causal graph integration (placeholder)
  const causalPath = causalGraphIntegration ? inferCausalPath(topContributors) : undefined;

  return {
    summary,
    topContributors,
    recommendations,
    causalPath,
  };
}

/**
 * Get human-readable description for a feature
 */
function getFeatureDescription(
  feature: string,
  contribution: number,
  impact: 'positive' | 'negative' | 'neutral'
): string {
  const featureDescriptions: Record<string, string> = {
    oppe_trend: 'Ongoing Professional Practice Evaluation trend',
    fppe_outcomes: 'Focused Professional Practice Evaluation outcomes',
    complication_rate: 'Clinical complication rate',
    license_freshness: 'License expiration status',
    board_freshness: 'Board certification expiration status',
    dea_expiry: 'DEA registration expiration status',
    pecos_status: 'PECOS enrollment status',
    payer_denials: 'Payer claim denial rate',
    ehr_mismatches: 'EHR system data mismatches',
    drift_events: 'Credential drift events',
    years_experience: 'Years of clinical experience',
    privilege_coverage: 'Privilege coverage match',
    specialty_match: 'Specialty alignment',
  };

  const baseDescription = featureDescriptions[feature] || feature;
  const absContribution = Math.abs(contribution);

  if (impact === 'positive') {
    if (absContribution > 5) {
      return `${baseDescription} significantly boosted the score`;
    } else if (absContribution > 2) {
      return `${baseDescription} moderately improved the score`;
    } else {
      return `${baseDescription} slightly improved the score`;
    }
  } else if (impact === 'negative') {
    if (absContribution > 5) {
      return `${baseDescription} significantly reduced the score`;
    } else if (absContribution > 2) {
      return `${baseDescription} moderately reduced the score`;
    } else {
      return `${baseDescription} slightly reduced the score`;
    }
  } else {
    return `${baseDescription} had minimal impact`;
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  result: CCICalculationResult,
  topContributors: CCIExplanation['topContributors']
): string {
  const score = result.cciScore;
  let summary = `CCI Score: ${score.toFixed(1)}/100. `;

  if (score >= 80) {
    summary += 'Excellent competency profile. ';
  } else if (score >= 60) {
    summary += 'Good competency profile with room for improvement. ';
  } else if (score >= 40) {
    summary += 'Moderate competency profile requiring attention. ';
  } else {
    summary += 'Low competency profile requiring immediate attention. ';
  }

  if (topContributors.length > 0) {
    const top = topContributors[0];
    summary += `The most significant factor was ${top.feature.replace(/_/g, ' ')}, which ${
      top.impact === 'positive' ? 'contributed positively' : 'had a negative impact'
    }.`;
  }

  if (result.missingFeatures.length > 0) {
    summary += ` Note: ${result.missingFeatures.length} feature(s) were missing from the calculation.`;
  }

  return summary;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  result: CCICalculationResult,
  topContributors: CCIExplanation['topContributors']
): string[] {
  const recommendations: string[] = [];

  // Check for negative contributors
  const negativeContributors = topContributors.filter((c) => c.impact === 'negative');
  for (const contributor of negativeContributors) {
    switch (contributor.feature) {
      case 'complication_rate':
        recommendations.push('Review clinical outcomes and consider additional training or supervision');
        break;
      case 'payer_denials':
        recommendations.push('Review payer enrollment status and address any denial patterns');
        break;
      case 'ehr_mismatches':
        recommendations.push('Resolve EHR data synchronization issues');
        break;
      case 'drift_events':
        recommendations.push('Address credential drift events and update credentials as needed');
        break;
      case 'license_freshness':
      case 'board_freshness':
      case 'dea_expiry':
        recommendations.push(`Renew expiring ${contributor.feature.replace(/_/g, ' ')}`);
        break;
      case 'pecos_status':
        recommendations.push('Update PECOS enrollment status');
        break;
      case 'fppe_outcomes':
        recommendations.push('Review FPPE outcomes and address any concerns');
        break;
      case 'oppe_trend':
        recommendations.push('Monitor OPPE trends and implement improvement plans if declining');
        break;
    }
  }

  // Check for missing features
  if (result.missingFeatures.length > 0) {
    const criticalMissing = result.missingFeatures.filter((f) =>
      ['fppe_outcomes', 'oppe_trend', 'license_freshness'].includes(f)
    );
    if (criticalMissing.length > 0) {
      recommendations.push(
        `Provide missing data for: ${criticalMissing.join(', ')} to improve score accuracy`
      );
    }
  }

  // General recommendations based on score
  if (result.cciScore < 60) {
    recommendations.push('Consider comprehensive competency review and development plan');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue monitoring competency metrics and maintain current performance');
  }

  return recommendations;
}

/**
 * Infer causal path from top contributors (placeholder for causal graph integration)
 */
function inferCausalPath(topContributors: CCIExplanation['topContributors']): string[] {
  // Placeholder: In production, this would query the causal graph
  // to find paths between features and outcomes
  const path: string[] = [];

  for (const contributor of topContributors) {
    // Simplified causal inference
    if (contributor.feature === 'oppe_trend' || contributor.feature === 'fppe_outcomes') {
      path.push('clinical_performance', contributor.feature, 'cci_score');
    } else if (contributor.feature.includes('freshness') || contributor.feature.includes('expiry')) {
      path.push('credential_status', contributor.feature, 'cci_score');
    } else {
      path.push(contributor.feature, 'cci_score');
    }
  }

  return [...new Set(path)]; // Remove duplicates
}

/**
 * Explain CCI using LLM (placeholder for future LLM integration)
 */
export async function explainCCIWithLLM(
  result: CCICalculationResult,
  options: ExplainOptions = {}
): Promise<CCIExplanation> {
  // Placeholder: In production, this would call an LLM service
  // For now, fall back to rule-based explanation
  log.debug('LLM explanation requested, falling back to rule-based', {
    cciScore: result.cciScore,
  });

  return explainCCI(result, { ...options, useLLM: false });
}

