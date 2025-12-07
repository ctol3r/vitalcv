/**
 * RiskGradientMapping
 * Task 12: Add RiskGradientMapping (yellow → amber → red)
 *
 * Maps risk levels to gradient visualizations and provides
 * compliance-pressure visualization.
 */

export type RiskLevel = 'green' | 'yellow' | 'amber' | 'red' | 'critical';

export interface RiskGradient {
  level: RiskLevel;
  color: string;
  gradient: {
    start: string;
    end: string;
  };
  threshold: number; // 0-1, minimum risk score for this level
  pressure: number; // 0-1, compliance pressure
  recommendations: string[];
}

export interface CompliancePressure {
  credentialId: string;
  pressureLevel: number; // 0-1
  sources: Array<{
    type: 'regulation' | 'expiry' | 'verification' | 'audit' | 'revocation';
    severity: 'low' | 'medium' | 'high';
    description: string;
    deadline?: Date;
  }>;
  visualizations: {
    gradient: RiskGradient;
    intensity: number; // 0-1
    pulseRate: number; // pulses per second
  };
}

export class RiskGradientMapper {
  private gradients: Map<RiskLevel, RiskGradient>;

  constructor() {
    this.gradients = new Map([
      ['green', {
        level: 'green',
        color: '#10b981',
        gradient: { start: '#10b981', end: '#34d399' },
        threshold: 0,
        pressure: 0,
        recommendations: ['Maintain current compliance status'],
      }],
      ['yellow', {
        level: 'yellow',
        color: '#fbbf24',
        gradient: { start: '#fbbf24', end: '#fcd34d' },
        threshold: 0.2,
        pressure: 0.3,
        recommendations: [
          'Monitor credential status',
          'Review compliance requirements',
          'Plan for renewal if needed',
        ],
      }],
      ['amber', {
        level: 'amber',
        color: '#f97316',
        gradient: { start: '#f97316', end: '#fb923c' },
        threshold: 0.5,
        pressure: 0.6,
        recommendations: [
          'Action required soon',
          'Check credential expiration dates',
          'Update compliance documentation',
          'Review verification status',
        ],
      }],
      ['red', {
        level: 'red',
        color: '#ef4444',
        gradient: { start: '#ef4444', end: '#f87171' },
        threshold: 0.7,
        pressure: 0.8,
        recommendations: [
          'Immediate action required',
          'Credential may be expiring',
          'Compliance at risk',
          'Contact support if needed',
        ],
      }],
      ['critical', {
        level: 'critical',
        color: '#dc2626',
        gradient: { start: '#dc2626', end: '#991b1b' },
        threshold: 0.9,
        pressure: 1.0,
        recommendations: [
          'CRITICAL: Immediate attention required',
          'Credential expired or revoked',
          'Compliance violation detected',
          'Urgent remediation needed',
        ],
      }],
    ]);
  }

  /**
   * Map risk score to gradient
   */
  mapRiskToGradient(riskScore: number): RiskGradient {
    // Normalize risk score (0-1)
    const normalized = Math.max(0, Math.min(1, riskScore));

    // Find matching gradient
    const levels: RiskLevel[] = ['critical', 'red', 'amber', 'yellow', 'green'];
    for (const level of levels) {
      const gradient = this.gradients.get(level)!;
      if (normalized >= gradient.threshold) {
        // Adjust pressure based on how far above threshold
        const adjustedGradient = {
          ...gradient,
          pressure: Math.min(1, gradient.pressure + (normalized - gradient.threshold) * 0.5),
        };
        return adjustedGradient;
      }
    }

    return this.gradients.get('green')!;
  }

  /**
   * Calculate compliance pressure
   */
  calculateCompliancePressure(
    credentialId: string,
    riskScore: number,
    expiryDate?: Date,
    verificationStatus?: 'verified' | 'pending' | 'failed',
    regulatoryChecks?: Array<{
      type: 'regulation' | 'audit';
      status: 'pass' | 'pending' | 'fail';
      deadline?: Date;
    }>
  ): CompliancePressure {
    const sources: CompliancePressure['sources'] = [];
    let totalPressure = 0;

    // Base pressure from risk score
    const baseGradient = this.mapRiskToGradient(riskScore);
    totalPressure += baseGradient.pressure * 0.4;

    // Expiry pressure
    if (expiryDate) {
      const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 0) {
        sources.push({
          type: 'expiry',
          severity: 'critical',
          description: 'Credential has expired',
          deadline: expiryDate,
        });
        totalPressure += 0.5;
      } else if (daysUntilExpiry < 30) {
        sources.push({
          type: 'expiry',
          severity: 'high',
          description: `Credential expiring in ${Math.round(daysUntilExpiry)} days`,
          deadline: expiryDate,
        });
        totalPressure += 0.4;
      } else if (daysUntilExpiry < 90) {
        sources.push({
          type: 'expiry',
          severity: 'medium',
          description: `Credential expiring in ${Math.round(daysUntilExpiry)} days`,
          deadline: expiryDate,
        });
        totalPressure += 0.2;
      }
    }

    // Verification pressure
    if (verificationStatus === 'pending') {
      sources.push({
        type: 'verification',
        severity: 'medium',
        description: 'Verification pending',
      });
      totalPressure += 0.2;
    } else if (verificationStatus === 'failed') {
      sources.push({
        type: 'verification',
        severity: 'high',
        description: 'Verification failed',
      });
      totalPressure += 0.4;
    }

    // Regulatory pressure
    regulatoryChecks?.forEach((check) => {
      if (check.status === 'fail') {
        sources.push({
          type: check.type,
          severity: 'high',
          description: `${check.type} check failed`,
          deadline: check.deadline,
        });
        totalPressure += 0.3;
      } else if (check.status === 'pending' && check.deadline) {
        const daysUntilDeadline =
          (check.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilDeadline < 30) {
          sources.push({
            type: check.type,
            severity: daysUntilDeadline < 7 ? 'high' : 'medium',
            description: `${check.type} check pending`,
            deadline: check.deadline,
          });
          totalPressure += daysUntilDeadline < 7 ? 0.3 : 0.15;
        }
      }
    });

    // Determine final gradient
    const finalRiskScore = Math.min(1, totalPressure);
    const gradient = this.mapRiskToGradient(finalRiskScore);

    // Calculate visualization parameters
    const intensity = finalRiskScore;
    const pulseRate = finalRiskScore > 0.7 ? 2 : finalRiskScore > 0.4 ? 1 : 0.5;

    return {
      credentialId,
      pressureLevel: Math.min(1, totalPressure),
      sources,
      visualizations: {
        gradient,
        intensity,
        pulseRate,
      },
    };
  }

  /**
   * Get all gradient definitions
   */
  getAllGradients(): RiskGradient[] {
    return Array.from(this.gradients.values()).sort(
      (a, b) => b.threshold - a.threshold
    );
  }

  /**
   * Get gradient by level
   */
  getGradient(level: RiskLevel): RiskGradient {
    return this.gradients.get(level)!;
  }
}

