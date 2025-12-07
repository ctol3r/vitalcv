/**
 * Facility Privileging Engine - Risk Score Adjustment
 * Phase 5: Risk score adjustment for high-risk privileges
 */

import type { Privilege, PrivilegeEligibilityResult, ClinicianProfile } from './models';
import { PrivilegeEvaluationService } from './PrivilegeEvaluationService';

export class RiskScoreAdjustmentService {
  private evaluationService: PrivilegeEvaluationService;

  constructor() {
    this.evaluationService = new PrivilegeEvaluationService();
  }

  /**
   * Adjust risk score for high-risk privileges
   * Phase 5: Risk score adjustment for high-risk privileges
   */
  adjustRiskScoreForHighRiskPrivilege(
    privilege: Privilege,
    baseRiskScore: number,
    profile: ClinicianProfile
  ): {
    adjustedRiskScore: number;
    adjustments: Array<{ reason: string; adjustment: number }>;
    finalRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    let adjustedScore = baseRiskScore;
    const adjustments: Array<{ reason: string; adjustment: number }> = [];

    // High-risk privilege multiplier
    if (privilege.riskLevel === 'critical') {
      const adjustment = baseRiskScore * 0.3; // 30% increase
      adjustedScore += adjustment;
      adjustments.push({
        reason: 'Critical risk privilege requires additional scrutiny',
        adjustment: adjustment,
      });
    } else if (privilege.riskLevel === 'high') {
      const adjustment = baseRiskScore * 0.2; // 20% increase
      adjustedScore += adjustment;
      adjustments.push({
        reason: 'High risk privilege requires enhanced verification',
        adjustment: adjustment,
      });
    }

    // Adjust for profile risk factors
    const riskAmplifier = this.evaluationService.calculateRiskAmplifier(profile);
    if (riskAmplifier > 1.0) {
      const adjustment = adjustedScore * (riskAmplifier - 1.0);
      adjustedScore += adjustment;
      adjustments.push({
        reason: `Risk amplifier applied: ${(riskAmplifier * 100).toFixed(0)}%`,
        adjustment: adjustment,
      });
    }

    // Adjust for missing high-risk requirements
    if (privilege.riskLevel === 'critical' || privilege.riskLevel === 'high') {
      const missingCredentials = privilege.requiredCredentials.filter(
        (cred) => !profile.credentials.some((c) => c.type === cred && c.verified)
      );
      if (missingCredentials.length > 0) {
        const adjustment = missingCredentials.length * 10;
        adjustedScore += adjustment;
        adjustments.push({
          reason: `Missing ${missingCredentials.length} required credential(s) for high-risk privilege`,
          adjustment: adjustment,
        });
      }
    }

    // Cap at 100
    adjustedScore = Math.min(100, adjustedScore);

    // Determine final risk level
    let finalRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (adjustedScore >= 80) {
      finalRiskLevel = 'critical';
    } else if (adjustedScore >= 60) {
      finalRiskLevel = 'high';
    } else if (adjustedScore >= 40) {
      finalRiskLevel = 'medium';
    } else {
      finalRiskLevel = 'low';
    }

    return {
      adjustedRiskScore: Math.round(adjustedScore),
      adjustments,
      finalRiskLevel,
    };
  }

  /**
   * Apply risk-based restrictions to privilege eligibility
   */
  applyRiskBasedRestrictions(
    eligibility: PrivilegeEligibilityResult,
    profile: ClinicianProfile
  ): {
    restricted: boolean;
    reason?: string;
    requiredActions?: string[];
  } {
    const { privilege } = eligibility;

    // Critical risk privileges require additional checks
    if (privilege.riskLevel === 'critical') {
      // Require all credentials to be verified
      const missingCredentials = privilege.requiredCredentials.filter(
        (cred) => !profile.credentials.some((c) => c.type === cred && c.verified)
      );

      if (missingCredentials.length > 0) {
        return {
          restricted: true,
          reason: 'Critical risk privilege requires all credentials to be verified',
          requiredActions: [
            `Verify all required credentials: ${missingCredentials.join(', ')}`,
            'Obtain supervisor attestation',
            'Complete additional training if required',
          ],
        };
      }

      // Require recent chain anchors (within 30 days)
      const recentAnchors = profile.chainAnchors.filter((anchor) => {
        const anchorDate = new Date(anchor.timestamp);
        const daysSince = (Date.now() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 30;
      });

      if (recentAnchors.length === 0) {
        return {
          restricted: true,
          reason: 'Critical risk privilege requires recent chain anchors',
          requiredActions: [
            'Update credential chain anchors (within last 30 days)',
            'Verify all credentials are current',
          ],
        };
      }
    }

    // High risk privileges require enhanced verification
    if (privilege.riskLevel === 'high') {
      // Require attestation score above threshold
      const attestationCheck = this.evaluationService.checkAttestationScore(
        profile,
        privilege.requiredAttestations,
        85 // Higher threshold for high-risk
      );

      if (!attestationCheck.meetsThreshold) {
        return {
          restricted: true,
          reason: 'High risk privilege requires enhanced attestation score',
          requiredActions: [
            `Obtain additional attestations: ${attestationCheck.missing.join(', ')}`,
            'Ensure all attestations are recent and valid',
          ],
        };
      }
    }

    return {
      restricted: false,
    };
  }

  /**
   * Get risk mitigation recommendations
   */
  getRiskMitigationRecommendations(
    privilege: Privilege,
    profile: ClinicianProfile
  ): string[] {
    const recommendations: string[] = [];

    if (privilege.riskLevel === 'critical' || privilege.riskLevel === 'high') {
      recommendations.push('Complete additional safety training');
      recommendations.push('Obtain peer review and attestation');
      recommendations.push('Maintain active malpractice insurance');
    }

    // Check for expiring credentials
    const expiringCredentials = profile.credentials.filter((c) => {
      if (!c.expiresAt) return false;
      const daysUntilExpiry =
        (new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry < 60;
    });

    if (expiringCredentials.length > 0) {
      recommendations.push(
        `Renew expiring credentials: ${expiringCredentials.map((c) => c.type).join(', ')}`
      );
    }

    // Check for risk factors
    if (profile.riskFactors.length > 0) {
      recommendations.push('Address risk factors before requesting high-risk privileges');
      recommendations.push('Obtain clearance from medical staff office');
    }

    return recommendations;
  }
}
