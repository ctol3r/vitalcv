/**
 * TrustWave Engine
 * Task 11: Add TrustWave Engine (merge issuer+evidence+chain)
 *
 * Synthesizes trust signals from multiple sources (issuer reputation,
 * evidence quality, chain verification) into a unified trust wave.
 */

import type { TrustScore } from '@/lib/services/trust-service';
import type { ChainSignal } from '../chain/truth-field-generator';

export interface TrustWave {
  amplitude: number; // 0-1, overall trust strength
  frequency: number; // oscillations per unit time
  phase: number; // current phase in cycle (0-2π)
  coherence: number; // 0-1, how well signals align
  components: {
    issuer: WaveComponent;
    evidence: WaveComponent;
    chain: WaveComponent;
  };
  synthesizedAt: Date;
}

export interface WaveComponent {
  amplitude: number;
  frequency: number;
  phase: number;
  contribution: number; // 0-1, how much this contributes to overall
}

export interface TrustWaveSnapshot {
  timestamp: Date;
  wave: TrustWave;
  score: TrustScore;
  signals: ChainSignal[];
}

export class TrustWaveEngine {
  private waveHistory: TrustWaveSnapshot[];
  private maxHistory: number;

  constructor(maxHistory: number = 100) {
    this.waveHistory = [];
    this.maxHistory = maxHistory;
  }

  /**
   * Synthesize trust wave from multiple sources
   */
  synthesizeTrustWave(
    issuerScore: number,
    evidenceScore: number,
    chainSignals: ChainSignal[],
    overallTrust: TrustScore
  ): TrustWave {
    // Calculate component waves
    const issuerComponent = this.calculateComponentWave(
      issuerScore,
      'issuer',
      chainSignals
    );
    const evidenceComponent = this.calculateComponentWave(
      evidenceScore,
      'evidence',
      chainSignals
    );
    const chainComponent = this.calculateComponentWave(
      overallTrust.breakdown.anchor,
      'chain',
      chainSignals
    );

    // Calculate overall wave parameters
    const amplitude = this.calculateAmplitude([
      issuerComponent,
      evidenceComponent,
      chainComponent,
    ]);

    const frequency = this.calculateFrequency(chainSignals);

    const phase = this.calculatePhase([
      issuerComponent,
      evidenceComponent,
      chainComponent,
    ]);

    const coherence = this.calculateCoherence([
      issuerComponent,
      evidenceComponent,
      chainComponent,
    ]);

    const wave: TrustWave = {
      amplitude,
      frequency,
      phase,
      coherence,
      components: {
        issuer: issuerComponent,
        evidence: evidenceComponent,
        chain: chainComponent,
      },
      synthesizedAt: new Date(),
    };

    // Store in history
    this.addSnapshot(wave, overallTrust, chainSignals);

    return wave;
  }

  /**
   * Get trust wave at a specific time
   */
  getTrustWaveAt(timestamp: Date): TrustWave | null {
    // Find closest snapshot
    const snapshot = this.waveHistory
      .slice()
      .reverse()
      .find((s) => s.timestamp <= timestamp);

    if (!snapshot) return null;

    // Interpolate if needed
    const nextSnapshot = this.waveHistory.find(
      (s) => s.timestamp > timestamp && s.timestamp > snapshot.timestamp
    );

    if (!nextSnapshot || nextSnapshot.timestamp.getTime() === snapshot.timestamp.getTime()) {
      return snapshot.wave;
    }

    // Linear interpolation
    return this.interpolateWave(snapshot.wave, nextSnapshot.wave, timestamp);
  }

  /**
   * Get trust wave evolution over time
   */
  getTrustWaveEvolution(
    startTime: Date,
    endTime: Date,
    intervalMs: number = 3600000
  ): Array<{ timestamp: Date; wave: TrustWave }> {
    const evolution: Array<{ timestamp: Date; wave: TrustWave }> = [];
    let current = new Date(startTime);

    while (current <= endTime) {
      const wave = this.getTrustWaveAt(current);
      if (wave) {
        evolution.push({ timestamp: new Date(current), wave });
      }
      current = new Date(current.getTime() + intervalMs);
    }

    return evolution;
  }

  /**
   * Calculate component wave
   */
  private calculateComponentWave(
    score: number,
    type: 'issuer' | 'evidence' | 'chain',
    signals: ChainSignal[]
  ): WaveComponent {
    // Amplitude based on score
    const amplitude = score;

    // Frequency based on signal activity
    const relevantSignals = signals.filter((s) => {
      if (type === 'issuer') return s.type === 'anchor';
      if (type === 'evidence') return s.type === 'verification';
      if (type === 'chain') return true;
      return false;
    });

    const frequency = this.calculateSignalFrequency(relevantSignals);

    // Phase based on timing
    const phase = this.calculateSignalPhase(relevantSignals);

    // Contribution based on signal count and recency
    const contribution = this.calculateContribution(relevantSignals, score);

    return {
      amplitude,
      frequency,
      phase,
      contribution,
    };
  }

  /**
   * Calculate overall amplitude
   */
  private calculateAmplitude(components: WaveComponent[]): number {
    // Weighted sum of component amplitudes
    const weightedSum = components.reduce(
      (sum, comp) => sum + comp.amplitude * comp.contribution,
      0
    );
    const totalContribution = components.reduce(
      (sum, comp) => sum + comp.contribution,
      0
    );

    return totalContribution > 0 ? weightedSum / totalContribution : 0;
  }

