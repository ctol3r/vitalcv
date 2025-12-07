/**
 * TruthFieldGenerator
 * Task 6: Add TruthFieldGenerator (chain signals → trust vectors)
 *
 * Converts blockchain signals and chain events into trust vectors
 * that can be used for trust calculations and visualizations.
 */

export interface ChainSignal {
  type: 'anchor' | 'verification' | 'update' | 'revocation' | 'consensus';
  timestamp: Date;
  blockHeight?: number;
  txHash?: string;
  network: string;
  confidence: number; // 0-1
  metadata: Record<string, unknown>;
}

export interface TrustVector {
  magnitude: number; // 0-1, overall trust strength
  direction: TrustDirection;
  components: {
    anchor: number; // 0-1
    verification: number; // 0-1
    consensus: number; // 0-1
    freshness: number; // 0-1
    consistency: number; // 0-1
  };
  signals: ChainSignal[];
  calculatedAt: Date;
}

export interface TrustDirection {
  x: number; // -1 to 1, issuer → verifier axis
  y: number; // -1 to 1, static → dynamic axis
  z: number; // -1 to 1, individual → network axis
}

export interface TruthField {
  credentialId: string;
  vectors: TrustVector[];
  aggregated: TrustVector;
  fieldStrength: number; // 0-1
  coherence: number; // 0-1, how well signals agree
  lastUpdated: Date;
}

export class TruthFieldGenerator {
  private signalWindow: number; // milliseconds
  private decayFactor: number; // signal decay over time

  constructor(signalWindowMs: number = 86400000, decayFactor: number = 0.9) {
    this.signalWindow = signalWindowMs;
    this.decayFactor = decayFactor;
  }

  /**
   * Generate trust vector from chain signals
   */
  generateTrustVector(signals: ChainSignal[]): TrustVector {
    if (signals.length === 0) {
      return this.createEmptyVector();
    }

    // Filter signals within time window
    const cutoff = new Date(Date.now() - this.signalWindow);
    const recentSignals = signals.filter((s) => s.timestamp >= cutoff);

    // Calculate component scores
    const anchorScore = this.calculateAnchorScore(recentSignals);
    const verificationScore = this.calculateVerificationScore(recentSignals);
    const consensusScore = this.calculateConsensusScore(recentSignals);
    const freshnessScore = this.calculateFreshnessScore(recentSignals);
    const consistencyScore = this.calculateConsistencyScore(recentSignals);

    // Calculate direction
    const direction = this.calculateDirection(recentSignals);

    // Calculate magnitude (weighted average)
    const magnitude =
      anchorScore * 0.3 +
      verificationScore * 0.25 +
      consensusScore * 0.2 +
      freshnessScore * 0.15 +
      consistencyScore * 0.1;

    return {
      magnitude: Math.min(1, magnitude),
      direction,
      components: {
        anchor: anchorScore,
        verification: verificationScore,
        consensus: consensusScore,
        freshness: freshnessScore,
        consistency: consistencyScore,
      },
      signals: recentSignals,
      calculatedAt: new Date(),
    };
  }

  /**
   * Generate truth field from multiple vectors
   */
  generateTruthField(credentialId: string, vectors: TrustVector[]): TruthField {
    if (vectors.length === 0) {
      return {
        credentialId,
        vectors: [],
        aggregated: this.createEmptyVector(),
        fieldStrength: 0,
        coherence: 0,
        lastUpdated: new Date(),
      };
    }

    // Aggregate vectors
    const aggregated = this.aggregateVectors(vectors);

    // Calculate field strength (average magnitude)
    const fieldStrength =
      vectors.reduce((sum, v) => sum + v.magnitude, 0) / vectors.length;

    // Calculate coherence (how aligned vectors are)
    const coherence = this.calculateCoherence(vectors);

    return {
      credentialId,
      vectors,
      aggregated,
      fieldStrength,
      coherence,
      lastUpdated: new Date(),
    };
  }

  /**
   * Update truth field with new signals
   */
  updateTruthField(
    field: TruthField,
    newSignals: ChainSignal[]
  ): TruthField {
    const newVector = this.generateTrustVector([
      ...field.aggregated.signals,
      ...newSignals,
    ]);

    const updatedVectors = [...field.vectors, newVector].slice(-10); // Keep last 10

    return this.generateTruthField(field.credentialId, updatedVectors);
  }

  /**
   * Calculate anchor component score
   */
  private calculateAnchorScore(signals: ChainSignal[]): number {
    const anchorSignals = signals.filter((s) => s.type === 'anchor');
    if (anchorSignals.length === 0) return 0;

    // Weight by confidence and recency
    const now = Date.now();
    const scores = anchorSignals.map((s) => {
      const age = (now - s.timestamp.getTime()) / this.signalWindow;
      const recency = Math.pow(this.decayFactor, age);
      return s.confidence * recency;
    });

    return Math.min(1, scores.reduce((sum, s) => sum + s, 0) / anchorSignals.length);
  }

  /**
   * Calculate verification component score
   */
  private calculateVerificationScore(signals: ChainSignal[]): number {
    const verificationSignals = signals.filter((s) => s.type === 'verification');
    if (verificationSignals.length === 0) return 0;

    const avgConfidence =
      verificationSignals.reduce((sum, s) => sum + s.confidence, 0) /
      verificationSignals.length;

    // Bonus for multiple verifications
    const multiVerificationBonus = Math.min(0.2, (verificationSignals.length - 1) * 0.05);

    return Math.min(1, avgConfidence + multiVerificationBonus);
  }

