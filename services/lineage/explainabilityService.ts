/**
 * B228B-LIN-006: ExplainabilityService
 *
 * Generates human-readable explanations of how and why a credential decision was made.
 * Integrates with Reputation and Autonomy engines to provide comprehensive explanations.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'explainability' });

export interface SourceData {
  id: string;
  type: string; // e.g., 'credential', 'reputation_score', 'license', 'board_certification'
  source: string; // e.g., 'issuer', 'board', 'ehr'
  value: unknown;
  confidence?: number;
  timestamp: Date;
}

export interface Transformation {
  id: string;
  name: string;
  description: string;
  inputFields: string[];
  outputFields: string[];
  algorithm?: string; // e.g., 'weighted_average', 'ai_inference', 'rule_based'
  version?: string;
}

export interface Weighting {
  field: string;
  weight: number;
  rationale?: string;
}

export interface CredentialDecision {
  credentialId: string;
  decision: 'approved' | 'rejected' | 'pending' | 'suspended' | 'revoked';
  decisionDate: Date;
  decisionMaker?: string; // User ID or 'autonomous'
  confidence: number;
  sourceData: SourceData[];
  transformations: Transformation[];
  weightings: Weighting[];
  metadata?: Record<string, unknown>;
}

export interface Explanation {
  summary: string;
  decision: CredentialDecision;
  sourceDataBreakdown: Array<{
    source: SourceData;
    contribution: string; // Human-readable explanation of how this source contributed
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  transformationBreakdown: Array<{
    transformation: Transformation;
    description: string; // Human-readable explanation of what this transformation did
    impact: string; // How this transformation affected the decision
  }>;
  weightingBreakdown: Array<{
    weighting: Weighting;
    explanation: string; // Why this field was weighted this way
  }>;
  reputationFactors?: {
    score?: number;
    factors: Array<{
      factor: string;
      value: unknown;
      impact: string;
    }>;
  };
  autonomyFactors?: {
    policyApplied?: string;
    autonomousAction?: boolean;
    requiresConsent?: boolean;
    requiresOverride?: boolean;
    explanation?: string;
  };
  recommendations?: string[];
}

/**
 * ExplainabilityService
 * Generates human-readable explanations of credential decisions
 */
export class ExplainabilityService {
  constructor(
    private prisma: PrismaClient,
    private reputationEngine?: any, // Reputation engine integration
    private autonomyEngine?: any // Autonomy engine integration
  ) {}

