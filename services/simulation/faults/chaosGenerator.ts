/**
 * ChaosScenarioGenerator
 *
 * Generates randomized chaos runs that combine multiple faults.
 * Helps test self-healing loops under stress by creating complex,
 * unpredictable failure scenarios.
 */

import { FaultInjector, FaultType, FaultConfig } from './injector.js';

export interface ChaosScenario {
  id: string;
  name: string;
  description?: string;
  faults: FaultConfig[];
  duration: number; // Total scenario duration in milliseconds
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  metadata?: Record<string, any>;
}

export interface ChaosRun {
  scenarioId: string;
  runId: string;
  startTime: number;
  endTime?: number;
  faultsInjected: string[];
  status: 'running' | 'completed' | 'failed';
  metrics?: ChaosMetrics;
}

export interface ChaosMetrics {
  totalFaults: number;
  faultsTriggered: number;
  averageRecoveryTime?: number;
  systemHealthScore?: number;
  errorsEncountered: number;
}

export class ChaosScenarioGenerator {
  private faultInjector: FaultInjector;
  private activeRuns: Map<string, ChaosRun> = new Map();
  private predefinedScenarios: Map<string, ChaosScenario> = new Map();

  constructor(faultInjector: FaultInjector) {
    this.faultInjector = faultInjector;
    this.initializePredefinedScenarios();
  }

  /**
   * Generate a random chaos scenario
   */
  generateRandomScenario(options?: {
    intensity?: 'low' | 'medium' | 'high' | 'extreme';
    duration?: number;
    maxFaults?: number;
    targetModules?: string[];
  }): ChaosScenario {
    const intensity = options?.intensity || this.randomIntensity();
    const duration = options?.duration || this.getDurationForIntensity(intensity);
    const maxFaults = options?.maxFaults || this.getMaxFaultsForIntensity(intensity);
    const targetModules = options?.targetModules || ['supervisor', 'queue', 'network'];

    const faults: FaultConfig[] = [];
    const faultCount = Math.floor(Math.random() * maxFaults) + 1;

    for (let i = 0; i < faultCount; i++) {
      const faultType = this.randomFaultType();
      const target = this.randomElement(targetModules);
      const severity = this.randomSeverity(intensity);

      faults.push({
        type: faultType,
        target,
        severity,
        duration: this.randomDuration(duration),
        probability: this.randomProbability(intensity),
        metadata: this.generateFaultMetadata(faultType),
      });
    }

    return {
      id: `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Random Chaos Scenario (${intensity})`,
      description: `Generated chaos scenario with ${faults.length} faults`,
      faults,
      duration,
      intensity,
    };
  }

  /**
   * Execute a chaos scenario
   */
  async executeScenario(scenario: ChaosScenario): Promise<ChaosRun> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const run: ChaosRun = {
      scenarioId: scenario.id,
      runId,
      startTime: Date.now(),
      faultsInjected: [],
      status: 'running',
      metrics: {
        totalFaults: scenario.faults.length,
        faultsTriggered: 0,
        errorsEncountered: 0,
      },
    };

    this.activeRuns.set(runId, run);

    try {
      // Inject faults with staggered timing for more realistic chaos
      const faultPromises = scenario.faults.map(async (fault, index) => {
        // Stagger fault injection
        const delay = Math.random() * (scenario.duration / scenario.faults.length);
        await this.sleep(delay);

        try {
          const faultId = await this.faultInjector.injectFault(fault);
          run.faultsInjected.push(faultId);
          if (run.metrics) {
            run.metrics.faultsTriggered++;
          }
        } catch (error) {
          if (run.metrics) {
            run.metrics.errorsEncountered++;
          }
          console.error(`Failed to inject fault: ${fault.type}`, error);
        }
      });

      await Promise.allSettled(faultPromises);

      // Wait for scenario duration
      await this.sleep(scenario.duration);

      run.status = 'completed';
      run.endTime = Date.now();
    } catch (error) {
      run.status = 'failed';
      run.endTime = Date.now();
      if (run.metrics) {
        run.metrics.errorsEncountered++;
      }
    }

