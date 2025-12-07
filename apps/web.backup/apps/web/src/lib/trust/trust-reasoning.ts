/**
 * Multi-Hint Trust Reasoning Explanation
 * Task 15: Add multi-hint trust reasoning explanation
 *
 * Provides human-readable explanations for trust calculations
 * by combining multiple hints and signals.
 */

import type { TrustScore } from '@/lib/services/trust-service';
import type { ChainSignal } from '../chain/truth-field-generator';

export interface TrustHint {
  id: string;
  category: 'issuer' | 'evidence' | 'chain' | 'temporal' | 'consensus';
  weight: number; // 0-1, how much this hint contributes
  message: string;
  confidence: number; // 0-1
  supportingData?: Record<string, unknown>;
}

export interface TrustReasoning {
  overallScore: number;
  hints: TrustHint[];
  primaryFactors: string[];
  concerns: string[];
  recommendations: string[];
  explanation: string; // Human-readable summary
}

export class MultiHintTrustReasoner {
  /**
   * Generate comprehensive trust reasoning from multiple sources
   */
  generateReasoning(
    trustScore: TrustScore,
    chainSignals: ChainSignal[],
    issuerReliability?: number,
    evidenceCompleteness?: number,
    additionalContext?: Record<string, unknown>
  ): TrustReasoning {
    const hints: TrustHint[] = [];

    // Analyze issuer hints
    hints.push(...this.analyzeIssuerHints(trustScore, issuerReliability));

    // Analyze evidence hints
    hints.push(...this.analyzeEvidenceHints(trustScore, evidenceCompleteness));

    // Analyze chain hints
    hints.push(...this.analyzeChainHints(trustScore, chainSignals));

    // Analyze temporal hints
    hints.push(...this.analyzeTemporalHints(chainSignals, additionalContext));

    // Analyze consensus hints
    hints.push(...this.analyzeConsensusHints(chainSignals));

    // Sort hints by weight
    hints.sort((a, b) => b.weight - a.weight);

    // Extract primary factors
    const primaryFactors = hints
      .filter((h) => h.weight > 0.5)
      .slice(0, 5)
      .map((h) => h.message);

    // Extract concerns
    const concerns = hints
      .filter((h) => h.confidence < 0.5 || h.weight < 0.3)
      .map((h) => h.message);

    // Generate recommendations
    const recommendations = this.generateRecommendations(hints, trustScore);

    // Generate explanation
    const explanation = this.generateExplanation(trustScore, hints, primaryFactors, concerns);

    return {
      overallScore: trustScore.overall,
      hints,
      primaryFactors,
      concerns,
      recommendations,
      explanation,
    };
  }

  /**
   * Analyze issuer-related hints
   */
  private analyzeIssuerHints(
    trustScore: TrustScore,
    issuerReliability?: number
  ): TrustHint[] {
    const hints: TrustHint[] = [];

    const issuerScore = trustScore.breakdown.issuer;

    hints.push({
      id: 'issuer_base',
      category: 'issuer',
      weight: 0.3,
      message: issuerScore > 0.8
        ? 'Issuer has strong reputation and verification history'
        : issuerScore > 0.5
        ? 'Issuer has moderate reputation'
        : 'Issuer reputation is limited or unverified',
      confidence: issuerScore,
      supportingData: { issuerScore },
    });

    if (issuerReliability !== undefined) {
      hints.push({
        id: 'issuer_reliability',
        category: 'issuer',
        weight: 0.25,
        message: issuerReliability > 0.8
          ? 'Issuer demonstrates high reliability with consistent signatures'
          : issuerReliability > 0.5
          ? 'Issuer reliability is moderate'
          : 'Issuer reliability patterns show some inconsistencies',
        confidence: issuerReliability,
        supportingData: { issuerReliability },
      });
    }

    return hints;
  }

