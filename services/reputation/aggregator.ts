/**
 * B224A-REP-002: ReputationAggregator
 *
 * Aggregates signals from multiple sources to compute weighted reputation scores per clinician.
 * Sources: privilege engine, quality fusion, enrollment completeness, drift events, audit outcomes.
 */

import { updateReputation } from './models/ClinicianReputation.js';
import { getPortfolio } from './portfolioService.js';

/**
 * Weight schema for reputation components
 * All weights should sum to 1.0
 */
export interface ReputationWeightSchema {
  quality: number; // Quality fusion signals
  credential: number; // Privilege engine signals
  enrollment: number; // Enrollment completeness
  peerReviews: number; // Peer review scores
  drift: number; // Drift event penalties
  audit: number; // Audit outcome signals
}

/**
 * Default weight schema
 */
export const DEFAULT_WEIGHTS: ReputationWeightSchema = {
  quality: 0.3,
  credential: 0.25,
  enrollment: 0.2,
  peerReviews: 0.15,
  drift: -0.05, // Negative weight for penalties
  audit: 0.05,
};

/**
 * Input signals from various sources
 */
export interface ReputationSignals {
  clinicianId: string;
  qualityScore?: number; // 0-100 from quality fusion
  credentialScore?: number; // 0-100 from privilege engine
  enrollmentScore?: number; // 0-100 from enrollment completeness
  peerReviewsScore?: number; // 0-100 from peer reviews
  driftPenalty?: number; // 0-1 penalty multiplier (0 = no penalty, 1 = max penalty)
  auditScore?: number; // 0-100 from audit outcomes
}

/**
 * Reputation aggregation result
 */
export interface ReputationResult {
  clinicianId: string;
  overallScore: number;
  qualityScore: number;
  credentialScore: number;
  enrollmentScore: number;
  peerReviewsScore: number;
  breakdown: {
    quality: { score: number; weight: number; weighted: number };
    credential: { score: number; weight: number; weighted: number };
    enrollment: { score: number; weight: number; weighted: number };
    peerReviews: { score: number; weight: number; weighted: number };
    drift: { penalty: number; weight: number; impact: number };
    audit: { score: number; weight: number; weighted: number };
  };
}

/**
 * ReputationAggregator class
 */
export class ReputationAggregator {
  private weights: ReputationWeightSchema;

  constructor(weights: ReputationWeightSchema = DEFAULT_WEIGHTS) {
    // Validate weights sum to approximately 1.0
    const sum = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Weights must sum to 1.0, got ${sum}`);
    }
    this.weights = weights;
  }

  /**
   * Aggregate signals into reputation scores
   */
  async aggregate(signals: ReputationSignals): Promise<ReputationResult> {
    const {
      clinicianId,
      qualityScore = 0,
      credentialScore = 0,
      enrollmentScore = 0,
      peerReviewsScore = 0,
      driftPenalty = 0,
      auditScore = 0,
    } = signals;

    // Normalize scores to 0-100 range
    const normalizedQuality = Math.max(0, Math.min(100, qualityScore));
    const normalizedCredential = Math.max(0, Math.min(100, credentialScore));
    const normalizedEnrollment = Math.max(0, Math.min(100, enrollmentScore));
    const normalizedPeerReviews = Math.max(0, Math.min(100, peerReviewsScore));
    const normalizedAudit = Math.max(0, Math.min(100, auditScore));
    const normalizedDriftPenalty = Math.max(0, Math.min(1, driftPenalty));

    // Calculate weighted components
    const qualityWeighted = normalizedQuality * this.weights.quality;
    const credentialWeighted = normalizedCredential * this.weights.credential;
    const enrollmentWeighted = normalizedEnrollment * this.weights.enrollment;
    const peerReviewsWeighted = normalizedPeerReviews * this.weights.peerReviews;
    const auditWeighted = normalizedAudit * this.weights.audit;

    // Drift penalty reduces overall score
    const driftImpact = normalizedDriftPenalty * Math.abs(this.weights.drift);

    // Calculate overall score
    let overallScore =
      qualityWeighted +
      credentialWeighted +
      enrollmentWeighted +
      peerReviewsWeighted +
      auditWeighted -
      driftImpact;

    // Ensure score is in 0-100 range
    overallScore = Math.max(0, Math.min(100, overallScore));

    const result: ReputationResult = {
      clinicianId,
      overallScore,
      qualityScore: normalizedQuality,
      credentialScore: normalizedCredential,
      enrollmentScore: normalizedEnrollment,
      peerReviewsScore: normalizedPeerReviews,
      breakdown: {
        quality: {
          score: normalizedQuality,
          weight: this.weights.quality,
          weighted: qualityWeighted,
        },
        credential: {
          score: normalizedCredential,
          weight: this.weights.credential,
          weighted: credentialWeighted,
        },
        enrollment: {
          score: normalizedEnrollment,
          weight: this.weights.enrollment,
          weighted: enrollmentWeighted,
        },
        peerReviews: {
          score: normalizedPeerReviews,
          weight: this.weights.peerReviews,
          weighted: peerReviewsWeighted,
        },
        drift: {
          penalty: normalizedDriftPenalty,
          weight: this.weights.drift,
          impact: driftImpact,
        },
        audit: {
          score: normalizedAudit,
          weight: this.weights.audit,
          weighted: auditWeighted,
        },
      },
    };

    // Persist to database
    await updateReputation(clinicianId, {
      overallScore: result.overallScore,
      qualityScore: result.qualityScore,
      credentialScore: result.credentialScore,
      enrollmentScore: result.enrollmentScore,
      peerReviewsScore: result.peerReviewsScore,
    });

    return result;
  }

  /**
   * Recompute reputation from portfolio data
   */
  async recomputeFromPortfolio(clinicianId: string): Promise<ReputationResult> {
    const portfolio = await getPortfolio(clinicianId);

    return this.aggregate({
      clinicianId,
      qualityScore: portfolio.qualityScore,
      credentialScore: portfolio.credentialScore,
      enrollmentScore: portfolio.enrollmentScore,
      peerReviewsScore: portfolio.peerReviewsScore,
      driftPenalty: portfolio.driftPenalty,
      auditScore: portfolio.auditScore,
    });
  }

  /**
   * Update weights schema
   */
  updateWeights(weights: Partial<ReputationWeightSchema>): void {
    this.weights = { ...this.weights, ...weights };
    // Re-validate
    const sum = Object.values(this.weights).reduce((a, b) => a + Math.abs(b), 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Weights must sum to 1.0, got ${sum}`);
    }
  }

  /**
   * Get current weights
   */
  getWeights(): ReputationWeightSchema {
    return { ...this.weights };
  }
}

/**
 * Default aggregator instance
 */
export const reputationAggregator = new ReputationAggregator();

