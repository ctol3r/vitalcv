/**
 * onboardingFlows.ts — Wave 123: Mission Ops + Conversion Engine
 *
 * Tracks onboarding state for issuers, verifiers, and partners.
 * Each flow has defined stages with completion tracking.
 *
 * This is the healthcare-specific equivalent of Mission Manager —
 * tracking deployment readiness across the trust substrate.
 */

import { log } from '../../obs/logger';
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
  { id: 'activate', name: 'Production Activation',  description: 'Activate production issuance with monitoring' },
  { id: 'monitor',  name: 'Trust Monitoring',       description: 'Continuous trust score and revocation monitoring' },
];

const VERIFIER_STAGES: Omit<OnboardingStage, 'status'>[] = [
  { id: 'sdk',      name: 'SDK Integration',       description: 'Install and configure @vitalcv/verifier-sdk' },
  { id: 'api-key',  name: 'API Key Provisioning',  description: 'Generate API key with appropriate tier' },
  { id: 'webhook',  name: 'Webhook Configuration',  description: 'Set up credential verification webhooks' },
  { id: 'test',     name: 'Test Verification',      description: 'Verify test credentials in sandbox' },
  { id: 'fhir',     name: 'FHIR Integration',       description: 'Configure FHIR R4 export (optional)' },
  { id: 'go-live',  name: 'Production Go-Live',     description: 'Enable production verification with monitoring' },
];

const PARTNER_STAGES: Omit<OnboardingStage, 'status'>[] = [
  { id: 'register',  name: 'Network Registration',   description: 'Register as federated network peer' },
  { id: 'metadata',  name: 'Metadata Exchange',       description: 'Exchange federation metadata and trust anchors' },
  { id: 'validate',  name: 'Trust Chain Validation',  description: 'Validate mutual trust chains' },
  { id: 'interop',   name: 'Interoperability Test',   description: 'Cross-network credential verification test' },
  { id: 'activate',  name: 'Federation Activation',   description: 'Activate bidirectional federation' },
];

// ── In-Memory Store ───────────────────────────────────────────────────

const onboardingFlows = new Map<string, OnboardingFlow>();

function computeProgress(stages: OnboardingStage[]): number {
  const complete = stages.filter((s) => s.status === 'COMPLETE').length;
  return Math.round((complete / stages.length) * 100);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create or get an onboarding flow for an entity.
 */
export function getOrCreateOnboardingFlow(
  role: OnboardingRole,
  entityId: string,
  entityName: string
): OnboardingFlow {
  const key = `${role}:${entityId}`;

  if (onboardingFlows.has(key)) {
    return onboardingFlows.get(key)!;
  }

  const templates = role === 'ISSUER' ? ISSUER_STAGES
    : role === 'VERIFIER' ? VERIFIER_STAGES
    : PARTNER_STAGES;

  const flow: OnboardingFlow = {
    role,
    entityId,
    entityName,
    stages: templates.map((t) => ({ ...t, status: 'PENDING' as StageStatus })),
    overallProgress: 0,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  onboardingFlows.set(key, flow);
  log('info', `mission_ops: created ${role} onboarding flow`, { entityId, entityName });
  return flow;
}

/**
 * Update a stage status in an onboarding flow.
 */
export function updateOnboardingStage(
  role: OnboardingRole,
  entityId: string,
  stageId: string,
  status: StageStatus,
  blockedReason?: string
): OnboardingFlow | null {
  const key = `${role}:${entityId}`;
  const flow = onboardingFlows.get(key);
  if (!flow) return null;

  const stage = flow.stages.find((s) => s.id === stageId);
  if (!stage) return null;

  stage.status = status;
  stage.completedAt = status === 'COMPLETE' ? new Date().toISOString() : undefined;
  stage.blockedReason = status === 'BLOCKED' ? blockedReason : undefined;
  flow.overallProgress = computeProgress(flow.stages);
  flow.lastUpdated = new Date().toISOString();

  log('info', `mission_ops: updated stage ${stageId} → ${status}`, { role, entityId });
  return flow;
}

/**
 * List all onboarding flows, optionally filtered by role.
 */
export function listOnboardingFlows(role?: OnboardingRole): OnboardingFlow[] {
  const all = [...onboardingFlows.values()];
  return role ? all.filter((f) => f.role === role) : all;
}

/**
 * Compute the full Mission Ops overview from live system state.
 */
export function computeMissionOpsOverview(): MissionOpsOverview {
  const flows = [...onboardingFlows.values()];
  const issuerFlows = flows.filter((f) => f.role === 'ISSUER');
  const verifierFlows = flows.filter((f) => f.role === 'VERIFIER');

  // Trust registry
  const issuers = listIssuers();
  const haipCompliant = issuers.filter((i) => (i as { haipCompliant?: boolean }).haipCompliant).length;
  const avgScore = issuers.length > 0
    ? issuers.reduce((sum, i) => sum + ((i as { trustScore?: number }).trustScore ?? 0), 0) / issuers.length
    : 0;

  // Federation
  const entities = listFederationEntities();
  const activeEntities = entities.filter((e) => (e as { status?: string }).status === 'active');

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
      complete: issuerFlows.filter((f) => f.overallProgress === 100).length,
      inProgress: issuerFlows.filter((f) => f.overallProgress > 0 && f.overallProgress < 100).length,
      blocked: issuerFlows.filter((f) => f.stages.some((s) => s.status === 'BLOCKED')).length,
    },
    verifierOnboarding: {
      total: verifierFlows.length,
      complete: verifierFlows.filter((f) => f.overallProgress === 100).length,
      inProgress: verifierFlows.filter((f) => f.overallProgress > 0 && f.overallProgress < 100).length,
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
