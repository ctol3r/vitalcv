/**
 * ScenarioComparisonTool
 *
 * Compares runs across versions (e.g. Supervisor v1 vs v2, policy changes,
 * model updates) and highlights divergences.
 */

export interface ScenarioRun {
  id: string;
  scenarioId: string;
  version: string;
  timestamp: number;
  duration: number;
  metrics: RunMetrics;
  events: ScenarioEvent[];
  metadata?: Record<string, any>;
}

export interface RunMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  p50Latency?: number;
  p95Latency?: number;
  p99Latency?: number;
  errorRate: number;
  throughput: number;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
    network?: number;
  };
}

export interface ScenarioEvent {
  id: string;
  type: string;
  timestamp: number;
  data?: any;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

export interface ComparisonResult {
  run1: ScenarioRun;
  run2: ScenarioRun;
  divergences: Divergence[];
  summary: ComparisonSummary;
}

export interface Divergence {
  type: 'metric' | 'event' | 'timing' | 'behavior';
  category: string;
  description: string;
  run1Value?: any;
  run2Value?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact?: string;
}

export interface ComparisonSummary {
  totalDivergences: number;
  criticalDivergences: number;
  highDivergences: number;
  mediumDivergences: number;
  lowDivergences: number;
  performanceDelta: {
    latency: number; // Percentage change
    throughput: number; // Percentage change
    errorRate: number; // Absolute change
  };
  similarityScore: number; // 0-1, where 1 is identical
}

export class ScenarioComparisonTool {
  /**
   * Compare two scenario runs
   */
  compareRuns(run1: ScenarioRun, run2: ScenarioRun): ComparisonResult {
    const divergences: Divergence[] = [];

    // Compare metrics
    divergences.push(...this.compareMetrics(run1.metrics, run2.metrics));

    // Compare events
    divergences.push(...this.compareEvents(run1.events, run2.events));

    // Compare timing patterns
    divergences.push(...this.compareTiming(run1, run2));

    // Compare behavioral patterns
    divergences.push(...this.compareBehavior(run1, run2));

    const summary = this.generateSummary(divergences, run1.metrics, run2.metrics);

    return {
      run1,
      run2,
      divergences,
      summary,
    };
  }

  /**
   * Compare multiple runs (e.g., baseline vs multiple versions)
   */
  compareMultipleRuns(
    baseline: ScenarioRun,
    runs: ScenarioRun[]
  ): Map<string, ComparisonResult> {
    const results = new Map<string, ComparisonResult>();

    for (const run of runs) {
      const comparison = this.compareRuns(baseline, run);
      results.set(run.version, comparison);
    }

    return results;
  }

  /**
   * Find the most similar run to a target run
   */
  findMostSimilarRun(target: ScenarioRun, candidates: ScenarioRun[]): {
    run: ScenarioRun;
    similarityScore: number;
  } | null {
    if (candidates.length === 0) {
      return null;
    }

    let mostSimilar: ScenarioRun | null = null;
    let highestScore = 0;

    for (const candidate of candidates) {
      const comparison = this.compareRuns(target, candidate);
      if (comparison.summary.similarityScore > highestScore) {
        highestScore = comparison.summary.similarityScore;
        mostSimilar = candidate;
      }
    }

    return mostSimilar ? { run: mostSimilar, similarityScore: highestScore } : null;
  }

