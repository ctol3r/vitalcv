/**
 * B207B-LIFE-007: TrajectorySimulator
 *
 * Projects clinician into multiple future timelines (Monte Carlo or Markov);
 * stores trajectories for analysis and decision support.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type {
  ClinicianCurrentState,
  FutureStateProbabilities,
} from '../model/transitionModel.js';
import { calculateTransitionProbabilities } from '../model/transitionModel.js';

const prisma = new PrismaClient();
const log = getServiceLogger('services/lifecycle/trajectorySimulator');

export interface TrajectoryStep {
  timestamp: Date;
  dayOffset: number; // Days from start
  state: FutureStateProbabilities;
  events: Array<{
    type: string;
    probability: number;
    impact: 'low' | 'med' | 'high' | 'critical';
    description: string;
  }>;
}

export interface Trajectory {
  id: string;
  clinicianId: string;
  simulationType: 'monte_carlo' | 'markov';
  simulationId: string; // For grouping multiple runs
  trajectoryNumber: number; // Which trajectory in this simulation
  startedAt: Date;
  steps: TrajectoryStep[];
  finalState: FutureStateProbabilities | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface TrajectorySimulationOptions {
  simulationType?: 'monte_carlo' | 'markov';
  numTrajectories?: number;
  horizonDays?: number;
  stepSizeDays?: number;
  seed?: number; // For reproducible Monte Carlo
}

export interface TrajectorySimulationResult {
  simulationId: string;
  clinicianId: string;
  simulationType: 'monte_carlo' | 'markov';
  numTrajectories: number;
  trajectories: Trajectory[];
  aggregateProbabilities: {
    risk: FutureStateProbabilities['risk'];
    privilegeReadiness: FutureStateProbabilities['privilegeReadiness'];
    enrollmentStability: FutureStateProbabilities['enrollmentStability'];
    compactEligibility: FutureStateProbabilities['compactEligibility'];
    safetyEvents: FutureStateProbabilities['safetyEvents'];
  };
  summary: {
    avgStepsPerTrajectory: number;
    criticalEventProbability: number;
    highRiskHorizons: Array<{ day: number; probability: number }>;
  };
  createdAt: Date;
}

/**
 * Simulate multiple future trajectories for a clinician
 */
export async function simulateTrajectories(
  currentState: ClinicianCurrentState,
  options: TrajectorySimulationOptions = {}
): Promise<TrajectorySimulationResult> {
  const {
    simulationType = 'monte_carlo',
    numTrajectories = 100,
    horizonDays = 365,
    stepSizeDays = 30,
    seed,
  } = options;

  const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const trajectories: Trajectory[] = [];

  log.info('Starting trajectory simulation', {
    clinicianId: currentState.clinicianId,
    simulationType,
    numTrajectories,
    horizonDays,
  });

  if (simulationType === 'monte_carlo') {
    // Monte Carlo simulation: random walk based on probabilities
    for (let i = 0; i < numTrajectories; i++) {
      const trajectory = await simulateMonteCarloTrajectory(
        currentState,
        {
          simulationId,
          trajectoryNumber: i,
          horizonDays,
          stepSizeDays,
          seed: seed ? seed + i : undefined,
        }
      );
      trajectories.push(trajectory);
    }
  } else {
    // Markov chain simulation: deterministic state transitions
    const trajectory = await simulateMarkovTrajectory(
      currentState,
      {
        simulationId,
        trajectoryNumber: 0,
        horizonDays,
        stepSizeDays,
      }
    );
    trajectories.push(trajectory);
  }

  // Aggregate results across trajectories
  const aggregateProbabilities = aggregateTrajectoryProbabilities(trajectories);
  const summary = calculateSummaryStatistics(trajectories, horizonDays);

  const result: TrajectorySimulationResult = {
    simulationId,
    clinicianId: currentState.clinicianId,
    simulationType,
    numTrajectories: trajectories.length,
    trajectories,
    aggregateProbabilities,
    summary,
    createdAt: new Date(),
  };

  // Store trajectories in database
  await storeTrajectories(trajectories);

  log.info('Trajectory simulation complete', {
    simulationId,
    numTrajectories: trajectories.length,
    criticalEventProbability: summary.criticalEventProbability,
  });

  return result;
}

