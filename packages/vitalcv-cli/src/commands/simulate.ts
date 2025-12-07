/**
 * SimulationRunner CLI
 *
 * Command to run scenarios from scripts; outputs reports
 * Supports batch mode and dry-run mode
 */

import { SimulationEngine } from '../../../services/simulation/engine.js';
import { simulationMetricsAggregator } from '../../../services/simulation/metrics/aggregator.js';
import {
  listSimulationScenarios,
  getSimulationScenario,
} from '../../../services/simulation/models/SimulationScenario.js';
import {
  createAllBaselineScenarios,
  scenarioLibrary,
} from '../../../services/simulation/scenarios/index.js';
import { parseArgs } from '../../../cli/utils/args.js';
import { readJsonFile } from '../../../cli/utils/io.js';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface SimulateCommandOptions {
  scenario?: string;
  scenarioType?: string;
  batch?: string;
  dryRun?: boolean;
  output?: string;
  timeAcceleration?: number;
  skipFaults?: boolean;
  createBaseline?: boolean;
  list?: boolean;
  metrics?: boolean;
}

/**
 * Run simulation command
 */
export async function runSimulateCommand(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const options: SimulateCommandOptions = {
    scenario: asString(flags.scenario ?? flags.s),
    scenarioType: asString(flags['scenario-type']),
    batch: asString(flags.batch ?? flags.b),
    dryRun: flags['dry-run'] === true || flags.dry === true,
    output: asString(flags.output ?? flags.o),
    timeAcceleration: asNumber(flags['time-acceleration']),
    skipFaults: flags['skip-faults'] === true,
    createBaseline: flags['create-baseline'] === true,
    list: flags.list === true || flags.l === true,
    metrics: flags.metrics === true || flags.m === true,
  };

  // List scenarios
  if (options.list) {
    await listScenarios(options.scenarioType);
    return;
  }

  // Show metrics
  if (options.metrics) {
    await showMetrics(options);
    return;
  }

  // Create baseline scenarios
  if (options.createBaseline) {
    await createBaselineScenarios();
    return;
  }

  // Run simulation
  if (options.batch) {
    await runBatchSimulation(options);
  } else if (options.scenario) {
    await runSingleSimulation(options);
  } else {
    throw new Error(
      'Either --scenario <id> or --batch <file> must be provided. Use --list to see available scenarios.'
    );
  }
}

/**
 * Run a single simulation scenario
 */
