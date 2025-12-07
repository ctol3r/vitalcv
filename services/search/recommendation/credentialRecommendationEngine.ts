/**
 * B232B-SEARCH-008: CredentialRecommendationEngine
 *
 * Recommends credential upgrades or additional credentials to clinicians based on:
 * - Career path
 * - Market demand
 * - Peer comparisons
 * Integrates with Reputation and Analytics services.
 */

import { PrismaClient } from '@prisma/client';
import { getReputation } from '../../reputation/models/ClinicianReputation.js';

const prisma = new PrismaClient();

export interface CredentialRecommendation {
  credentialType: string;
  credentialName: string;
  issuer?: string;
  score: number; // 0-1 recommendation score
  reasons: string[]; // Explanation of why this credential was recommended
  matchFactors: {
    careerPathMatch?: number;
    marketDemandScore?: number;
    peerComparisonScore?: number;
    reputationBoost?: number;
  };
  estimatedValue?: {
    salaryIncrease?: number;
    opportunityIncrease?: number;
  };
}

export interface CredentialRecommendationContext {
  clinicianId: string;
  currentCredentials?: string[]; // Credential types already held
  specialty?: string;
  region?: string;
  careerStage?: 'early' | 'mid' | 'senior';
  limit?: number;
}

/**
 * CredentialRecommendationEngine - Generates personalized credential recommendations
 */
