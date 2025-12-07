/**
 * Batch 400.2 — Synthesis Signal Normalization Engine
 * Normalizes trust inputs from multiple subsystems
 */

export interface TrustSignal {
  source: 'chain' | 'issuer' | 'verifier' | 'employer' | 'regulatory';
  value: number;
  weight?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedTrustSignal {
  source: string;
  normalizedValue: number; // 0-100
  weight: number;
  confidence: number;
  timestamp: string;
}

/**
 * Normalize trust signals from different sources to a common 0-100 scale
 */
export function normalizeTrustSignals(signals: TrustSignal[]): NormalizedTrustSignal[] {
  return signals.map((signal) => {
    // Normalize value to 0-100 scale
    let normalizedValue = signal.value;
    if (signal.value < 0 || signal.value > 100) {
      // Assume 0-1 scale if > 1, otherwise clamp
      normalizedValue = signal.value > 1 ? signal.value * 100 : Math.max(0, Math.min(100, signal.value));
    }

    // Default weights by source
    const defaultWeights: Record<string, number> = {
      chain: 0.25,
      issuer: 0.30,
      verifier: 0.20,
      employer: 0.15,
      regulatory: 0.10,
    };

    const weight = signal.weight ?? defaultWeights[signal.source] ?? 0.1;

    // Calculate confidence based on recency and source reliability
    const ageMs = Date.now() - new Date(signal.timestamp).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 1 - ageDays / 365); // Decay over 1 year

    const sourceReliability: Record<string, number> = {
      chain: 0.95,
      issuer: 0.90,
      verifier: 0.85,
      employer: 0.75,
      regulatory: 0.80,
    };

    const confidence = recencyFactor * (sourceReliability[signal.source] ?? 0.7);

    return {
      source: signal.source,
      normalizedValue: Math.round(normalizedValue * 100) / 100,
      weight,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: signal.timestamp,
    };
  });
}