  /**
   * Calculate overall frequency
   */
  private calculateFrequency(signals: ChainSignal[]): number {
    if (signals.length < 2) return 0.1; // Low frequency for few signals

    // Calculate average time between signals
    const sorted = [...signals].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()
      );
    }

    const avgInterval =
      intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

    // Convert to frequency (higher activity = higher frequency)
    const baseFrequency = 1 / (avgInterval / (1000 * 60 * 60)); // per hour
    return Math.min(10, Math.max(0.01, baseFrequency));
  }

  /**
   * Calculate overall phase
   */
  private calculatePhase(components: WaveComponent[]): number {
    // Average phase weighted by contribution
    const weightedSum = components.reduce(
      (sum, comp) => {
        // Convert phase to vector and sum
        const x = comp.contribution * Math.cos(comp.phase);
        const y = comp.contribution * Math.sin(comp.phase);
        return {
          x: sum.x + x,
          y: sum.y + y,
        };
      },
      { x: 0, y: 0 }
    );

    return Math.atan2(weightedSum.y, weightedSum.x);
  }

  /**
   * Calculate coherence
   */
  private calculateCoherence(components: WaveComponent[]): number {
    if (components.length < 2) return 1;

    // Calculate phase alignment
    const phases = components.map((c) => c.phase);
    const phaseVariance =
      phases.reduce((sum, p, i) => {
        const diff = Math.abs(p - phases[0]);
        const normalizedDiff = Math.min(diff, 2 * Math.PI - diff);
        return sum + normalizedDiff;
      }, 0) / phases.length;

    const phaseCoherence = Math.max(0, 1 - phaseVariance / Math.PI);

    // Calculate amplitude similarity
    const amplitudes = components.map((c) => c.amplitude);
    const avgAmplitude =
      amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;
    const amplitudeVariance =
      amplitudes.reduce((sum, a) => sum + Math.pow(a - avgAmplitude, 2), 0) /
      amplitudes.length;

    const amplitudeCoherence = Math.max(0, 1 - amplitudeVariance);

    return (phaseCoherence * 0.6 + amplitudeCoherence * 0.4);
  }

  /**
   * Calculate signal frequency
   */
  private calculateSignalFrequency(signals: ChainSignal[]): number {
    if (signals.length < 2) return 0.1;

    const sorted = [...signals].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const timeSpan = sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime();

    if (timeSpan === 0) return 0.1;

    return (signals.length / (timeSpan / (1000 * 60 * 60))); // per hour
  }

  /**
   * Calculate signal phase
   */
  private calculateSignalPhase(signals: ChainSignal[]): number {
    if (signals.length === 0) return 0;

    const now = Date.now();
    const latest = signals.reduce((latest, s) =>
      s.timestamp.getTime() > latest.timestamp.getTime() ? s : latest
    );

    // Phase based on time since latest signal
    const timeSinceLatest = (now - latest.timestamp.getTime()) / (1000 * 60 * 60); // hours
    return (timeSinceLatest % 24) / 24 * 2 * Math.PI; // Daily cycle
  }

  /**
   * Calculate contribution
   */
  private calculateContribution(signals: ChainSignal[], baseScore: number): number {
    // Base contribution from score
    let contribution = baseScore * 0.5;

    // Boost for recent signals
    const now = Date.now();
    const recentSignals = signals.filter(
      (s) => now - s.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    contribution += (recentSignals.length / Math.max(1, signals.length)) * 0.3;

    // Boost for high confidence signals
    const avgConfidence =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
        : 0;
    contribution += avgConfidence * 0.2;

    return Math.min(1, contribution);
  }

  /**
   * Interpolate between two waves
   */
  private interpolateWave(
    wave1: TrustWave,
    wave2: TrustWave,
    timestamp: Date
  ): TrustWave {
    // Linear interpolation (simplified)
    const t = 0.5; // Could be calculated based on timestamps

    return {
      amplitude: wave1.amplitude * (1 - t) + wave2.amplitude * t,
      frequency: wave1.frequency * (1 - t) + wave2.frequency * t,
      phase: wave1.phase * (1 - t) + wave2.phase * t,
      coherence: wave1.coherence * (1 - t) + wave2.coherence * t,
      components: {
        issuer: this.interpolateComponent(wave1.components.issuer, wave2.components.issuer, t),
        evidence: this.interpolateComponent(wave1.components.evidence, wave2.components.evidence, t),
        chain: this.interpolateComponent(wave1.components.chain, wave2.components.chain, t),
      },
      synthesizedAt: timestamp,
    };
  }

  private interpolateComponent(
    comp1: WaveComponent,
    comp2: WaveComponent,
    t: number
  ): WaveComponent {
    return {
      amplitude: comp1.amplitude * (1 - t) + comp2.amplitude * t,
      frequency: comp1.frequency * (1 - t) + comp2.frequency * t,
      phase: comp1.phase * (1 - t) + comp2.phase * t,
      contribution: comp1.contribution * (1 - t) + comp2.contribution * t,
    };
  }

  private addSnapshot(wave: TrustWave, score: TrustScore, signals: ChainSignal[]): void {
    this.waveHistory.push({
      timestamp: new Date(),
      wave,
      score,
      signals,
    });

    // Keep only recent history
    if (this.waveHistory.length > this.maxHistory) {
      this.waveHistory.shift();
    }
  }

  /**
   * Get wave history
   */
  getHistory(): TrustWaveSnapshot[] {
    return [...this.waveHistory];
  }
}