    return run;
  }

  /**
   * Generate a cascading failure scenario
   */
  generateCascadingFailureScenario(
    initialFault: FaultConfig,
    cascadeDepth: number = 3
  ): ChaosScenario {
    const faults: FaultConfig[] = [initialFault];
    let currentTarget = initialFault.target;

    for (let i = 1; i < cascadeDepth; i++) {
      const nextFault: FaultConfig = {
        type: this.randomFaultType(),
        target: `${currentTarget}_dependent_${i}`,
        severity: 'high',
        duration: 5000 + i * 2000, // Increasing delays
        probability: 0.8, // High probability of cascade
        metadata: { cascadeLevel: i },
      };
      faults.push(nextFault);
      currentTarget = nextFault.target;
    }

    return {
      id: `cascade_${Date.now()}`,
      name: 'Cascading Failure Scenario',
      description: `Simulates cascading failures starting from ${initialFault.target}`,
      faults,
      duration: 30000,
      intensity: 'high',
    };
  }

  /**
   * Generate a network partition scenario
   */
  generateNetworkPartitionScenario(
    partitions: string[],
    duration: number = 10000
  ): ChaosScenario {
    const faults: FaultConfig[] = partitions.map((partition) => ({
      type: FaultType.NETWORK_PARTITION,
      target: partition,
      severity: 'critical',
      duration,
      probability: 1.0,
    }));

    return {
      id: `network_partition_${Date.now()}`,
      name: 'Network Partition Scenario',
      description: `Simulates network partitions across ${partitions.length} segments`,
      faults,
      duration,
      intensity: 'extreme',
    };
  }

  /**
   * Register a predefined scenario
   */
  registerScenario(scenario: ChaosScenario): void {
    this.predefinedScenarios.set(scenario.id, scenario);
  }

  /**
   * Get a predefined scenario by ID
   */
  getScenario(scenarioId: string): ChaosScenario | undefined {
    return this.predefinedScenarios.get(scenarioId);
  }

  /**
   * List all predefined scenarios
   */
  listScenarios(): ChaosScenario[] {
    return Array.from(this.predefinedScenarios.values());
  }

  /**
   * Get active chaos runs
   */
  getActiveRuns(): ChaosRun[] {
    return Array.from(this.activeRuns.values()).filter((r) => r.status === 'running');
  }

  /**
   * Get run by ID
   */
  getRun(runId: string): ChaosRun | undefined {
    return this.activeRuns.get(runId);
  }

  // Private helper methods

  private randomIntensity(): 'low' | 'medium' | 'high' | 'extreme' {
    const intensities: Array<'low' | 'medium' | 'high' | 'extreme'> = [
      'low',
      'medium',
      'high',
      'extreme',
    ];
    return this.randomElement(intensities);
  }

  private randomFaultType(): FaultType {
    const types = Object.values(FaultType);
    return this.randomElement(types);
  }

  private randomSeverity(
    intensity: 'low' | 'medium' | 'high' | 'extreme'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap = {
      low: ['low', 'medium'] as const,
      medium: ['medium', 'high'] as const,
      high: ['high', 'critical'] as const,
      extreme: ['critical'] as const,
    };
    return this.randomElement(severityMap[intensity]);
  }

  private randomDuration(maxDuration: number): number {
    return Math.floor(Math.random() * maxDuration);
  }

  private randomProbability(intensity: 'low' | 'medium' | 'high' | 'extreme'): number {
    const probabilityMap = {
      low: [0.3, 0.5],
      medium: [0.5, 0.7],
      high: [0.7, 0.9],
      extreme: [0.9, 1.0],
    };
    const range = probabilityMap[intensity];
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  private getDurationForIntensity(intensity: string): number {
    const durationMap: Record<string, number> = {
      low: 5000,
      medium: 15000,
      high: 30000,
      extreme: 60000,
    };
    return durationMap[intensity] || 10000;
  }

  private getMaxFaultsForIntensity(intensity: string): number {
    const maxFaultsMap: Record<string, number> = {
      low: 2,
      medium: 4,
      high: 8,
      extreme: 15,
    };
    return maxFaultsMap[intensity] || 5;
  }

  private generateFaultMetadata(faultType: FaultType): Record<string, any> {
    switch (faultType) {
      case FaultType.DELAYED_QUEUE:
        return { delayMs: Math.floor(Math.random() * 5000) + 1000 };
      case FaultType.DATA_CORRUPTION:
        return {
          corruptionType: this.randomElement(['bitflip', 'truncation', 'nullification']),
        };
      case FaultType.NETWORK_PARTITION:
        return { partitionType: this.randomElement(['full', 'partial']) };
      default:
        return {};
    }
  }

  private randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private initializePredefinedScenarios(): void {
    // Add some common predefined scenarios
    this.registerScenario({
      id: 'basic_chaos',
      name: 'Basic Chaos Test',
      description: 'Simple chaos scenario with mixed faults',
      faults: [
        {
          type: FaultType.DELAYED_QUEUE,
          target: 'queue',
          severity: 'medium',
          duration: 5000,
        },
        {
          type: FaultType.MODULE_CRASH,
          target: 'supervisor',
          severity: 'high',
          duration: 3000,
          probability: 0.5,
        },
      ],
      duration: 10000,
      intensity: 'medium',
    });
  }
}

