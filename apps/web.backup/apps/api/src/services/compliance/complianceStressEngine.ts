import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface StressScenario {
  id: string;
  name: string;
  employerCount: number;
  regulationChanges: Array<{ type: string; impact: number }>;
  churnRate: number;
  hiringSpike: number;
  results: {
    resilience: number;
    bottlenecks: Array<{ component: string; severity: string }>;
    failures: Array<{ type: string; count: number }>;
  };
}

export interface StressData {
  scenarios: StressScenario[];
  overallResilience: number;
  weakestComponents: Array<{ component: string; score: number }>;
  recommendations: Array<{ action: string; priority: string }>;
}

/**
 * Task 342.2 — Multi-employer stress simulator v3
 * Simulate compliance pressure from 10–100 employers.
 */
export async function simulateMultiEmployerStress(employerCount: number): Promise<StressScenario> {
  const scenario: StressScenario = {
    id: `stress-${Date.now()}`,
    name: `Multi-employer stress (${employerCount} employers)`,
    employerCount,
    regulationChanges: [],
    churnRate: 0.1,
    hiringSpike: 0.2,
    results: {
      resilience: 0.7,
      bottlenecks: [],
      failures: [],
    },
  };

  // Simulate compliance checks under stress
  const complianceChecks = await prisma.complianceCheck.findMany({
    take: employerCount * 10,
  });

  // Calculate resilience based on check success rate
  const successRate = complianceChecks.filter((c) => {
    const result = c.result as any;
    return result?.status === 'pass';
  }).length / complianceChecks.length;

  scenario.results.resilience = successRate;

  // Identify bottlenecks
  if (successRate < 0.8) {
    scenario.results.bottlenecks.push({
      component: 'compliance_check_processing',
      severity: 'high',
    });
  }

  return scenario;
}

/**
 * Task 342.3 — Regulation-change shock test
 * Inject simulated rule changes.
 */
export function injectRegulationShock(
  baseScenario: StressScenario,
  changes: Array<{ type: string; impact: number }>,
): StressScenario {
  const updatedScenario = {
    ...baseScenario,
    regulationChanges: changes,
  };

  // Reduce resilience based on regulation changes
  const totalImpact = changes.reduce((sum, c) => sum + c.impact, 0);
  updatedScenario.results.resilience = Math.max(
    0,
    updatedScenario.results.resilience - totalImpact * 0.1,
  );

  // Add failures based on impact
  for (const change of changes) {
    if (change.impact > 0.5) {
      updatedScenario.results.failures.push({
        type: `regulation_change_${change.type}`,
        count: Math.floor(change.impact * 10),
      });
    }
  }

  return updatedScenario;
}

/**
 * Task 342.5 — Compliance fault injection module
 * Test system resilience against faults.
 */
export async function injectComplianceFaults(
  scenario: StressScenario,
  faultTypes: Array<'network' | 'database' | 'api' | 'chain'>,
): Promise<StressScenario> {
  const updatedScenario = { ...scenario };

  for (const faultType of faultTypes) {
    updatedScenario.results.failures.push({
      type: `fault_${faultType}`,
      count: 1,
    });

    // Reduce resilience
    updatedScenario.results.resilience -= 0.1;
  }

  return updatedScenario;
}

/**
 * Task 342.6 — Compliance propagation analyzer
 * Map how stress impacts entire ecosystem.
 */
export function analyzeStressPropagation(scenarios: StressScenario[]): {
  propagationMap: Record<string, number>;
  criticalPaths: Array<{ path: string; impact: number }>;
} {
  const propagationMap: Record<string, number> = {};
  const criticalPaths: Array<{ path: string; impact: number }> = [];

  for (const scenario of scenarios) {
    // Map how stress propagates through components
    for (const bottleneck of scenario.results.bottlenecks) {
      propagationMap[bottleneck.component] =
        (propagationMap[bottleneck.component] || 0) + 1;
    }

    // Identify critical paths
    if (scenario.results.resilience < 0.5) {
      criticalPaths.push({
        path: scenario.name,
        impact: 1 - scenario.results.resilience,
      });
    }
  }

  return { propagationMap, criticalPaths };
}

/**
 * Task 342.7 — Stress-driven bottleneck detector
 * Detect weakest compliance components.
 */
