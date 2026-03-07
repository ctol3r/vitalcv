/**
 * onboardingFlows.ts — Wave 123 + 126: Mission Ops + Conversion Engine
 *
 * Tracks onboarding state for issuers, verifiers, and partners and persists
 * that state through a repository abstraction. The cache keeps existing sync
 * readers stable while writes remain durable.
 */

import { log } from '../../obs/logger';
import {
  PrismaOnboardingFlowsRepository,
  type OnboardingFlowsRepository,
} from '../../../repositories/onboardingFlows.repo';
import { listIssuers } from '../registry/trustRegistry';
import { listFederationEntities } from '../federation/federationMetadata';
import { getInheritedControls } from '../healthstart/controlInheritance';
import { validateControlHealth } from '../healthstart/controlInheritance';

// ── Types ─────────────────────────────────────────────────────────────

export type OnboardingRole = 'ISSUER' | 'VERIFIER' | 'PARTNER';
export type StageStatus = 'COMPLETE' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED';

export interface OnboardingStage {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  completedAt?: string;
  blockedReason?: string;
}

export interface OnboardingFlow {
  role: OnboardingRole;
  entityId: string;
  entityName: string;
  stages: OnboardingStage[];
  overallProgress: number; // 0-100
  createdAt: string;
  lastUpdated: string;
}

export interface MissionOpsOverview {
  issuerOnboarding: {
    total: number;
    complete: number;
    inProgress: number;
    blocked: number;
  };
  verifierOnboarding: {
    total: number;
    complete: number;
    inProgress: number;
  };
  federationHealth: {
    totalPeers: number;
    activePeers: number;
    degradedPeers: number;
  };
  trustRegistryHealth: {
    totalIssuers: number;
    haipCompliant: number;
    averageTrustScore: number;
  };
  controlInheritanceStatus: {
    totalControls: number;
    inherited: number;
    healthy: boolean;
  };
  systemReadiness: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';
  computedAt: string;
}

// ── Onboarding Stage Definitions ──────────────────────────────────────

const ISSUER_STAGES: Omit<OnboardingStage, 'status'>[] = [
  { id: 'register', name: 'Registry Registration', description: 'Register in VitalCV trust registry with DID and public key' },
  { id: 'haip',     name: 'HAIP Profile Setup',    description: 'Configure HAIP-compliant credential templates' },
  { id: 'test',     name: 'Test Issuance',         description: 'Issue test credentials in sandbox environment' },
  { id: 'review',   name: 'Peer Review',           description: 'Obtain peer endorsement from existing issuers' },
  { id: 'activate', name: 'Production Activation', description: 'Activate production issuance with monitoring' },
  { id: 'monitor',  name: 'Trust Monitoring',      description: 'Continuous trust score and revocation monitoring' },
];

const VERIFIER_STAGES: Omit<OnboardingStage, 'status'>[] = [
  { id: 'sdk',      name: 'SDK Integration',      description: 'Install and configure @vitalcv/verifier-sdk' },
  { id: 'api-key',  name: 'API Key Provisioning', description: 'Generate API key with appropriate tier' },
  { id: 'webhook',  name: 'Webhook Configuration', description: 'Set up credential verification webhooks' },
  { id: 'test',     name: 'Test Verification',     description: 'Verify test credentials in sandbox' },
  { id: 'fhir',     name: 'FHIR Integration',      description: 'Configure FHIR R4 export (optional)' },
  { id: 'go-live',  name: 'Production Go-Live',    description: 'Enable production verification with monitoring' },
];

const PARTNER_STAGES: Omit<OnboardingStage, 'status'>[] = [
  { id: 'register', name: 'Network Registration',  description: 'Register as federated network peer' },
  { id: 'metadata', name: 'Metadata Exchange',     description: 'Exchange federation metadata and trust anchors' },
  { id: 'validate', name: 'Trust Chain Validation', description: 'Validate mutual trust chains' },
  { id: 'interop',  name: 'Interoperability Test', description: 'Cross-network credential verification test' },
  { id: 'activate', name: 'Federation Activation', description: 'Activate bidirectional federation' },
];

// ── Cache + repository ────────────────────────────────────────────────

function cloneFlow(flow: OnboardingFlow): OnboardingFlow {
  return structuredClone(flow);
}

function computeProgress(stages: OnboardingStage[]): number {
  const complete = stages.filter((stage) => stage.status === 'COMPLETE').length;
  return Math.round((complete / stages.length) * 100);
}

function sortFlows(flows: readonly OnboardingFlow[]): OnboardingFlow[] {
  return [...flows].sort(
    (left, right) => new Date(right.lastUpdated).getTime() - new Date(left.lastUpdated).getTime(),
  );
}

function replaceCache(flows: readonly OnboardingFlow[]): void {
  onboardingFlowCache = new Map(
    flows.map((flow) => [`${flow.role}:${flow.entityId}`, cloneFlow(flow)]),
  );
}

function getTemplates(role: OnboardingRole): Omit<OnboardingStage, 'status'>[] {
  if (role === 'ISSUER') {
    return ISSUER_STAGES;
  }
  if (role === 'VERIFIER') {
    return VERIFIER_STAGES;
  }
  return PARTNER_STAGES;
}

let onboardingFlowsRepository: OnboardingFlowsRepository = new PrismaOnboardingFlowsRepository();
let onboardingFlowCache = new Map<string, OnboardingFlow>();
let initializationPromise: Promise<void> | null = null;