/**
 * Simulate a single Monte Carlo trajectory (random walk)
 */
async function simulateMonteCarloTrajectory(
  currentState: ClinicianCurrentState,
  options: {
    simulationId: string;
    trajectoryNumber: number;
    horizonDays: number;
    stepSizeDays: number;
    seed?: number;
  }
): Promise<Trajectory> {
  const { simulationId, trajectoryNumber, horizonDays, stepSizeDays, seed } = options;
  const steps: TrajectoryStep[] = [];
  let state = currentState;
  const rng = seed ? createSeededRNG(seed) : Math.random;

  const startTime = new Date();
  const numSteps = Math.ceil(horizonDays / stepSizeDays);

  for (let step = 0; step < numSteps; step++) {
    const dayOffset = step * stepSizeDays;
    const timestamp = new Date(startTime.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    // Calculate probabilities for this step
    const probabilities = await calculateTransitionProbabilities(state);

    // Sample events based on probabilities (Monte Carlo)
    const events = sampleEvents(probabilities, rng);

    steps.push({
      timestamp,
      dayOffset,
      state: probabilities,
      events,
    });

    // Update state based on sampled events (state evolves)
    state = evolveState(state, events, stepSizeDays, rng);
  }

  return {
    id: `traj_${simulationId}_${trajectoryNumber}`,
    clinicianId: currentState.clinicianId,
    simulationType: 'monte_carlo',
    simulationId,
    trajectoryNumber,
    startedAt: startTime,
    steps,
    finalState: steps.length > 0 ? steps[steps.length - 1].state : null,
    createdAt: new Date(),
  };
}

/**
 * Simulate a Markov chain trajectory (deterministic state transitions)
 */
async function simulateMarkovTrajectory(
  currentState: ClinicianCurrentState,
  options: {
    simulationId: string;
    trajectoryNumber: number;
    horizonDays: number;
    stepSizeDays: number;
  }
): Promise<Trajectory> {
  const { simulationId, trajectoryNumber, horizonDays, stepSizeDays } = options;
  const steps: TrajectoryStep[] = [];
  let state = currentState;

  const startTime = new Date();
  const numSteps = Math.ceil(horizonDays / stepSizeDays);

  for (let step = 0; step < numSteps; step++) {
    const dayOffset = step * stepSizeDays;
    const timestamp = new Date(startTime.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    // Calculate probabilities for this step
    const probabilities = await calculateTransitionProbabilities(state);

    // Deterministic events based on thresholds (Markov)
    const events = determineEvents(probabilities);

    steps.push({
      timestamp,
      dayOffset,
      state: probabilities,
      events,
    });

    // Update state deterministically (no randomness)
    state = evolveStateDeterministic(state, probabilities, stepSizeDays);
  }

  return {
    id: `traj_${simulationId}_${trajectoryNumber}`,
    clinicianId: currentState.clinicianId,
    simulationType: 'markov',
    simulationId,
    trajectoryNumber,
    startedAt: startTime,
    steps,
    finalState: steps.length > 0 ? steps[steps.length - 1].state : null,
    createdAt: new Date(),
  };
}


/**
 * Determine events from probabilities (Markov - deterministic)
 */
function determineEvents(
  probabilities: FutureStateProbabilities
): TrajectoryStep['events'] {
  const events: TrajectoryStep['events'] = [];
  const threshold = 0.5; // Threshold for deterministic event occurrence

  if (probabilities.risk.licenseExpiryRisk >= threshold) {
    events.push({
      type: 'license_expiry',
      probability: probabilities.risk.licenseExpiryRisk,
      impact: probabilities.risk.licenseExpiryRisk > 0.7 ? 'critical' : 'high',
      description: 'License expiry predicted',
    });
  }

  if (probabilities.risk.credentialLapseRisk >= threshold) {
    events.push({
      type: 'credential_lapse',
      probability: probabilities.risk.credentialLapseRisk,
      impact: probabilities.risk.credentialLapseRisk > 0.7 ? 'high' : 'med',
      description: 'Credential lapse predicted',
    });
  }

  if (probabilities.safetyEvents.safetySignalProbability30d >= threshold) {
    events.push({
      type: 'safety_signal',
      probability: probabilities.safetyEvents.safetySignalProbability30d,
      impact: probabilities.safetyEvents.safetySignalProbability30d > 0.3 ? 'high' : 'med',
      description: 'Safety signal predicted',
    });
  }

  if (probabilities.safetyEvents.qualityIssueProbability30d >= threshold) {
    events.push({
      type: 'quality_issue',
      probability: probabilities.safetyEvents.qualityIssueProbability30d,
      impact: probabilities.safetyEvents.qualityIssueProbability30d > 0.3 ? 'med' : 'low',
      description: 'Quality issue predicted',
    });
  }

  if (probabilities.risk.enrollmentDisruptionRisk >= threshold) {
    events.push({
      type: 'enrollment_disruption',
      probability: probabilities.risk.enrollmentDisruptionRisk,
      impact: probabilities.risk.enrollmentDisruptionRisk > 0.5 ? 'high' : 'med',
      description: 'Enrollment disruption predicted',
    });
  }

  return events;
}

/**
 * Evolve state based on sampled events (Monte Carlo)
 */
function evolveState(
  state: ClinicianCurrentState,
  events: TrajectoryStep['events'],
  daysElapsed: number,
  rng: () => number
): ClinicianCurrentState {
  const newState = { ...state };

  // Apply event impacts
  for (const event of events) {
    switch (event.type) {
      case 'license_expiry':
        // Degrade license status if expiry is near
        newState.licenses = newState.licenses.map((license) => {
          const daysUntilExpiry = (license.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntilExpiry < 90 && license.status === 'ACTIVE') {
            return { ...license, status: 'EXPIRING' };
          }
          return license;
        });
        break;

      case 'safety_signal':
        // Decrease safety score
        newState.safetyScore = Math.max(0, newState.safetyScore - 10);
        newState.recentSafetySignals += 1;
        break;

      case 'quality_issue':
        // Decrease OPPE trend
        newState.oppeTrend = Math.max(-1, newState.oppeTrend - 0.2);
        newState.recentDriftEvents += 1;
        break;

      case 'enrollment_disruption':
        // Degrade enrollment status
        newState.payerEnrollments = newState.payerEnrollments.map((enrollment) => {
          if (enrollment.status === 'APPROVED' && rng() < 0.3) {
            return { ...enrollment, status: 'PENDING' };
          }
          return enrollment;
        });
        break;
    }
  }

  // Time-based evolution (licenses get closer to expiry, etc.)
  newState.licenses = newState.licenses.map((license) => {
    const newExpiryDate = new Date(license.expiryDate.getTime() - daysElapsed * 24 * 60 * 60 * 1000);
    return { ...license, expiryDate: newExpiryDate };
  });

  // Gradual recovery of safety score if no new events
  if (events.length === 0 && newState.safetyScore < 100) {
    newState.safetyScore = Math.min(100, newState.safetyScore + 1);
  }

  return newState;
}

/**
 * Sample events from probabilities (Monte Carlo)
 */
function sampleEvents(
  probabilities: FutureStateProbabilities,
  rng: () => number
): TrajectoryStep['events'] {
  const events: TrajectoryStep['events'] = [];

  // Sample license expiry event
  if (rng() < probabilities.risk.licenseExpiryRisk) {
    events.push({
      type: 'license_expiry',
      probability: probabilities.risk.licenseExpiryRisk,
      impact: probabilities.risk.licenseExpiryRisk > 0.7 ? 'critical' : 'high',
      description: 'License expiry predicted',
    });
  }

  // Sample credential lapse event
  if (rng() < probabilities.risk.credentialLapseRisk) {
    events.push({
      type: 'credential_lapse',
      probability: probabilities.risk.credentialLapseRisk,
      impact: probabilities.risk.credentialLapseRisk > 0.7 ? 'high' : 'med',
      description: 'Credential lapse predicted',
    });
  }

  // Sample safety signal event
  if (rng() < probabilities.safetyEvents.safetySignalProbability30d) {
    events.push({
      type: 'safety_signal',
      probability: probabilities.safetyEvents.safetySignalProbability30d,
      impact: probabilities.safetyEvents.safetySignalProbability30d > 0.3 ? 'high' : 'med',
      description: 'Safety signal predicted',
    });
  }

  // Sample quality issue event
  if (rng() < probabilities.safetyEvents.qualityIssueProbability30d) {
    events.push({
      type: 'quality_issue',
      probability: probabilities.safetyEvents.qualityIssueProbability30d,
      impact: probabilities.safetyEvents.qualityIssueProbability30d > 0.3 ? 'med' : 'low',
      description: 'Quality issue predicted',
    });
  }

  // Sample enrollment disruption event
  if (rng() < probabilities.risk.enrollmentDisruptionRisk) {
    events.push({
      type: 'enrollment_disruption',
      probability: probabilities.risk.enrollmentDisruptionRisk,
      impact: probabilities.risk.enrollmentDisruptionRisk > 0.5 ? 'high' : 'med',
      description: 'Enrollment disruption predicted',
    });
  }

  return events;
}

/**
 * Evolve state deterministically (Markov)
 */
function evolveStateDeterministic(
  state: ClinicianCurrentState,
  probabilities: FutureStateProbabilities,
  daysElapsed: number
): ClinicianCurrentState {
  const newState = { ...state };

  // Apply deterministic changes based on probabilities
  if (probabilities.risk.licenseExpiryRisk > 0.5) {
    newState.licenses = newState.licenses.map((license) => {
      const daysUntilExpiry = (license.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 90 && license.status === 'ACTIVE') {
        return { ...license, status: 'EXPIRING' };
      }
      return license;
    });
  }

  if (probabilities.safetyEvents.safetySignalProbability30d > 0.5) {
    newState.safetyScore = Math.max(0, newState.safetyScore - 5);
  }

  if (probabilities.safetyEvents.qualityIssueProbability30d > 0.5) {
    newState.oppeTrend = Math.max(-1, newState.oppeTrend - 0.1);
  }

  // Time-based evolution
  newState.licenses = newState.licenses.map((license) => {
    const newExpiryDate = new Date(license.expiryDate.getTime() - daysElapsed * 24 * 60 * 60 * 1000);
    return { ...license, expiryDate: newExpiryDate };
  });

  return newState;
}

/**
 * Aggregate probabilities across trajectories
 */
function aggregateTrajectoryProbabilities(
  trajectories: Trajectory[]
): TrajectorySimulationResult['aggregateProbabilities'] {
  if (trajectories.length === 0) {
    throw new Error('Cannot aggregate empty trajectory set');
  }

  // Use final state or last step's state
  const finalStates = trajectories
    .map((t) => t.finalState || (t.steps.length > 0 ? t.steps[t.steps.length - 1].state : null))
    .filter((s): s is FutureStateProbabilities => s !== null);

  if (finalStates.length === 0) {
    throw new Error('No valid final states found in trajectories');
  }

  // Average probabilities across trajectories
  const aggregate = {
    risk: {
      licenseExpiryRisk: average(finalStates.map((s) => s.risk.licenseExpiryRisk)),
      credentialLapseRisk: average(finalStates.map((s) => s.risk.credentialLapseRisk)),
      safetySignalRisk: average(finalStates.map((s) => s.risk.safetySignalRisk)),
      qualityRisk: average(finalStates.map((s) => s.risk.qualityRisk)),
      enrollmentDisruptionRisk: average(finalStates.map((s) => s.risk.enrollmentDisruptionRisk)),
    },
    privilegeReadiness: {
      currentPrivilegeStability: average(finalStates.map((s) => s.privilegeReadiness.currentPrivilegeStability)),
      privilegeExpansionReadiness: average(finalStates.map((s) => s.privilegeReadiness.privilegeExpansionReadiness)),
      fppeCompletionLikelihood: average(finalStates.map((s) => s.privilegeReadiness.fppeCompletionLikelihood)),
      oppeSustainedSuccess: average(finalStates.map((s) => s.privilegeReadiness.oppeSustainedSuccess)),
    },
    enrollmentStability: {
      payerEnrollmentStability: average(finalStates.map((s) => s.enrollmentStability.payerEnrollmentStability)),
      pecosRevalidationSuccess: average(finalStates.map((s) => s.enrollmentStability.pecosRevalidationSuccess)),
      enrollmentDisruptionProbability: average(finalStates.map((s) => s.enrollmentStability.enrollmentDisruptionProbability)),
    },
    compactEligibility: {
      imlcMaintenanceProbability: average(finalStates.map((s) => s.compactEligibility.imlcMaintenanceProbability)),
      psypactMaintenanceProbability: average(finalStates.map((s) => s.compactEligibility.psypactMaintenanceProbability)),
      counselingMaintenanceProbability: average(finalStates.map((s) => s.compactEligibility.counselingMaintenanceProbability)),
      compactLossRisk: average(finalStates.map((s) => s.compactEligibility.compactLossRisk)),
    },
    safetyEvents: {
      safetySignalProbability30d: average(finalStates.map((s) => s.safetyEvents.safetySignalProbability30d)),
      safetySignalProbability90d: average(finalStates.map((s) => s.safetyEvents.safetySignalProbability90d)),
      qualityIssueProbability30d: average(finalStates.map((s) => s.safetyEvents.qualityIssueProbability30d)),
      qualityIssueProbability90d: average(finalStates.map((s) => s.safetyEvents.qualityIssueProbability90d)),
      driftEventProbability30d: average(finalStates.map((s) => s.safetyEvents.driftEventProbability30d)),
      driftEventProbability90d: average(finalStates.map((s) => s.safetyEvents.driftEventProbability90d)),
    },
  };

  return aggregate;
}

/**
 * Calculate summary statistics from trajectories
 */
function calculateSummaryStatistics(
  trajectories: Trajectory[],
  horizonDays: number
): TrajectorySimulationResult['summary'] {
  const avgStepsPerTrajectory = average(trajectories.map((t) => t.steps.length));

  // Calculate critical event probability (any critical event across all trajectories)
  const trajectoriesWithCriticalEvents = trajectories.filter((t) =>
    t.steps.some((step) => step.events.some((e) => e.impact === 'critical'))
  );
  const criticalEventProbability = trajectoriesWithCriticalEvents.length / trajectories.length;

  // Identify high-risk horizons (time periods with high event probabilities)
  const highRiskHorizons: Array<{ day: number; probability: number }> = [];
  const stepSize = 30; // days per step
  const numSteps = Math.ceil(horizonDays / stepSize);

  for (let step = 0; step < numSteps; step++) {
    const day = step * stepSize;
    const stepEventProbs: number[] = [];

    for (const trajectory of trajectories) {
      if (trajectory.steps[step]) {
        const stepState = trajectory.steps[step].state;
        // Combine risk probabilities for this step
        const combinedRisk = Math.max(
          stepState.risk.licenseExpiryRisk,
          stepState.risk.safetySignalRisk,
          stepState.risk.enrollmentDisruptionRisk
        );
        stepEventProbs.push(combinedRisk);
      }
    }

    if (stepEventProbs.length > 0) {
      const avgProb = average(stepEventProbs);
      if (avgProb > 0.5) {
        highRiskHorizons.push({ day, probability: avgProb });
      }
    }
  }

  return {
    avgStepsPerTrajectory,
    criticalEventProbability,
    highRiskHorizons,
  };
}

/**
 * Store trajectories in database (stub - implement with actual schema)
 */
async function storeTrajectories(trajectories: Trajectory[]): Promise<void> {
  // TODO: Implement database storage when schema is available
  // For now, log that trajectories would be stored
  log.debug('Storing trajectories', {
    count: trajectories.length,
    simulationIds: [...new Set(trajectories.map((t) => t.simulationId))],
  });
}

/**
 * Helper: Calculate average
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Helper: Create seeded random number generator
 */
function createSeededRNG(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

