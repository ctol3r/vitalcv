/**
 * B119C-AI-021: Agent risk matrix (NeuralTrust 73% concern gap)
 *
 * Implements a tiered risk assessment matrix for agents with three maturity tiers:
 * - Reactive: Basic monitoring, high risk
 * - Managed: Enhanced controls, medium risk
 * - Proactive: Advanced safeguards, low risk
 *
 * NeuralTrust integration calculates concern scores based on agent behavior patterns.
 */

export type RiskTier = 'Reactive' | 'Managed' | 'Proactive';

export interface RiskAssessment {
  agentId: string;
  tier: RiskTier;
  concernScore: number; // 0-100, where 73% indicates significant concern gap
  riskFactors: RiskFactor[];
  lastAssessed: Date;
  recommendations: string[];
}

export interface RiskFactor {
  type: 'injection' | 'leak' | 'supply-chain' | 'tool' | 'llm' | 'governance' | 'monitoring';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
}

export interface NeuralTrustMetrics {
  agentId: string;
  trustScore: number; // 0-100
  concernGap: number; // Gap between expected and actual trust (0-100)
  behaviorPatterns: {
    anomalyCount: number;
    deviationScore: number;
    consistencyScore: number;
  };
  lastUpdated: Date;
}

/**
 * NeuralTrust risk assessment engine
 * Calculates concern gaps and assigns risk tiers
 */
export class NeuralTrustRiskMatrix {
  private assessments: Map<string, RiskAssessment> = new Map();
  private neuralTrustMetrics: Map<string, NeuralTrustMetrics> = new Map();

  /**
   * Assess agent risk and assign tier
   */
  assessAgent(agentId: string, telemetry: any): RiskAssessment {
    // Calculate NeuralTrust metrics
    const neuralTrust = this.calculateNeuralTrust(agentId, telemetry);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(agentId, telemetry);

    // Calculate concern score (73% gap indicates significant concern)
    const concernScore = this.calculateConcernScore(neuralTrust, riskFactors);

    // Determine tier based on concern score
    const tier = this.determineTier(concernScore, riskFactors);

    // Generate recommendations
    const recommendations = this.generateRecommendations(tier, riskFactors);

    const assessment: RiskAssessment = {
      agentId,
      tier,
      concernScore,
      riskFactors,
      lastAssessed: new Date(),
      recommendations,
    };

    this.assessments.set(agentId, assessment);
    return assessment;
  }

  /**
   * Calculate NeuralTrust metrics for an agent
   */
  private calculateNeuralTrust(agentId: string, telemetry: any): NeuralTrustMetrics {
    const existing = this.neuralTrustMetrics.get(agentId);

    // Calculate trust score based on behavior patterns
    const anomalyCount = telemetry?.anomalies?.length || 0;
    const deviationScore = telemetry?.deviationScore || 0;
    const consistencyScore = Math.max(0, 100 - (deviationScore * 10));

    // Base trust score
    const trustScore = Math.max(0, Math.min(100, consistencyScore - (anomalyCount * 5)));

    // Calculate concern gap (73% indicates significant gap)
    // Gap = difference between expected trust (100) and actual trust
    const concernGap = Math.max(0, 100 - trustScore);

    const metrics: NeuralTrustMetrics = {
      agentId,
      trustScore,
      concernGap,
      behaviorPatterns: {
        anomalyCount,
        deviationScore,
        consistencyScore,
      },
      lastUpdated: new Date(),
    };

    this.neuralTrustMetrics.set(agentId, metrics);
    return metrics;
  }

  /**
   * Identify risk factors from telemetry
   */
  private identifyRiskFactors(agentId: string, telemetry: any): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Check for injection risks
    if (telemetry?.injectionAttempts > 0) {
      factors.push({
        type: 'injection',
        severity: telemetry.injectionAttempts > 5 ? 'critical' : 'high',
        description: `Detected ${telemetry.injectionAttempts} injection attempts`,
        evidence: telemetry.injectionEvidence || [],
      });
    }

    // Check for data leak risks
    if (telemetry?.dataLeaks > 0) {
      factors.push({
        type: 'leak',
        severity: telemetry.dataLeaks > 3 ? 'critical' : 'high',
        description: `Detected ${telemetry.dataLeaks} potential data leaks`,
        evidence: telemetry.leakEvidence || [],
      });
    }

    // Check for supply chain risks
    if (telemetry?.supplyChainWarnings > 0) {
      factors.push({
        type: 'supply-chain',
        severity: telemetry.supplyChainWarnings > 2 ? 'high' : 'medium',
        description: `Detected ${telemetry.supplyChainWarnings} supply chain warnings`,
        evidence: telemetry.supplyChainEvidence || [],
      });
    }

    // Check for tool misuse
    if (telemetry?.toolMisuse > 0) {
      factors.push({
        type: 'tool',
        severity: telemetry.toolMisuse > 3 ? 'high' : 'medium',
        description: `Detected ${telemetry.toolMisuse} tool misuse incidents`,
        evidence: telemetry.toolEvidence || [],
      });
    }