export function setOnboardingFlowsRepository(repository: OnboardingFlowsRepository): void {
  onboardingFlowsRepository = repository;
  onboardingFlowCache = new Map<string, OnboardingFlow>();
  initializationPromise = null;
}

export function resetOnboardingFlowsRepository(): void {
  setOnboardingFlowsRepository(new PrismaOnboardingFlowsRepository());
}

export async function initializeOnboardingFlowsPersistence(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const flows = await onboardingFlowsRepository.listFlows();
      replaceCache(flows);
      log('info', 'mission_ops_onboarding_initialized', {
        flowCount: flows.length,
      });
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create or get an onboarding flow for an entity.
 */
export async function getOrCreateOnboardingFlow(
  role: OnboardingRole,
  entityId: string,
  entityName: string,
): Promise<OnboardingFlow> {
  await initializeOnboardingFlowsPersistence();
  const key = `${role}:${entityId}`;
  const existing = onboardingFlowCache.get(key);
  if (existing) {
    return cloneFlow(existing);
  }

  const now = new Date().toISOString();
  const flow: OnboardingFlow = {
    role,
    entityId,
    entityName,
    stages: getTemplates(role).map((template) => ({ ...template, status: 'PENDING' as StageStatus })),
    overallProgress: 0,
    createdAt: now,
    lastUpdated: now,
  };

  const persisted = await onboardingFlowsRepository.upsertFlow(flow);
  onboardingFlowCache.set(key, cloneFlow(persisted));
  log('info', `mission_ops: created ${role} onboarding flow`, { entityId, entityName });
  return cloneFlow(persisted);
}

/**
 * Update a stage status in an onboarding flow.
 */
export async function updateOnboardingStage(
  role: OnboardingRole,
  entityId: string,
  stageId: string,
  status: StageStatus,
  blockedReason?: string,
): Promise<OnboardingFlow | null> {
  await initializeOnboardingFlowsPersistence();
  const key = `${role}:${entityId}`;
  const existing = onboardingFlowCache.get(key);
  if (!existing) {
    return null;
  }

  const flow = cloneFlow(existing);
  const stage = flow.stages.find((candidate) => candidate.id === stageId);
  if (!stage) {
    return null;
  }

  stage.status = status;
  stage.completedAt = status === 'COMPLETE' ? new Date().toISOString() : undefined;
  stage.blockedReason = status === 'BLOCKED' ? blockedReason : undefined;
  flow.overallProgress = computeProgress(flow.stages);
  flow.lastUpdated = new Date().toISOString();

  const persisted = await onboardingFlowsRepository.upsertFlow(flow);
  onboardingFlowCache.set(key, cloneFlow(persisted));
  log('info', `mission_ops: updated stage ${stageId} → ${status}`, { role, entityId });
  return cloneFlow(persisted);
}

/**
 * List all onboarding flows, optionally filtered by role.
 */
export function listOnboardingFlows(role?: OnboardingRole): OnboardingFlow[] {
  const flows = sortFlows(Array.from(onboardingFlowCache.values()).map(cloneFlow));
  return role ? flows.filter((flow) => flow.role === role) : flows;
}

/**
 * Compute the full Mission Ops overview from live system state.
 */
export function computeMissionOpsOverview(): MissionOpsOverview {
  const flows = listOnboardingFlows();
  const issuerFlows = flows.filter((flow) => flow.role === 'ISSUER');
  const verifierFlows = flows.filter((flow) => flow.role === 'VERIFIER');

  // Trust registry
  const issuers = listIssuers();
  const haipCompliant = issuers.filter((issuer) => issuer.haipCompliant).length;
  const avgScore = issuers.length > 0
    ? issuers.reduce((sum, issuer) => sum + (issuer.trustScore ?? 0), 0) / issuers.length
    : 0;

  // Federation
  const entities = listFederationEntities();
  const activeEntities = entities.filter((entity) => entity.trustVerified);

  // Controls
  const controls = getInheritedControls('SaaS');
  const health = validateControlHealth();

  // System readiness
  const readiness: MissionOpsOverview['systemReadiness'] =
    health.healthy && activeEntities.length > 0 ? 'OPERATIONAL'
    : health.healthy ? 'DEGRADED'
    : 'CRITICAL';

  return {
    issuerOnboarding: {
      total: issuerFlows.length,
      complete: issuerFlows.filter((flow) => flow.overallProgress === 100).length,
      inProgress: issuerFlows.filter((flow) => flow.overallProgress > 0 && flow.overallProgress < 100).length,
      blocked: issuerFlows.filter((flow) => flow.stages.some((stage) => stage.status === 'BLOCKED')).length,
    },
    verifierOnboarding: {
      total: verifierFlows.length,
      complete: verifierFlows.filter((flow) => flow.overallProgress === 100).length,
      inProgress: verifierFlows.filter((flow) => flow.overallProgress > 0 && flow.overallProgress < 100).length,
    },
    federationHealth: {
      totalPeers: entities.length,
      activePeers: activeEntities.length,
      degradedPeers: entities.length - activeEntities.length,
    },
    trustRegistryHealth: {
      totalIssuers: issuers.length,
      haipCompliant,
      averageTrustScore: Math.round(avgScore),
    },
    controlInheritanceStatus: {
      totalControls: controls.totalControls,
      inherited: controls.inherited,
      healthy: health.healthy,
    },
    systemReadiness: readiness,
    computedAt: new Date().toISOString(),
  };
}
