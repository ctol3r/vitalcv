/**
 * Signature Entropy Calculator
 * Task 10: Add signature entropy calculator (issuer reliability)
 *
 * Calculates entropy and reliability metrics for credential issuers
 * based on signature patterns and consistency.
 */

export interface IssuerSignature {
  issuerId: string;
  issuerName: string;
  algorithm: string;
  signature: string;
  timestamp: Date;
  credentialId: string;
}

export interface SignatureEntropy {
  issuerId: string;
  entropy: number; // 0-1, higher = more random/variable (potentially less reliable)
  reliability: number; // 0-1, higher = more reliable
  signatureCount: number;
  algorithmConsistency: number; // 0-1
  temporalConsistency: number; // 0-1
  patternAnomalies: Array<{
    type: 'algorithm_change' | 'timing_anomaly' | 'signature_pattern';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  calculatedAt: Date;
}

export interface IssuerReliability {
  issuerId: string;
  issuerName: string;
  overallReliability: number; // 0-1
  entropy: SignatureEntropy;
  credentialsIssued: number;
  verificationRate: number; // 0-1
  revocationRate: number; // 0-1
  averageConfidence: number; // 0-1
}

export class SignatureEntropyCalculator {
  private signatures: Map<string, IssuerSignature[]>;
  private entropyWindow: number; // milliseconds

  constructor(entropyWindowMs: number = 31536000000) {
    // Default: 1 year window
    this.signatures = new Map();
    this.entropyWindow = entropyWindowMs;
  }

  /**
   * Add signature record
   */
  addSignature(signature: IssuerSignature): void {
    if (!this.signatures.has(signature.issuerId)) {
      this.signatures.set(signature.issuerId, []);
    }
    this.signatures.get(signature.issuerId)!.push(signature);
  }