  /**
   * Generate a comparison report
   */
  generateReport(comparison: ComparisonResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('SCENARIO COMPARISON REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Run 1: ${comparison.run1.version} (${new Date(comparison.run1.timestamp).toISOString()})`);
    lines.push(`Run 2: ${comparison.run2.version} (${new Date(comparison.run2.timestamp).toISOString()})`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Total Divergences: ${comparison.summary.totalDivergences}`);
    lines.push(`  Critical: ${comparison.summary.criticalDivergences}`);
    lines.push(`  High: ${comparison.summary.highDivergences}`);
    lines.push(`  Medium: ${comparison.summary.mediumDivergences}`);
    lines.push(`  Low: ${comparison.summary.lowDivergences}`);
    lines.push(`Similarity Score: ${(comparison.summary.similarityScore * 100).toFixed(2)}%`);
    lines.push('');

    // Performance Delta
    lines.push('PERFORMANCE DELTA');
    lines.push('-'.repeat(80));
    lines.push(
      `Latency: ${comparison.summary.performanceDelta.latency > 0 ? '+' : ''}${comparison.summary.performanceDelta.latency.toFixed(2)}%`
    );
    lines.push(
      `Throughput: ${comparison.summary.performanceDelta.throughput > 0 ? '+' : ''}${comparison.summary.performanceDelta.throughput.toFixed(2)}%`
    );
    lines.push(
      `Error Rate: ${comparison.summary.performanceDelta.errorRate > 0 ? '+' : ''}${comparison.summary.performanceDelta.errorRate.toFixed(4)}`
    );
    lines.push('');

    // Divergences
    if (comparison.divergences.length > 0) {
      lines.push('DIVERGENCES');
      lines.push('-'.repeat(80));
      for (const div of comparison.divergences) {
        lines.push(`[${div.severity.toUpperCase()}] ${div.category}: ${div.description}`);
        if (div.run1Value !== undefined) {
          lines.push(`  Run 1: ${JSON.stringify(div.run1Value)}`);
        }
        if (div.run2Value !== undefined) {
          lines.push(`  Run 2: ${JSON.stringify(div.run2Value)}`);
        }
        if (div.impact) {
          lines.push(`  Impact: ${div.impact}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // Private comparison methods

  private compareMetrics(
    metrics1: RunMetrics,
    metrics2: RunMetrics
  ): Divergence[] {
    const divergences: Divergence[] = [];
    const threshold = 0.1; // 10% difference threshold

    // Compare latency
    const latencyDelta = Math.abs(metrics1.averageLatency - metrics2.averageLatency) / metrics1.averageLatency;
    if (latencyDelta > threshold) {
      divergences.push({
        type: 'metric',
        category: 'performance',
        description: 'Average latency differs significantly',
        run1Value: metrics1.averageLatency,
        run2Value: metrics2.averageLatency,
        severity: latencyDelta > 0.5 ? 'high' : 'medium',
        impact: `Latency ${metrics2.averageLatency > metrics1.averageLatency ? 'increased' : 'decreased'} by ${(latencyDelta * 100).toFixed(2)}%`,
      });
    }

    // Compare error rate
    const errorRateDelta = Math.abs(metrics1.errorRate - metrics2.errorRate);
    if (errorRateDelta > 0.01) {
      divergences.push({
        type: 'metric',
        category: 'reliability',
        description: 'Error rate differs',
        run1Value: metrics1.errorRate,
        run2Value: metrics2.errorRate,
        severity: errorRateDelta > 0.1 ? 'critical' : errorRateDelta > 0.05 ? 'high' : 'medium',
        impact: `Error rate ${metrics2.errorRate > metrics1.errorRate ? 'increased' : 'decreased'} by ${(errorRateDelta * 100).toFixed(2)}%`,
      });
    }

    // Compare throughput
    const throughputDelta = Math.abs(metrics1.throughput - metrics2.throughput) / metrics1.throughput;
    if (throughputDelta > threshold) {
      divergences.push({
        type: 'metric',
        category: 'performance',
        description: 'Throughput differs significantly',
        run1Value: metrics1.throughput,
        run2Value: metrics2.throughput,
        severity: throughputDelta > 0.3 ? 'high' : 'medium',
        impact: `Throughput ${metrics2.throughput > metrics1.throughput ? 'increased' : 'decreased'} by ${(throughputDelta * 100).toFixed(2)}%`,
      });
    }

    // Compare success rate
    const successRate1 = metrics1.successfulOperations / metrics1.totalOperations;
    const successRate2 = metrics2.successfulOperations / metrics2.totalOperations;
    const successRateDelta = Math.abs(successRate1 - successRate2);
    if (successRateDelta > 0.01) {
      divergences.push({
        type: 'metric',
        category: 'reliability',
        description: 'Success rate differs',
        run1Value: successRate1,
        run2Value: successRate2,
        severity: successRateDelta > 0.05 ? 'high' : 'medium',
      });
    }

    return divergences;
  }

  private compareEvents(events1: ScenarioEvent[], events2: ScenarioEvent[]): Divergence[] {
    const divergences: Divergence[] = [];

    // Group events by type
    const events1ByType = this.groupEventsByType(events1);
    const events2ByType = this.groupEventsByType(events2);

    // Find event types that appear in one but not the other
    const allTypes = new Set([...events1ByType.keys(), ...events2ByType.keys()]);
    for (const type of allTypes) {
      const count1 = events1ByType.get(type)?.length || 0;
      const count2 = events2ByType.get(type)?.length || 0;

      if (count1 !== count2) {
        divergences.push({
          type: 'event',
          category: 'event_count',
          description: `Event type "${type}" count differs`,
          run1Value: count1,
          run2Value: count2,
          severity: Math.abs(count1 - count2) > 10 ? 'high' : 'medium',
        });
      }

      // Check for critical events in one but not the other
      const critical1 = events1ByType.get(type)?.filter((e) => e.severity === 'critical') || [];
      const critical2 = events2ByType.get(type)?.filter((e) => e.severity === 'critical') || [];

      if (critical1.length !== critical2.length) {
        divergences.push({
          type: 'event',
          category: 'critical_events',
          description: `Critical events of type "${type}" differ`,
          run1Value: critical1.length,
          run2Value: critical2.length,
          severity: 'critical',
        });
      }
    }

    return divergences;
  }

  private compareTiming(run1: ScenarioRun, run2: ScenarioRun): Divergence[] {
    const divergences: Divergence[] = [];

    // Compare total duration
    const durationDelta = Math.abs(run1.duration - run2.duration) / run1.duration;
    if (durationDelta > 0.1) {
      divergences.push({
        type: 'timing',
        category: 'duration',
        description: 'Total duration differs significantly',
        run1Value: run1.duration,
        run2Value: run2.duration,
        severity: durationDelta > 0.3 ? 'high' : 'medium',
      });
    }

    return divergences;
  }

  private compareBehavior(run1: ScenarioRun, run2: ScenarioRun): Divergence[] {
    const divergences: Divergence[] = [];

    // Compare event sequences (simplified)
    const eventSequence1 = run1.events.map((e) => e.type).join('->');
    const eventSequence2 = run2.events.map((e) => e.type).join('->');

    if (eventSequence1 !== eventSequence2) {
      divergences.push({
        type: 'behavior',
        category: 'event_sequence',
        description: 'Event sequence differs between runs',
        severity: 'medium',
        impact: 'Different execution paths may indicate behavioral changes',
      });
    }

    return divergences;
  }

  private generateSummary(
    divergences: Divergence[],
    metrics1: RunMetrics,
    metrics2: RunMetrics
  ): ComparisonSummary {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const div of divergences) {
      severityCounts[div.severity]++;
    }

    // Calculate performance delta
    const latencyDelta =
      ((metrics2.averageLatency - metrics1.averageLatency) / metrics1.averageLatency) * 100;
    const throughputDelta =
      ((metrics2.throughput - metrics1.throughput) / metrics1.throughput) * 100;
    const errorRateDelta = metrics2.errorRate - metrics1.errorRate;

    // Calculate similarity score (simplified)
    const totalPossibleDivergences = 10; // Arbitrary baseline
    const similarityScore = Math.max(
      0,
      1 - divergences.length / totalPossibleDivergences
    );

    return {
      totalDivergences: divergences.length,
      criticalDivergences: severityCounts.critical,
      highDivergences: severityCounts.high,
      mediumDivergences: severityCounts.medium,
      lowDivergences: severityCounts.low,
      performanceDelta: {
        latency: latencyDelta,
        throughput: throughputDelta,
        errorRate: errorRateDelta,
      },
      similarityScore,
    };
  }

  private groupEventsByType(events: ScenarioEvent[]): Map<string, ScenarioEvent[]> {
    const grouped = new Map<string, ScenarioEvent[]>();
    for (const event of events) {
      if (!grouped.has(event.type)) {
        grouped.set(event.type, []);
      }
      grouped.get(event.type)!.push(event);
    }
    return grouped;
  }
}