    // Check for LLM risks
    if (telemetry?.llmRisks > 0) {
      factors.push({
        type: 'llm',
        severity: telemetry.llmRisks > 2 ? 'high' : 'medium',
        description: `Detected ${telemetry.llmRisks} LLM-related risks`,
        evidence: telemetry.llmEvidence || [],
      });
    }

    // Check governance gaps
    if (!telemetry?.governanceControls) {
      factors.push({
        type: 'governance',
        severity: 'medium',
        description: 'Missing governance controls',
        evidence: ['No governance framework detected'],
      });
    }

    // Check monitoring gaps
    if (!telemetry?.monitoringEnabled) {
      factors.push({
        type: 'monitoring',
        severity: 'low',
        description: 'Monitoring not fully enabled',
        evidence: ['Limited telemetry coverage'],
      });
    }

    return factors;
  }

  /**
   * Calculate concern score (0-100)
   * 73% indicates significant concern gap
   */
  private calculateConcernScore(
    neuralTrust: NeuralTrustMetrics,
    riskFactors: RiskFactor[]
  ): number {
    // Base concern from NeuralTrust gap
    let concern = neuralTrust.concernGap;

    // Add risk factor contributions
    for (const factor of riskFactors) {
      switch (factor.severity) {
        case 'critical':
          concern += 20;
          break;
        case 'high':
          concern += 10;
          break;
        case 'medium':
          concern += 5;
          break;
        case 'low':
          concern += 2;
          break;
      }
    }

    // Cap at 100
    return Math.min(100, Math.max(0, concern));
  }

  /**
   * Determine risk tier based on concern score and factors
   */
  private determineTier(concernScore: number, riskFactors: RiskFactor[]): RiskTier {
    const hasCritical = riskFactors.some(f => f.severity === 'critical');
    const hasHigh = riskFactors.some(f => f.severity === 'high');

    // Proactive: Low concern (< 30), no critical/high risks
    if (concernScore < 30 && !hasCritical && !hasHigh) {
      return 'Proactive';
    }

    // Managed: Medium concern (30-70), manageable risks
    if (concernScore >= 30 && concernScore < 70 && !hasCritical) {
      return 'Managed';
    }

    // Reactive: High concern (>= 70) or critical risks
    // 73% concern gap specifically triggers Reactive tier
    return 'Reactive';
  }

  /**
   * Generate recommendations based on tier and risk factors
   */
  private generateRecommendations(tier: RiskTier, riskFactors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    if (tier === 'Reactive') {
      recommendations.push('Immediate action required: Agent requires enhanced monitoring');
      recommendations.push('Implement input validation and sanitization');
      recommendations.push('Enable real-time threat detection');
      recommendations.push('Review and restrict tool access');
    } else if (tier === 'Managed') {
      recommendations.push('Continue monitoring and improve controls');
      recommendations.push('Implement additional safeguards for identified risk factors');
      recommendations.push('Regular risk assessments recommended');
    } else {
      recommendations.push('Maintain current safeguards');
      recommendations.push('Continue proactive monitoring');
    }

    // Add specific recommendations for risk factors
    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'injection':
          recommendations.push('Implement input validation and output encoding');
          break;
        case 'leak':
          recommendations.push('Review data access patterns and implement DLP');
          break;
        case 'supply-chain':
          recommendations.push('Audit dependencies and implement SBOM tracking');
          break;
        case 'tool':
          recommendations.push('Review tool permissions and implement least privilege');
          break;
        case 'llm':
          recommendations.push('Implement prompt validation and output filtering');
          break;
        case 'governance':
          recommendations.push('Establish governance framework and policies');
          break;
        case 'monitoring':
          recommendations.push('Enable comprehensive telemetry and alerting');
          break;
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get assessment for an agent
   */
  getAssessment(agentId: string): RiskAssessment | null {
    return this.assessments.get(agentId) || null;
  }

  /**
   * Get all assessments
   */
  getAllAssessments(): RiskAssessment[] {
    return Array.from(this.assessments.values());
  }

  /**
   * Get NeuralTrust metrics for an agent
   */
  getNeuralTrustMetrics(agentId: string): NeuralTrustMetrics | null {
    return this.neuralTrustMetrics.get(agentId) || null;
  }

  /**
   * Get tier distribution summary
   */
  getTierSummary(): { tier: RiskTier; count: number; avgConcern: number }[] {
    const byTier = new Map<RiskTier, { count: number; totalConcern: number }>();

    for (const assessment of this.assessments.values()) {
      const existing = byTier.get(assessment.tier) || { count: 0, totalConcern: 0 };
      existing.count++;
      existing.totalConcern += assessment.concernScore;
      byTier.set(assessment.tier, existing);
    }

    return Array.from(byTier.entries()).map(([tier, stats]) => ({
      tier,
      count: stats.count,
      avgConcern: stats.count > 0 ? stats.totalConcern / stats.count : 0,
    }));
  }
}

// Singleton instance
let riskMatrix: NeuralTrustRiskMatrix | null = null;

export function getRiskMatrix(): NeuralTrustRiskMatrix {
  if (!riskMatrix) {
    riskMatrix = new NeuralTrustRiskMatrix();
  }
  return riskMatrix;
}