  /**
   * Generate explanation for a credential decision
   */
  async explainDecision(decision: CredentialDecision): Promise<Explanation> {
    logger.info('Generating explanation for credential decision', {
      credentialId: decision.credentialId,
      decision: decision.decision,
    });

    // Build summary
    const summary = this.buildSummary(decision);

    // Analyze source data contributions
    const sourceDataBreakdown = this.analyzeSourceData(decision.sourceData, decision);

    // Analyze transformations
    const transformationBreakdown = this.analyzeTransformations(
      decision.transformations,
      decision
    );

    // Analyze weightings
    const weightingBreakdown = this.analyzeWeightings(decision.weightings);

    // Get reputation factors if reputation engine is available
    let reputationFactors: Explanation['reputationFactors'] | undefined;
    if (this.reputationEngine && decision.credentialId) {
      try {
        reputationFactors = await this.getReputationFactors(decision.credentialId);
      } catch (error) {
        logger.warn('Failed to get reputation factors', { error });
      }
    }

    // Get autonomy factors if autonomy engine is available
    let autonomyFactors: Explanation['autonomyFactors'] | undefined;
    if (this.autonomyEngine && decision.decisionMaker === 'autonomous') {
      try {
        autonomyFactors = await this.getAutonomyFactors(decision);
      } catch (error) {
        logger.warn('Failed to get autonomy factors', { error });
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(decision, reputationFactors, autonomyFactors);

    return {
      summary,
      decision,
      sourceDataBreakdown,
      transformationBreakdown,
      weightingBreakdown,
      reputationFactors,
      autonomyFactors,
      recommendations,
    };
  }

  /**
   * Build human-readable summary
   */
  private buildSummary(decision: CredentialDecision): string {
    const decisionText = decision.decision.toUpperCase();
    const confidencePercent = Math.round(decision.confidence * 100);
    const sourceCount = decision.sourceData.length;
    const transformationCount = decision.transformations.length;

    let summary = `Credential decision: ${decisionText} `;
    summary += `with ${confidencePercent}% confidence. `;
    summary += `This decision was based on ${sourceCount} data source${sourceCount !== 1 ? 's' : ''} `;
    summary += `and ${transformationCount} transformation${transformationCount !== 1 ? 's' : ''}.`;

    if (decision.decisionMaker === 'autonomous') {
      summary += ' This was an autonomous decision made by the system.';
    } else if (decision.decisionMaker) {
      summary += ` Decision made by ${decision.decisionMaker}.`;
    }

    return summary;
  }

  /**
   * Analyze how each source data contributed to the decision
   */
  private analyzeSourceData(
    sourceData: SourceData[],
    decision: CredentialDecision
  ): Explanation['sourceDataBreakdown'] {
    return sourceData.map((source) => {
      let contribution = '';
      let impact: 'positive' | 'negative' | 'neutral' = 'neutral';

      switch (source.type) {
        case 'credential':
          contribution = `Existing credential from ${source.source} was verified`;
          impact = 'positive';
          break;
        case 'reputation_score':
          const score = typeof source.value === 'number' ? source.value : 0;
          contribution = `Reputation score of ${score} from ${source.source}`;
          impact = score >= 70 ? 'positive' : score < 50 ? 'negative' : 'neutral';
          break;
        case 'license':
          contribution = `License verification from ${source.source}`;
          impact = 'positive';
          break;
        case 'board_certification':
          contribution = `Board certification status from ${source.source}`;
          impact = 'positive';
          break;
        default:
          contribution = `${source.type} data from ${source.source}`;
      }

      if (source.confidence !== undefined) {
        const confPercent = Math.round(source.confidence * 100);
        contribution += ` (confidence: ${confPercent}%)`;
      }

      return {
        source,
        contribution,
        impact,
      };
    });
  }

  /**
   * Analyze transformations
   */
  private analyzeTransformations(
    transformations: Transformation[],
    decision: CredentialDecision
  ): Explanation['transformationBreakdown'] {
    return transformations.map((transformation) => {
      let description = '';
      let impact = '';

      switch (transformation.algorithm) {
        case 'weighted_average':
          description = `Calculated weighted average of ${transformation.inputFields.join(', ')}`;
          impact = 'Combined multiple data points into a single score';
          break;
        case 'ai_inference':
          description = `Applied AI model (${transformation.name}) to infer relationships`;
          impact = 'Used machine learning to identify patterns and relationships';
          break;
        case 'rule_based':
          description = `Applied rule-based logic: ${transformation.description}`;
          impact = 'Evaluated predefined business rules';
          break;
        default:
          description = transformation.description || `Applied transformation: ${transformation.name}`;
          impact = 'Processed input data to generate output';
      }

      if (transformation.version) {
        description += ` (version ${transformation.version})`;
      }

      return {
        transformation,
        description,
        impact,
      };
    });
  }

  /**
   * Analyze weightings
   */
  private analyzeWeightings(weightings: Weighting[]): Explanation['weightingBreakdown'] {
    return weightings.map((weighting) => {
      let explanation = `Field "${weighting.field}" was weighted at ${weighting.weight}`;

      if (weighting.rationale) {
        explanation += `. ${weighting.rationale}`;
      } else {
        // Generate default rationale based on weight
        if (weighting.weight > 0.5) {
          explanation += ' (high importance in decision)';
        } else if (weighting.weight < 0.2) {
          explanation += ' (low importance in decision)';
        } else {
          explanation += ' (moderate importance in decision)';
        }
      }

      return {
        weighting,
        explanation,
      };
    });
  }

  /**
   * Get reputation factors from reputation engine
   */
  private async getReputationFactors(
    credentialId: string
  ): Promise<Explanation['reputationFactors']> {
    // This would integrate with the actual reputation engine
    // For now, return a placeholder structure
    try {
      // Example integration (would need actual reputation engine API)
      // const reputation = await this.reputationEngine.getReputationScore(credentialId);
      return {
        score: 75, // Placeholder
        factors: [
          {
            factor: 'Issuer Reputation',
            value: 80,
            impact: 'High issuer reputation increased confidence',
          },
          {
            factor: 'Verification History',
            value: 15,
            impact: 'Strong verification history',
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting reputation factors', { error });
      return undefined;
    }
  }

  /**
   * Get autonomy factors from autonomy engine
   */
  private async getAutonomyFactors(
    decision: CredentialDecision
  ): Promise<Explanation['autonomyFactors']> {
    // This would integrate with the actual autonomy engine
    try {
      // Example integration (would need actual autonomy engine API)
      // const policy = await this.autonomyEngine.evaluatePolicy(decision);
      return {
        policyApplied: 'Default Issue Policy',
        autonomousAction: true,
        requiresConsent: false,
        requiresOverride: false,
        explanation:
          'Autonomous action was allowed based on policy evaluation. All conditions were met for automatic issuance.',
      };
    } catch (error) {
      logger.error('Error getting autonomy factors', { error });
      return undefined;
    }
  }

  /**
   * Generate recommendations based on decision and factors
   */
  private generateRecommendations(
    decision: CredentialDecision,
    reputationFactors?: Explanation['reputationFactors'],
    autonomyFactors?: Explanation['autonomyFactors']
  ): string[] {
    const recommendations: string[] = [];

    if (decision.decision === 'rejected') {
      recommendations.push('Review source data quality and completeness');
      if (decision.confidence < 0.7) {
        recommendations.push('Consider manual review for low-confidence decisions');
      }
    }

    if (decision.decision === 'pending') {
      recommendations.push('Additional verification may be required');
    }

    if (reputationFactors && reputationFactors.score && reputationFactors.score < 60) {
      recommendations.push('Low reputation score - consider additional verification');
    }

    if (autonomyFactors && autonomyFactors.requiresConsent) {
      recommendations.push('Consent required before proceeding with autonomous action');
    }

    if (autonomyFactors && autonomyFactors.requiresOverride) {
      recommendations.push('Human override required for this autonomous action');
    }

    return recommendations;
  }

  /**
   * Format explanation as markdown
   */
  formatAsMarkdown(explanation: Explanation): string {
    let markdown = `# Credential Decision Explanation\n\n`;
    markdown += `## Summary\n\n${explanation.summary}\n\n`;

    markdown += `## Decision Details\n\n`;
    markdown += `- **Credential ID**: ${explanation.decision.credentialId}\n`;
    markdown += `- **Decision**: ${explanation.decision.decision.toUpperCase()}\n`;
    markdown += `- **Confidence**: ${Math.round(explanation.decision.confidence * 100)}%\n`;
    markdown += `- **Date**: ${explanation.decision.decisionDate.toISOString()}\n\n`;

    markdown += `## Source Data\n\n`;
    explanation.sourceDataBreakdown.forEach((item, index) => {
      markdown += `### ${index + 1}. ${item.source.type} from ${item.source.source}\n\n`;
      markdown += `- **Contribution**: ${item.contribution}\n`;
      markdown += `- **Impact**: ${item.impact}\n\n`;
    });

    markdown += `## Transformations\n\n`;
    explanation.transformationBreakdown.forEach((item, index) => {
      markdown += `### ${index + 1}. ${item.transformation.name}\n\n`;
      markdown += `- **Description**: ${item.description}\n`;
      markdown += `- **Impact**: ${item.impact}\n\n`;
    });

    markdown += `## Weightings\n\n`;
    explanation.weightingBreakdown.forEach((item) => {
      markdown += `- **${item.weighting.field}**: ${item.explanation}\n`;
    });

    if (explanation.reputationFactors) {
      markdown += `## Reputation Factors\n\n`;
      markdown += `- **Score**: ${explanation.reputationFactors.score}\n\n`;
      explanation.reputationFactors.factors.forEach((factor) => {
        markdown += `- **${factor.factor}**: ${factor.value} - ${factor.impact}\n`;
      });
      markdown += `\n`;
    }

    if (explanation.autonomyFactors) {
      markdown += `## Autonomy Factors\n\n`;
      markdown += `- **Policy Applied**: ${explanation.autonomyFactors.policyApplied}\n`;
      markdown += `- **Autonomous Action**: ${explanation.autonomyFactors.autonomousAction}\n`;
      markdown += `- **Explanation**: ${explanation.autonomyFactors.explanation}\n\n`;
    }

    if (explanation.recommendations && explanation.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      explanation.recommendations.forEach((rec) => {
        markdown += `- ${rec}\n`;
      });
    }

    return markdown;
  }
}