  /**
   * Analyze evidence-related hints
   */
  private analyzeEvidenceHints(
    trustScore: TrustScore,
    evidenceCompleteness?: number
  ): TrustHint[] {
    const hints: TrustHint[] = [];

    const evidenceScore = trustScore.breakdown.evidence;

    hints.push({
      id: 'evidence_base',
      category: 'evidence',
      weight: 0.2,
      message: evidenceScore > 0.7
        ? 'Strong supporting evidence available'
        : evidenceScore > 0.3
        ? 'Limited evidence available'
        : 'Minimal or no supporting evidence',
      confidence: evidenceScore,
      supportingData: { evidenceScore },
    });

    if (evidenceCompleteness !== undefined) {
      hints.push({
        id: 'evidence_completeness',
        category: 'evidence',
        weight: 0.15,
        message: evidenceCompleteness > 0.8
          ? 'Evidence documentation is comprehensive'
          : evidenceCompleteness > 0.5
          ? 'Evidence documentation is partially complete'
          : 'Evidence documentation is incomplete',
        confidence: evidenceCompleteness,
        supportingData: { evidenceCompleteness },
      });
    }

    return hints;
  }

  /**
   * Analyze chain-related hints
   */
  private analyzeChainHints(
    trustScore: TrustScore,
    chainSignals: ChainSignal[]
  ): TrustHint[] {
    const hints: TrustHint[] = [];

    const anchorScore = trustScore.breakdown.anchor;

    hints.push({
      id: 'chain_anchor',
      category: 'chain',
      weight: 0.25,
      message: anchorScore > 0.8
        ? 'Credential is anchored and verified on blockchain'
        : anchorScore > 0.5
        ? 'Credential anchoring status is pending verification'
        : 'Credential is not anchored to blockchain',
      confidence: anchorScore,
      supportingData: { anchorScore, signalCount: chainSignals.length },
    });

    if (chainSignals.length > 0) {
      const verifiedSignals = chainSignals.filter((s) => s.type === 'verification');
      if (verifiedSignals.length > 0) {
        hints.push({
          id: 'chain_verification',
          category: 'chain',
          weight: 0.2,
          message: `Verified by ${verifiedSignals.length} blockchain verification(s)`,
          confidence: verifiedSignals.reduce((sum, s) => sum + s.confidence, 0) / verifiedSignals.length,
          supportingData: { verificationCount: verifiedSignals.length },
        });
      }

      const consensusSignals = chainSignals.filter((s) => s.type === 'consensus');
      if (consensusSignals.length > 0) {
        hints.push({
          id: 'chain_consensus',
          category: 'chain',
          weight: 0.15,
          message: `Multiple networks confirm credential validity`,
          confidence: 0.8,
          supportingData: { consensusCount: consensusSignals.length },
        });
      }
    }

    return hints;
  }

  /**
   * Analyze temporal hints
   */
  private analyzeTemporalHints(
    chainSignals: ChainSignal[],
    context?: Record<string, unknown>
  ): TrustHint[] {
    const hints: TrustHint[] = [];

    if (chainSignals.length === 0) {
      hints.push({
        id: 'temporal_no_signals',
        category: 'temporal',
        weight: 0.1,
        message: 'No recent blockchain activity recorded',
        confidence: 0.5,
      });
      return hints;
    }

    const now = new Date();
    const recentSignals = chainSignals.filter(
      (s) => now.getTime() - s.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000
    );

    if (recentSignals.length > 0) {
      hints.push({
        id: 'temporal_recency',
        category: 'temporal',
        weight: 0.15,
        message: `Recent blockchain activity (${recentSignals.length} signal(s) in past 30 days)`,
        confidence: 0.8,
        supportingData: { recentCount: recentSignals.length },
      });
    } else {
      hints.push({
        id: 'temporal_stale',
        category: 'temporal',
        weight: 0.1,
        message: 'No recent blockchain activity - credential may be stale',
        confidence: 0.6,
      });
    }

    // Check freshness from context
    if (context?.issuedAt) {
      const issuedDate = new Date(context.issuedAt as string);
      const ageInDays = (now.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24);

      hints.push({
        id: 'temporal_freshness',
        category: 'temporal',
        weight: 0.1,
        message: ageInDays < 365
          ? `Credential issued recently (${Math.round(ageInDays)} days ago)`
          : `Credential issued ${Math.round(ageInDays / 365)} year(s) ago`,
        confidence: ageInDays < 730 ? 0.9 : 0.6,
        supportingData: { ageInDays },
      });
    }

    return hints;
  }