  /**
   * Calculate consensus component score
   */
  private calculateConsensusScore(signals: ChainSignal[]): number {
    const consensusSignals = signals.filter((s) => s.type === 'consensus');
    if (consensusSignals.length === 0) return 0.5; // Neutral if no consensus signals

    // Higher score with more consensus signals
    const countScore = Math.min(1, consensusSignals.length / 3);
    const avgConfidence =
      consensusSignals.reduce((sum, s) => sum + s.confidence, 0) /
      consensusSignals.length;

    return (countScore * 0.5 + avgConfidence * 0.5);
  }

  /**
   * Calculate freshness component score
   */
  private calculateFreshnessScore(signals: ChainSignal[]): number {
    if (signals.length === 0) return 0;

    const now = Date.now();
    const ages = signals.map(
      (s) => (now - s.timestamp.getTime()) / this.signalWindow
    );
    const avgAge = ages.reduce((sum, a) => sum + a, 0) / ages.length;

    // Fresher = higher score
    return Math.max(0, 1 - avgAge);
  }

  /**
   * Calculate consistency component score
   */
  private calculateConsistencyScore(signals: ChainSignal[]): number {
    if (signals.length < 2) return 0.5;

    // Check if signals agree (same network, similar confidence)
    const networks = new Set(signals.map((s) => s.network));
    const networkConsistency = networks.size === 1 ? 1 : 1 / networks.size;

    const confidences = signals.map((s) => s.confidence);
    const avgConfidence =
      confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance =
      confidences.reduce(
        (sum, c) => sum + Math.pow(c - avgConfidence, 2),
        0
      ) / confidences.length;
    const confidenceConsistency = Math.max(0, 1 - variance * 2);

    return (networkConsistency * 0.5 + confidenceConsistency * 0.5);
  }

  /**
   * Calculate trust direction vector
   */
  private calculateDirection(signals: ChainSignal[]): TrustDirection {
    // X: issuer → verifier (positive = more verifier-driven)
    const verifications = signals.filter((s) => s.type === 'verification');
    const anchors = signals.filter((s) => s.type === 'anchor');
    const x = verifications.length > anchors.length ? 0.5 : -0.5;

    // Y: static → dynamic (positive = more dynamic/updated)
    const updates = signals.filter((s) => s.type === 'update');
    const y = Math.min(1, (updates.length / signals.length) * 2 - 0.5);

    // Z: individual → network (positive = more consensus/network)
    const consensus = signals.filter((s) => s.type === 'consensus');
    const z = Math.min(1, (consensus.length / signals.length) * 2);

    return { x, y, z };
  }

  /**
   * Aggregate multiple vectors
   */
  private aggregateVectors(vectors: TrustVector[]): TrustVector {
    if (vectors.length === 0) return this.createEmptyVector();

    const avgMagnitude =
      vectors.reduce((sum, v) => sum + v.magnitude, 0) / vectors.length;

    const avgComponents = {
      anchor:
        vectors.reduce((sum, v) => sum + v.components.anchor, 0) /
        vectors.length,
      verification:
        vectors.reduce((sum, v) => sum + v.components.verification, 0) /
        vectors.length,
      consensus:
        vectors.reduce((sum, v) => sum + v.components.consensus, 0) /
        vectors.length,
      freshness:
        vectors.reduce((sum, v) => sum + v.components.freshness, 0) /
        vectors.length,
      consistency:
        vectors.reduce((sum, v) => sum + v.components.consistency, 0) /
        vectors.length,
    };

    const avgDirection = {
      x:
        vectors.reduce((sum, v) => sum + v.direction.x, 0) / vectors.length,
      y:
        vectors.reduce((sum, v) => sum + v.direction.y, 0) / vectors.length,
      z:
        vectors.reduce((sum, v) => sum + v.direction.z, 0) / vectors.length,
    };

    const allSignals = vectors.flatMap((v) => v.signals);

    return {
      magnitude: avgMagnitude,
      direction: avgDirection,
      components: avgComponents,
      signals: allSignals,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate coherence between vectors
   */
  private calculateCoherence(vectors: TrustVector[]): number {
    if (vectors.length < 2) return 1;

    // Calculate how similar magnitudes are
    const magnitudes = vectors.map((v) => v.magnitude);
    const avgMagnitude =
      magnitudes.reduce((sum, m) => sum + m, 0) / magnitudes.length;
    const variance =
      magnitudes.reduce(
        (sum, m) => sum + Math.pow(m - avgMagnitude, 2),
        0
      ) / magnitudes.length;

    // Lower variance = higher coherence
    const magnitudeCoherence = Math.max(0, 1 - variance * 2);

    // Calculate direction alignment
    const directions = vectors.map((v) => v.direction);
    const dotProducts: number[] = [];
    for (let i = 0; i < directions.length; i++) {
      for (let j = i + 1; j < directions.length; j++) {
        const dot =
          directions[i].x * directions[j].x +
          directions[i].y * directions[j].y +
          directions[i].z * directions[j].z;
        dotProducts.push(dot);
      }
    }
    const avgDotProduct =
      dotProducts.reduce((sum, d) => sum + d, 0) / dotProducts.length;
    const directionCoherence = (avgDotProduct + 1) / 2; // Normalize -1..1 to 0..1

    return (magnitudeCoherence * 0.6 + directionCoherence * 0.4);
  }

  private createEmptyVector(): TrustVector {
    return {
      magnitude: 0,
      direction: { x: 0, y: 0, z: 0 },
      components: {
        anchor: 0,
        verification: 0,
        consensus: 0,
        freshness: 0,
        consistency: 0,
      },
      signals: [],
      calculatedAt: new Date(),
    };
  }
}

