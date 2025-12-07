/**
 * TrustService
 * Calculates trust scores and provides trust analysis
 */

import type { Credential } from '@/lib/repositories/credential-repository';
import type { AnchorStatus } from './chain-service';
import type { Evidence } from '@/lib/repositories/evidence-repository';

export interface TrustScore {
  overall: number; // 0-1
  breakdown: {
    issuer: number; // Issuer reputation
    anchor: number; // Blockchain verification
    evidence: number; // Evidence completeness
    freshness: number; // Recency of data
    verification: number; // Third-party verification
  };
  tier: 'high' | 'medium' | 'low';
  reasons: string[];
}

export interface ProofHealth {
  score: number; // 0-1
  completeness: number; // 0-1
  missing: string[];
  strengths: string[];
}

export interface SelectiveDisclosure {
  disclosed: string[];
  hidden: string[];
  rationale?: Record<string, string>;
}

export class TrustService {
  calculateTrustScore(
    credential: Credential,
    anchorStatus?: AnchorStatus,
    evidence?: Evidence[],
  ): TrustScore {
    const breakdown = {
      issuer: this.calculateIssuerTrust(credential),
      anchor: this.calculateAnchorTrust(anchorStatus),
      evidence: this.calculateEvidenceTrust(evidence),
      freshness: this.calculateFreshness(credential),
      verification: this.calculateVerificationTrust(credential),
    };

    const overall =
      breakdown.issuer * 0.3 +
      breakdown.anchor * 0.25 +
      breakdown.evidence * 0.2 +
      breakdown.freshness * 0.15 +
      breakdown.verification * 0.1;

    const tier = overall >= 0.8 ? 'high' : overall >= 0.5 ? 'medium' : 'low';

    const reasons = this.generateTrustReasons(breakdown, anchorStatus, evidence);

    return {
      overall,
      breakdown,
      tier,
      reasons,
    };
  }

  calculateProofHealth(evidence?: Evidence[], anchorStatus?: AnchorStatus): ProofHealth {
    const missing: string[] = [];
    const strengths: string[] = [];

    if (!evidence || evidence.length === 0) {
      missing.push('No evidence files attached');
    } else {
      strengths.push(`${evidence.length} evidence file(s) available`);

      const hasPdf = evidence.some((e) => e.type === 'pdf');
      const hasImage = evidence.some((e) => e.type === 'image');

      if (!hasPdf) missing.push('No PDF documentation');
      if (!hasImage) missing.push('No image evidence');
    }

    if (!anchorStatus?.anchored) {
      missing.push('Not anchored to blockchain');
    } else {
      strengths.push('Blockchain anchored');
    }

    if (!anchorStatus?.verified) {
      missing.push('Anchor verification pending');
    } else {
      strengths.push('Anchor verified');
    }

    const completeness = 1 - missing.length * 0.2;
    const score = Math.max(0, Math.min(1, completeness));

    return {
      score,
      completeness,
      missing,
      strengths,
    };
  }

  analyzeSelectiveDisclosure(credential: Credential): SelectiveDisclosure {
    const allFields = Object.keys(credential.subject.claims);
    const sensitiveFields = credential.sensitiveFields || [];
    const disclosed = allFields.filter((f) => !sensitiveFields.includes(f));
    const hidden = sensitiveFields;

    const rationale: Record<string, string> = {};
    sensitiveFields.forEach((field) => {
      rationale[field] = 'Hidden for privacy protection (SD-JWT)';
    });

    return {
      disclosed,
      hidden,
      rationale,
    };
  }

  private calculateIssuerTrust(credential: Credential): number {
    let score = 0.5; // Base score

    // Trust tier boost
    if (credential.issuer.trustTier === 'verified') score += 0.3;
    else if (credential.issuer.trustTier === 'trusted') score += 0.2;

    // Known issuer patterns
    if (credential.issuer.name.includes('Board') || credential.issuer.name.includes('Medical')) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  private calculateAnchorTrust(anchorStatus?: AnchorStatus): number {
    if (!anchorStatus?.anchored) return 0;
    if (!anchorStatus.verified) return 0.5;
    if (anchorStatus.mismatch) return 0.3;
    return 1.0;
  }

  private calculateEvidenceTrust(evidence?: Evidence[]): number {
    if (!evidence || evidence.length === 0) return 0;

    let score = 0.3; // Base for having evidence

    const hasPdf = evidence.some((e) => e.type === 'pdf');
    const hasImage = evidence.some((e) => e.type === 'image');
    const hasDigest = evidence.some((e) => e.sha256 || e.digest);

    if (hasPdf) score += 0.3;
    if (hasImage) score += 0.2;
    if (hasDigest) score += 0.2;

    return Math.min(1, score);
  }

  private calculateFreshness(credential: Credential): number {
    const issuedAt = new Date(credential.issuedAt);
    const now = new Date();
    const ageInDays = (now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Fresh if less than 1 year old
    if (ageInDays < 365) return 1.0;
    // Good if less than 2 years old
    if (ageInDays < 730) return 0.7;
    // Moderate if less than 5 years old
    if (ageInDays < 1825) return 0.4;
    // Old if older
    return 0.2;
  }

  private calculateVerificationTrust(credential: Credential): number {
    // Check if credential has been verified by third parties
    if (credential.proofLink) return 0.8;
    if (credential.riskScore !== undefined && credential.riskScore < 0.3) return 0.6;
    return 0.3;
  }

  private generateTrustReasons(
    breakdown: TrustScore['breakdown'],
    anchorStatus?: AnchorStatus,
    evidence?: Evidence[],
  ): string[] {
    const reasons: string[] = [];

    if (breakdown.issuer >= 0.8) {
      reasons.push('Verified issuer with strong reputation');
    }

    if (breakdown.anchor >= 0.8) {
      reasons.push('Anchored and verified on blockchain');
    } else if (breakdown.anchor === 0) {
      reasons.push('Not yet anchored to blockchain');
    }

    if (breakdown.evidence >= 0.7) {
      reasons.push('Strong evidence documentation');
    } else if (breakdown.evidence < 0.3) {
      reasons.push('Limited evidence available');
    }

    if (breakdown.freshness >= 0.8) {
      reasons.push('Recently issued credential');
    }

    if (anchorStatus?.mismatch) {
      reasons.push('⚠️ Anchor mismatch detected - needs review');
    }

    return reasons;
  }
}

export const trustService = new TrustService();