  /**
   * Analyze consensus hints
   */
  private analyzeConsensusHints(chainSignals: ChainSignal[]): TrustHint[] {
    const hints: TrustHint[] = [];

    if (chainSignals.length === 0) {
      return hints;
    }

    const networks = new Set(chainSignals.map((s) => s.network));

    if (networks.size > 1) {
      hints.push({
        id: 'consensus_multi_network',
        category: 'consensus',
        weight: 0.2,
        message: `Cross-verified across ${networks.size} blockchain network(s)`,
        confidence: 0.85,
        supportingData: { networkCount: networks.size },
      });
    }

    const avgConfidence = chainSignals.reduce((sum, s) => sum + s.confidence, 0) / chainSignals.length;
    if (avgConfidence > 0.8) {
      hints.push({
        id: 'consensus_high_confidence',
        category: 'consensus',
        weight: 0.15,
        message: 'High confidence across all verification signals',
        confidence: avgConfidence,
        supportingData: { averageConfidence: avgConfidence },
      });
    }

    return hints;
  }

  /**
   * Generate recommendations based on hints
   */
  private generateRecommendations(
    hints: TrustHint[],
    trustScore: TrustScore
  ): string[] {
    const recommendations: string[] = [];

    // Low trust score recommendations
    if (trustScore.overall < 0.5) {
      recommendations.push('Consider obtaining additional verification');
      recommendations.push('Review credential documentation completeness');
    }

    // Missing anchor
    const anchorHint = hints.find((h) => h.id === 'chain_anchor');
    if (anchorHint && anchorHint.confidence < 0.5) {
      recommendations.push('Anchor credential to blockchain for enhanced trust');
    }

    // Low evidence
    const evidenceHint = hints.find((h) => h.id === 'evidence_base');
    if (evidenceHint && evidenceHint.confidence < 0.5) {
      recommendations.push('Add supporting evidence documents');
    }

    // Stale credential
    const staleHint = hints.find((h) => h.id === 'temporal_stale');
    if (staleHint) {
      recommendations.push('Update credential or verify current status');
    }

    // High trust - maintenance recommendations
    if (trustScore.overall > 0.8) {
      recommendations.push('Maintain current trust level with regular updates');
    }

    return recommendations;
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    trustScore: TrustScore,
    hints: TrustHint[],
    primaryFactors: string[],
    concerns: string[]
  ): string {
    const parts: string[] = [];

    // Overall assessment
    const tier = trustScore.overall >= 0.8 ? 'high'
      : trustScore.overall >= 0.5 ? 'medium'
      : 'low';

    parts.push(`This credential has ${tier} trust (${Math.round(trustScore.overall * 100)}%).`);

    // Primary factors
    if (primaryFactors.length > 0) {
      parts.push(`Key factors: ${primaryFactors.slice(0, 3).join('; ')}.`);
    }

    // Concerns
    if (concerns.length > 0) {
      parts.push(`Areas of concern: ${concerns.slice(0, 2).join('; ')}.`);
    }

    // Breakdown summary
    const breakdown = trustScore.breakdown;
    const strongest = Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)[0];
    const weakest = Object.entries(breakdown)
      .sort(([, a], [, b]) => a - b)[0];

    parts.push(
      `Strongest component: ${strongest[0]} (${Math.round(strongest[1] * 100)}%). ` +
      `Weakest component: ${weakest[0]} (${Math.round(weakest[1] * 100)}%).`
    );

    return parts.join(' ');
  }
}

export const trustReasoner = new MultiHintTrustReasoner();