  /**
   * Calculate entropy for an issuer
   */
  calculateEntropy(issuerId: string): SignatureEntropy {
    const signatures = this.getRecentSignatures(issuerId);

    if (signatures.length === 0) {
      return {
        issuerId,
        entropy: 0,
        reliability: 0,
        signatureCount: 0,
        algorithmConsistency: 0,
        temporalConsistency: 0,
        patternAnomalies: [],
        calculatedAt: new Date(),
      };
    }

    // Calculate entropy from signature patterns
    const entropy = this.calculateShannonEntropy(signatures);

    // Calculate algorithm consistency
    const algorithmConsistency = this.calculateAlgorithmConsistency(signatures);

    // Calculate temporal consistency
    const temporalConsistency = this.calculateTemporalConsistency(signatures);

    // Detect pattern anomalies
    const patternAnomalies = this.detectPatternAnomalies(signatures);

    // Calculate reliability (inverse of problematic entropy)
    const reliability = this.calculateReliability(
      entropy,
      algorithmConsistency,
      temporalConsistency,
      patternAnomalies
    );

    return {
      issuerId,
      entropy,
      reliability,
      signatureCount: signatures.length,
      algorithmConsistency,
      temporalConsistency,
      patternAnomalies,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate comprehensive issuer reliability
   */
  calculateIssuerReliability(
    issuerId: string,
    issuerName: string,
    credentialsIssued: number,
    verificationRate: number,
    revocationRate: number,
    averageConfidence: number
  ): IssuerReliability {
    const entropy = this.calculateEntropy(issuerId);

    // Combine entropy reliability with other metrics
    const baseReliability = entropy.reliability;
    const verificationBoost = verificationRate * 0.2;
    const revocationPenalty = revocationRate * 0.3;
    const confidenceBoost = averageConfidence * 0.1;
    const volumeBoost = Math.min(0.1, Math.log10(credentialsIssued + 1) / 10);

    const overallReliability = Math.max(
      0,
      Math.min(
        1,
        baseReliability +
          verificationBoost -
          revocationPenalty +
          confidenceBoost +
          volumeBoost
      )
    );

    return {
      issuerId,
      issuerName,
      overallReliability,
      entropy,
      credentialsIssued,
      verificationRate,
      revocationRate,
      averageConfidence,
    };
  }

  /**
   * Calculate Shannon entropy from signature patterns
   */
  private calculateShannonEntropy(signatures: IssuerSignature[]): number {
    // Extract signature patterns (first N bytes normalized)
    const patternMap = new Map<string, number>();

    signatures.forEach((sig) => {
      // Normalize signature for pattern analysis (first 16 chars)
      const pattern = sig.signature.substring(0, 16);
      patternMap.set(pattern, (patternMap.get(pattern) || 0) + 1);
    });

    if (patternMap.size === 1) {
      return 0; // No entropy - all signatures identical (suspicious)
    }

    // Calculate Shannon entropy
    const total = signatures.length;
    let entropy = 0;

    patternMap.forEach((count) => {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    });

    // Normalize to 0-1 range (max entropy = log2(unique_patterns))
    const maxEntropy = Math.log2(patternMap.size);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  /**
   * Calculate algorithm consistency
   */
  private calculateAlgorithmConsistency(signatures: IssuerSignature[]): number {
    if (signatures.length === 0) return 0;

    const algorithmCounts = new Map<string, number>();
    signatures.forEach((sig) => {
      algorithmCounts.set(sig.algorithm, (algorithmCounts.get(sig.algorithm) || 0) + 1);
    });

    // Higher consistency = fewer different algorithms
    const mostCommonCount = Math.max(...Array.from(algorithmCounts.values()));
    const consistency = mostCommonCount / signatures.length;

    return consistency;
  }

  /**
   * Calculate temporal consistency
   */
  private calculateTemporalConsistency(signatures: IssuerSignature[]): number {
    if (signatures.length < 2) return 1;

    // Sort by timestamp
    const sorted = [...signatures].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate intervals between signatures
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()
      );
    }

    if (intervals.length === 0) return 1;

    // Calculate coefficient of variation
    const mean = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower variation = higher consistency
    const cv = mean > 0 ? stdDev / mean : 0;
    const consistency = Math.max(0, 1 - Math.min(1, cv));

    return consistency;
  }

  /**
   * Detect pattern anomalies
   */
  private detectPatternAnomalies(signatures: IssuerSignature[]): Array<{
    type: 'algorithm_change' | 'timing_anomaly' | 'signature_pattern';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> {
    const anomalies: Array<{
      type: 'algorithm_change' | 'timing_anomaly' | 'signature_pattern';
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    if (signatures.length < 2) return anomalies;

    // Check for algorithm changes
    const algorithms = new Set(signatures.map((s) => s.algorithm));
    if (algorithms.size > 1) {
      const sorted = [...signatures].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      let lastAlgorithm = sorted[0].algorithm;
      sorted.slice(1).forEach((sig) => {
        if (sig.algorithm !== lastAlgorithm) {
          anomalies.push({
            type: 'algorithm_change',
            severity: 'medium',
            description: `Algorithm changed from ${lastAlgorithm} to ${sig.algorithm}`,
          });
          lastAlgorithm = sig.algorithm;
        }
      });
    }

    // Check for timing anomalies (very rapid signatures or large gaps)
    const sorted = [...signatures].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const interval = sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();

      // Very rapid (less than 1 second) - suspicious
      if (interval < 1000) {
        anomalies.push({
          type: 'timing_anomaly',
          severity: 'high',
          description: `Rapid sequential signatures (${interval}ms apart)`,
        });
      }

      // Very large gap (more than 1 year) - potentially inconsistent
      if (interval > 31536000000) {
        anomalies.push({
          type: 'timing_anomaly',
          severity: 'low',
          description: `Large gap between signatures (${Math.round(interval / (86400000))} days)`,
        });
      }
    }

    // Check for signature pattern issues (too similar = suspicious)
    const entropy = this.calculateShannonEntropy(signatures);
    if (entropy < 0.1 && signatures.length > 5) {
      anomalies.push({
        type: 'signature_pattern',
        severity: 'high',
        description: 'Very low signature entropy - signatures too similar',
      });
    }

    return anomalies;
  }

  /**
   * Calculate reliability from entropy and consistency metrics
   */
  private calculateReliability(
    entropy: number,
    algorithmConsistency: number,
    temporalConsistency: number,
    anomalies: Array<{ severity: 'low' | 'medium' | 'high' }>
  ): number {
    let reliability = 0.5; // Base reliability

    // Moderate entropy is good (too low = suspicious, too high = chaotic)
    const optimalEntropy = 0.5;
    const entropyScore = 1 - Math.abs(entropy - optimalEntropy) * 2;
    reliability += entropyScore * 0.3;

    // Algorithm consistency is good (but some change is acceptable)
    reliability += algorithmConsistency * 0.2;

    // Temporal consistency is good
    reliability += temporalConsistency * 0.2;

    // Penalize anomalies
    const anomalyPenalty = anomalies.reduce((penalty, a) => {
      const weight = a.severity === 'high' ? 0.15 : a.severity === 'medium' ? 0.1 : 0.05;
      return penalty + weight;
    }, 0);
    reliability -= anomalyPenalty;

    return Math.max(0, Math.min(1, reliability));
  }

  /**
   * Get recent signatures within window
   */
  private getRecentSignatures(issuerId: string): IssuerSignature[] {
    const allSignatures = this.signatures.get(issuerId) || [];
    const cutoff = new Date(Date.now() - this.entropyWindow);
    return allSignatures.filter((sig) => sig.timestamp >= cutoff);
  }
}