async function runSingleSimulation(options: SimulateCommandOptions): Promise<void> {
  const engine = new SimulationEngine();
  const scenarioId = options.scenario!;

  console.log(`Running simulation scenario: ${scenarioId}`);
  if (options.dryRun) {
    console.log('[DRY RUN MODE] - No actual execution will occur');
  }

  const startTime = Date.now();
  const result = await engine.executeScenario(scenarioId, {
    dryRun: options.dryRun,
    timeAcceleration: options.timeAcceleration,
    skipFaults: options.skipFaults,
  });
  const totalTime = Date.now() - startTime;

  // Display results
  console.log('\n=== Simulation Results ===');
  console.log(`Run ID: ${result.runId}`);
  console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Duration: ${result.duration}ms (total: ${totalTime}ms)`);
  console.log(`\nMetrics:`);
  console.log(`  Success Rate: ${(result.metrics.successRate * 100).toFixed(2)}%`);
  console.log(`  Events Executed: ${result.metrics.eventsExecuted}`);
  console.log(`  Faults Injected: ${result.metrics.faultsInjected}`);
  if (result.metrics.timing.recoveryTime) {
    console.log(`  Recovery Time: ${result.metrics.timing.recoveryTime}ms`);
  }
  if (result.metrics.driftFrequency) {
    console.log(`  Drift Frequency: ${result.metrics.driftFrequency} events/sec`);
  }

  console.log(`\nOutcomes:`);
  result.outcomes.forEach((outcome, index) => {
    const status = outcome.passed ? '✓' : '✗';
    console.log(
      `  ${status} [${index + 1}] ${outcome.path}: expected ${JSON.stringify(outcome.expected)}, got ${JSON.stringify(outcome.actual)}`
    );
  });

  if (result.error) {
    console.log(`\nError: ${result.error}`);
  }

  // Write output to file if specified
  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          runId: result.runId,
          success: result.success,
          duration: result.duration,
          metrics: result.metrics,
          outcomes: result.outcomes,
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`\nResults written to: ${options.output}`);
  }
}

/**
 * Run batch simulation from file
 */
async function runBatchSimulation(options: SimulateCommandOptions): Promise<void> {
  const batchFile = options.batch!;
  const batchConfig = await readJsonFile<{
    scenarios: string[];
    options?: {
      timeAcceleration?: number;
      skipFaults?: boolean;
      maxConcurrency?: number;
    };
  }>(batchFile);

  if (!batchConfig || !batchConfig.scenarios) {
    throw new Error(`Invalid batch file: ${batchFile}. Expected { scenarios: string[] }`);
  }

  const engine = new SimulationEngine();
  const scenarioIds = batchConfig.scenarios;
  const batchOptions = batchConfig.options || {};

  console.log(`Running batch simulation with ${scenarioIds.length} scenarios`);
  if (options.dryRun) {
    console.log('[DRY RUN MODE] - No actual execution will occur');
  }

  const startTime = Date.now();
  const results = await engine.executeConcurrent(scenarioIds, batchOptions.maxConcurrency || 5);
  const totalTime = Date.now() - startTime;

  // Display batch results
  console.log('\n=== Batch Simulation Results ===');
  console.log(`Total Scenarios: ${scenarioIds.length}`);
  console.log(`Successful: ${results.filter((r) => r.success).length}`);
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);
  console.log(`Total Duration: ${totalTime}ms`);

  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`Average Duration: ${avgDuration.toFixed(2)}ms`);

  // Detailed results
  console.log('\nDetailed Results:');
  results.forEach((result, index) => {
    const status = result.success ? '✓' : '✗';
    console.log(
      `  ${status} [${index + 1}] Scenario ${scenarioIds[index]}: ${result.duration}ms - ${result.success ? 'SUCCESS' : 'FAILED'}`
    );
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  // Write output to file if specified
  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          totalScenarios: scenarioIds.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          totalDuration: totalTime,
          averageDuration: avgDuration,
          results: results.map((r, i) => ({
            scenarioId: scenarioIds[i],
            runId: r.runId,
            success: r.success,
            duration: r.duration,
            metrics: r.metrics,
            error: r.error,
          })),
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`\nBatch results written to: ${options.output}`);
  }
}

/**
 * List available scenarios
 */
async function listScenarios(scenarioType?: string): Promise<void> {
  const scenarios = await listSimulationScenarios({
    scenarioType: scenarioType as any,
    limit: 100,
  });

  if (scenarios.length === 0) {
    console.log('No scenarios found.');
    return;
  }

  console.log(`\nAvailable Scenarios (${scenarios.length}):\n`);
  scenarios.forEach((scenario) => {
    console.log(`  ID: ${scenario.id}`);
    console.log(`  Name: ${scenario.name}`);
    console.log(`  Type: ${scenario.scenarioType}`);
    console.log(`  Status: ${scenario.status}`);
    console.log(`  Runs: ${scenario.runs.length}`);
    console.log('');
  });
}

/**
 * Show aggregated metrics
 */
async function showMetrics(options: SimulateCommandOptions): Promise<void> {
  const metrics = await simulationMetricsAggregator.aggregateMetrics({
    scenarioId: options.scenario,
    scenarioType: options.scenarioType as any,
  });

  console.log('\n=== Simulation Metrics ===\n');
  console.log(`Total Runs: ${metrics.totalRuns}`);
  console.log(`Successful: ${metrics.successfulRuns}`);
  console.log(`Failed: ${metrics.failedRuns}`);
  console.log(`Success Rate: ${(metrics.successRate * 100).toFixed(2)}%`);
  console.log(`\nTiming:`);
  console.log(`  Average Duration: ${metrics.averageDuration.toFixed(2)}ms`);
  console.log(`  P50 Duration: ${metrics.p50Duration.toFixed(2)}ms`);
  console.log(`  P95 Duration: ${metrics.p95Duration.toFixed(2)}ms`);
  console.log(`  P99 Duration: ${metrics.p99Duration.toFixed(2)}ms`);

  if (metrics.averageDriftFrequency !== undefined) {
    console.log(`\nDrift Frequency: ${metrics.averageDriftFrequency.toFixed(2)} events/sec`);
  }
  if (metrics.averageRecoveryTime !== undefined) {
    console.log(`Recovery Time: ${metrics.averageRecoveryTime.toFixed(2)}ms`);
  }

  console.log(`\nTotals:`);
  console.log(`  Faults Injected: ${metrics.totalFaultsInjected}`);
  console.log(`  Events Executed: ${metrics.totalEventsExecuted}`);

  if (Object.keys(metrics.metricsByScenario).length > 0) {
    console.log(`\nBy Scenario:`);
    Object.values(metrics.metricsByScenario).forEach((scenarioMetrics) => {
      console.log(`  ${scenarioMetrics.scenarioName || scenarioMetrics.scenarioId}:`);
      console.log(`    Runs: ${scenarioMetrics.runCount}`);
      console.log(`    Success Rate: ${(scenarioMetrics.successRate * 100).toFixed(2)}%`);
      console.log(`    Avg Duration: ${scenarioMetrics.averageDuration.toFixed(2)}ms`);
    });
  }

  if (Object.keys(metrics.metricsByType).length > 0) {
    console.log(`\nBy Type:`);
    Object.values(metrics.metricsByType).forEach((typeMetrics) => {
      console.log(`  ${typeMetrics.scenarioType}:`);
      console.log(`    Runs: ${typeMetrics.runCount}`);
      console.log(`    Success Rate: ${(typeMetrics.successRate * 100).toFixed(2)}%`);
      console.log(`    Avg Duration: ${typeMetrics.averageDuration.toFixed(2)}ms`);
    });
  }

  // Export to observability
  await simulationMetricsAggregator.exportToObservability(metrics);
}

/**
 * Create baseline scenarios
 */
async function createBaselineScenarios(): Promise<void> {
  console.log('Creating baseline scenarios...');
  const scenarioIds = await createAllBaselineScenarios();
  console.log(`Created ${scenarioIds.length} baseline scenarios:`);
  scenarioIds.forEach((id, index) => {
    const scenario = await getSimulationScenario(id);
    console.log(`  ${index + 1}. ${scenario?.name} (${id})`);
  });
}

function asString(value: string | boolean | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function asNumber(value: string | boolean | undefined): number | undefined {
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

