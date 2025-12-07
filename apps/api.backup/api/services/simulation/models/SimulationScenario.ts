/**
 * SimulationScenario model and types
 *
 * Represents a test scenario: domain state, external events, expected outcomes, success criteria
 */

import { PrismaClient, SimulationScenarioStatus, SimulationScenarioType } from '@prisma/client';

const prisma = new PrismaClient();

export interface DomainState {
  clinicians?: Record<string, any>;
  organizations?: Record<string, any>;
  credentials?: Record<string, any>;
  privileges?: Record<string, any>;
  enrollments?: Record<string, any>;
  [key: string]: any;
}

export interface ExternalEvent {
  type: string;
  timestamp: number; // Relative timestamp in milliseconds
  payload: Record<string, any>;
  target?: string; // Target module or entity
}

export interface ExpectedOutcome {
  statePath: string; // JSON path to check (e.g., "clinicians.clinician1.privileges")
  expectedValue: any;
  operator?: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
}

export interface SuccessCriteria {
  allOutcomesMustPass?: boolean;
  minOutcomePassRate?: number; // 0-1
  maxDriftFrequency?: number;
  maxRecoveryTime?: number; // milliseconds
  customChecks?: Array<{
    name: string;
    check: (finalState: DomainState) => boolean;
  }>;
}

export interface FaultInjectionConfig {
  enabled: boolean;
  faultTypes?: string[];
  probability?: number; // 0-1
  timing?: {
    startAfter?: number; // milliseconds
    duration?: number; // milliseconds
  };
}

export interface SimulationScenarioInput {
  name: string;
  description?: string;
  scenarioType: SimulationScenarioType;
  domainState: DomainState;
  externalEvents: ExternalEvent[];
  expectedOutcomes: ExpectedOutcome[];
  successCriteria: SuccessCriteria;
  timeAcceleration?: number;
  faultInjection?: FaultInjectionConfig;
  concurrentRuns?: number;
  metadata?: Record<string, any>;
}

export interface SimulationScenarioUpdate {
  name?: string;
  description?: string;
  status?: SimulationScenarioStatus;
  domainState?: DomainState;
  externalEvents?: ExternalEvent[];
  expectedOutcomes?: ExpectedOutcome[];
  successCriteria?: SuccessCriteria;
  timeAcceleration?: number;
  faultInjection?: FaultInjectionConfig;
  concurrentRuns?: number;
  metadata?: Record<string, any>;
}

/**
 * Create a new simulation scenario
 */
export async function createSimulationScenario(
  input: SimulationScenarioInput
): Promise<string> {
  const scenario = await prisma.simulationScenario.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      scenarioType: input.scenarioType,
      status: SimulationScenarioStatus.DRAFT,
      domainState: input.domainState as any,
      externalEvents: input.externalEvents as any,
      expectedOutcomes: input.expectedOutcomes as any,
      successCriteria: input.successCriteria as any,
      timeAcceleration: input.timeAcceleration ?? 1.0,
      faultInjection: input.faultInjection as any ?? null,
      concurrentRuns: input.concurrentRuns ?? 1,
      metadata: input.metadata as any ?? null,
    },
  });
  return scenario.id;
}

/**
 * Update a simulation scenario
 */
export async function updateSimulationScenario(
  id: string,
  update: SimulationScenarioUpdate
): Promise<void> {
  await prisma.simulationScenario.update({
    where: { id },
    data: {
      name: update.name,
      description: update.description,
      status: update.status,
      domainState: update.domainState as any,
      externalEvents: update.externalEvents as any,
      expectedOutcomes: update.expectedOutcomes as any,
      successCriteria: update.successCriteria as any,
      timeAcceleration: update.timeAcceleration,
      faultInjection: update.faultInjection as any,
      concurrentRuns: update.concurrentRuns,
      metadata: update.metadata as any,
    },
  });
}

/**
 * Get a simulation scenario by ID
 */
export async function getSimulationScenario(id: string) {
  return prisma.simulationScenario.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * List simulation scenarios
 */
export async function listSimulationScenarios(filters?: {
  scenarioType?: SimulationScenarioType;
  status?: SimulationScenarioStatus;
  limit?: number;
}) {
  return prisma.simulationScenario.findMany({
    where: {
      scenarioType: filters?.scenarioType,
      status: filters?.status,
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100,
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
}

/**
 * Delete a simulation scenario
 */
export async function deleteSimulationScenario(id: string): Promise<void> {
  await prisma.simulationScenario.delete({
    where: { id },
  });
}

export { SimulationScenarioStatus, SimulationScenarioType };
export type { DomainState, ExternalEvent, ExpectedOutcome, SuccessCriteria, FaultInjectionConfig };