export function detectBottlenecks(scenarios: StressScenario[]): Array<{
  component: string;
  severity: string;
  frequency: number;
}> {
  const bottlenecks = new Map<string, number>();

  for (const scenario of scenarios) {
    for (const bottleneck of scenario.results.bottlenecks) {
      bottlenecks.set(
        bottleneck.component,
        (bottlenecks.get(bottleneck.component) || 0) + 1,
      );
    }
  }

  return Array.from(bottlenecks.entries())
    .map(([component, frequency]) => ({
      component,
      severity: frequency > 5 ? 'high' : frequency > 2 ? 'medium' : 'low',
      frequency,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Task 342.8 — Resilience reinforcement suggestions
 * Suggest improvements to regulatory resilience.
 */
export function generateResilienceSuggestions(
  scenarios: StressScenario[],
  bottlenecks: Array<{ component: string; severity: string; frequency: number }>,
): Array<{ action: string; priority: string }> {
  const recommendations: Array<{ action: string; priority: string }> = [];

  // High-frequency bottlenecks need high-priority fixes
  for (const bottleneck of bottlenecks) {
    if (bottleneck.severity === 'high') {
      recommendations.push({
        action: `Improve ${bottleneck.component} resilience`,
        priority: 'high',
      });
    }
  }

  // Low resilience scenarios need attention
  const lowResilience = scenarios.filter((s) => s.results.resilience < 0.6);
  if (lowResilience.length > 0) {
    recommendations.push({
      action: 'Review compliance check processing capacity',
      priority: 'medium',
    });
  }

  return recommendations;
}

/**
 * Task 342.1 — Get or create stress engine data
 */
export async function getOrCreateStressData(): Promise<StressData> {
  let stress = await prisma.complianceStressEngine.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!stress) {
    // Run stress scenarios
    const scenarios: StressScenario[] = [];

    // Simulate different employer counts
    for (const count of [10, 50, 100]) {
      const scenario = await simulateMultiEmployerStress(count);
      scenarios.push(scenario);
    }

    // Inject regulation changes
    const shockedScenario = injectRegulationShock(scenarios[0], [
      { type: 'license_renewal_window', impact: 0.3 },
      { type: 'sanctions_check_frequency', impact: 0.2 },
    ]);
    scenarios.push(shockedScenario);

    const bottlenecks = detectBottlenecks(scenarios);
    const recommendations = generateResilienceSuggestions(scenarios, bottlenecks);
    const propagation = analyzeStressPropagation(scenarios);

    const overallResilience =
      scenarios.reduce((sum, s) => sum + s.results.resilience, 0) / scenarios.length;

    const stressData: StressData = {
      scenarios,
      overallResilience,
      weakestComponents: bottlenecks.map((b) => ({
        component: b.component,
        score: 1 - b.frequency / 10,
      })),
      recommendations,
    };

    stress = await prisma.complianceStressEngine.create({
      data: {
        stress: stressData,
      },
    });
  }

  return stress.stress as StressData;
}

/**
 * Task 342.9 — Compliance stress export
 * Regulator-focused stress test report.
 */
export function exportStressReport(stress: StressData): {
  format: string;
  data: Record<string, unknown>;
  hash: string;
} {
  const report = {
    overallResilience: stress.overallResilience,
    scenarios: stress.scenarios.map((s) => ({
      name: s.name,
      resilience: s.results.resilience,
      bottlenecks: s.results.bottlenecks,
    })),
    weakestComponents: stress.weakestComponents,
    recommendations: stress.recommendations,
    exportedAt: new Date().toISOString(),
  };

  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(report))
    .digest('hex');

  return {
    format: 'regulatory_stress_test_v1',
    data: report,
    hash: `0x${hash}`,
  };
}

/**
 * Task 342.10 — Anchor compliance stress snapshot
 */
export async function anchorStressSnapshot(): Promise<string | null> {
  try {
    const stress = await prisma.complianceStressEngine.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!stress) {
      return null;
    }

    const stressData = stress.stress as StressData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'complianceStressAnchored',
      payload: {
        overallResilience: stressData.overallResilience,
        scenarioCount: stressData.scenarios.length,
        weakestComponentCount: stressData.weakestComponents.length,
        recommendationCount: stressData.recommendations.length,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[stress] anchor failed', error);
    return null;
  }
}