export class CredentialRecommendationEngine {
  /**
   * Get recommended credentials for a clinician
   */
  async getRecommendations(
    context: CredentialRecommendationContext
  ): Promise<CredentialRecommendation[]> {
    const limit = context.limit || 10;
    const recommendations: CredentialRecommendation[] = [];

    // Get clinician's current credentials
    const currentCredentials = context.currentCredentials || await this.getCurrentCredentials(context.clinicianId);

    // Get available credential types (excluding already held ones)
    const availableCredentialTypes = await this.getAvailableCredentialTypes(currentCredentials);

    // Score each credential type
    for (const credentialType of availableCredentialTypes) {
      const score = await this.scoreCredential(credentialType, context);
      if (score.score > 0) {
        recommendations.push({
          credentialType: credentialType.type,
          credentialName: credentialType.name,
          issuer: credentialType.issuer,
          score: score.score,
          reasons: score.reasons,
          matchFactors: score.matchFactors,
          estimatedValue: score.estimatedValue,
        });
      }
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get current credentials for a clinician
   */
  private async getCurrentCredentials(clinicianId: string): Promise<string[]> {
    const credentials = await prisma.credential.findMany({
      where: {
        holderDid: {
          // Assuming clinicianId maps to a DID or user ID
          // This is a placeholder - adjust based on your schema
        },
        status: 'ACTIVE',
      },
      select: {
        type: true,
      },
    });

    return credentials.map((c) => c.type);
  }

  /**
   * Get available credential types (excluding already held ones)
   */
  private async getAvailableCredentialTypes(
    currentCredentials: string[]
  ): Promise<Array<{ type: string; name: string; issuer?: string }>> {
    // This would typically come from a credential registry or taxonomy
    // For now, we'll use a hardcoded list of common healthcare credentials
    const allCredentialTypes = [
      { type: 'board_certification', name: 'Board Certification', issuer: 'ABMS' },
      { type: 'subspecialty', name: 'Subspecialty Certification', issuer: 'ABMS' },
      { type: 'telemedicine', name: 'Telemedicine Certification', issuer: 'ATA' },
      { type: 'quality_improvement', name: 'Quality Improvement Certification', issuer: 'NAHQ' },
      { type: 'informatics', name: 'Clinical Informatics Certification', issuer: 'ABPM' },
      { type: 'patient_safety', name: 'Patient Safety Certification', issuer: 'CPPS' },
      { type: 'leadership', name: 'Healthcare Leadership Certification', issuer: 'ACHE' },
      { type: 'research', name: 'Clinical Research Certification', issuer: 'ACRP' },
    ];

    return allCredentialTypes.filter(
      (ct) => !currentCredentials.includes(ct.type)
    );
  }

  /**
   * Score a credential based on context
   */
  private async scoreCredential(
    credentialType: { type: string; name: string; issuer?: string },
    context: CredentialRecommendationContext
  ): Promise<{
    score: number;
    reasons: string[];
    matchFactors: CredentialRecommendation['matchFactors'];
    estimatedValue?: CredentialRecommendation['estimatedValue'];
  }> {
    const reasons: string[] = [];
    const matchFactors: CredentialRecommendation['matchFactors'] = {};
    let score = 0;

    // 1. Career path match
    const careerPathScore = await this.calculateCareerPathMatch(credentialType.type, context);
    if (careerPathScore > 0) {
      matchFactors.careerPathMatch = careerPathScore;
      score += careerPathScore;
      reasons.push('Aligns with your career progression path');
    }

    // 2. Market demand score
    const marketDemandScore = await this.calculateMarketDemand(credentialType.type, context);
    if (marketDemandScore > 0) {
      matchFactors.marketDemandScore = marketDemandScore;
      score += marketDemandScore;
      reasons.push('High market demand for this credential');
    }

    // 3. Peer comparison score
    const peerScore = await this.calculatePeerComparison(credentialType.type, context);
    if (peerScore > 0) {
      matchFactors.peerComparisonScore = peerScore;
      score += peerScore;
      reasons.push('Commonly held by peers in your specialty');
    }

    // 4. Reputation boost (if clinician has good reputation, recommend credentials that enhance it)
    const reputationBoost = await this.calculateReputationBoost(credentialType.type, context);
    if (reputationBoost > 0) {
      matchFactors.reputationBoost = reputationBoost;
      score += reputationBoost;
      reasons.push('Would enhance your professional reputation');
    }

    // 5. Estimated value (salary/opportunity increase)
    const estimatedValue = await this.estimateValue(credentialType.type, context);
    if (estimatedValue) {
      if (estimatedValue.salaryIncrease && estimatedValue.salaryIncrease > 0) {
        reasons.push(`Potential salary increase: ${estimatedValue.salaryIncrease}%`);
      }
      if (estimatedValue.opportunityIncrease && estimatedValue.opportunityIncrease > 0) {
        reasons.push(`Increases job opportunities by ${estimatedValue.opportunityIncrease}%`);
      }
    }

    // Normalize score to 0-1 range
    score = Math.min(score, 1.0);

    return { score, reasons, matchFactors, estimatedValue };
  }

  /**
   * Calculate career path match score
   */
  private async calculateCareerPathMatch(
    credentialType: string,
    context: CredentialRecommendationContext
  ): Promise<number> {
    // Simple heuristic based on career stage
    const stageCredentialMap: Record<string, string[]> = {
      early: ['board_certification', 'telemedicine'],
      mid: ['subspecialty', 'quality_improvement', 'informatics'],
      senior: ['leadership', 'research', 'patient_safety'],
    };

    const recommendedForStage = stageCredentialMap[context.careerStage || 'mid'] || [];
    if (recommendedForStage.includes(credentialType)) {
      return 0.25;
    }

    return 0;
  }

  /**
   * Calculate market demand score based on job postings and trends
   */
  private async calculateMarketDemand(
    credentialType: string,
    context: CredentialRecommendationContext
  ): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count job postings that require or prefer this credential
    const jobCount = await prisma.jobPosting.count({
      where: {
        // Assuming job postings have a requiredCredentials or preferredCredentials field
        // This is a placeholder - adjust based on your schema
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Normalize based on total job postings
    const totalJobs = await prisma.jobPosting.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    if (totalJobs === 0) {
      return 0;
    }

    const demandRatio = jobCount / totalJobs;

    // Score based on demand ratio
    if (demandRatio > 0.3) {
      return 0.3;
    } else if (demandRatio > 0.15) {
      return 0.2;
    } else if (demandRatio > 0.05) {
      return 0.1;
    }

    return 0;
  }

  /**
   * Calculate peer comparison score
   */
  private async calculatePeerComparison(
    credentialType: string,
    context: CredentialRecommendationContext
  ): Promise<number> {
    // Get peers (clinicians with same specialty and similar experience)
    // Count how many peers have this credential
    const peerCredentials = await prisma.credential.count({
      where: {
        type: credentialType,
        status: 'ACTIVE',
        // Filter by specialty if available in credential metadata
      },
    });

    // Get total peer count (simplified - in production, would filter by specialty/region)
    const totalPeers = await prisma.credential.groupBy({
      by: ['holderDid'],
      where: {
        status: 'ACTIVE',
      },
    });

    if (totalPeers.length === 0) {
      return 0;
    }

    const peerRatio = peerCredentials / totalPeers.length;

    // Score based on peer adoption
    if (peerRatio > 0.5) {
      return 0.25; // Very common among peers
    } else if (peerRatio > 0.3) {
      return 0.15; // Common among peers
    } else if (peerRatio > 0.1) {
      return 0.1; // Somewhat common
    }

    return 0;
  }

  /**
   * Calculate reputation boost score
   */
  private async calculateReputationBoost(
    credentialType: string,
    context: CredentialRecommendationContext
  ): Promise<number> {
    // Get clinician's reputation
    const reputation = await getReputation(context.clinicianId);

    if (!reputation) {
      return 0;
    }

    // If reputation is already high, recommend credentials that maintain/enhance it
    if (reputation.overallScore > 80) {
      // High-value credentials for high-reputation clinicians
      const highValueCredentials = ['leadership', 'research', 'subspecialty'];
      if (highValueCredentials.includes(credentialType)) {
        return 0.1;
      }
    } else if (reputation.overallScore < 50) {
      // For lower reputation, recommend foundational credentials
      const foundationalCredentials = ['board_certification', 'quality_improvement'];
      if (foundationalCredentials.includes(credentialType)) {
        return 0.15;
      }
    }

    return 0;
  }

  /**
   * Estimate value (salary/opportunity increase) of a credential
   */
  private async estimateValue(
    credentialType: string,
    context: CredentialRecommendationContext
  ): Promise<CredentialRecommendation['estimatedValue'] | undefined> {
    // This would typically use market data or ML models
    // For now, use simple heuristics based on credential type
    const valueMap: Record<string, { salaryIncrease: number; opportunityIncrease: number }> = {
      board_certification: { salaryIncrease: 5, opportunityIncrease: 15 },
      subspecialty: { salaryIncrease: 10, opportunityIncrease: 25 },
      leadership: { salaryIncrease: 15, opportunityIncrease: 30 },
      research: { salaryIncrease: 8, opportunityIncrease: 20 },
      telemedicine: { salaryIncrease: 5, opportunityIncrease: 20 },
    };

    return valueMap[credentialType];
  }
}

// Export singleton instance
export const credentialRecommendationEngine = new CredentialRecommendationEngine();

