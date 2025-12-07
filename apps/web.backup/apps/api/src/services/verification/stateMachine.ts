import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface VerificationState {
  currentState: string;
  proofType: 'VC' | 'SD-JWT' | 'BBS+' | 'EUDI';
  chainHealth: 'healthy' | 'degraded' | 'unhealthy';
  verifierPrivilege: string;
  transitions: Array<{
    from: string;
    to: string;
    timestamp: string;
    reason: string;
  }>;
  fallbackPath?: string;
  optimizedPath?: string[];
}

/**
 * Task 363.2 — Proof-type-aware state transitions
 * Transitions vary for VC, SD-JWT, BBS+, EUDI
 */
export function getStateTransitions(
  proofType: 'VC' | 'SD-JWT' | 'BBS+' | 'EUDI',
  currentState: string,
): string[] {
  const transitions: Record<string, Record<string, string[]>> = {
    VC: {
      init: ['validate_schema', 'check_issuer'],
      validate_schema: ['check_signature', 'check_revocation'],
      check_signature: ['check_revocation', 'verify_claims'],
      check_revocation: ['verify_claims'],
      verify_claims: ['complete', 'fallback'],
      complete: [],
      fallback: ['cached_anchor'],
    },
    'SD-JWT': {
      init: ['parse_disclosures', 'validate_structure'],
      parse_disclosures: ['verify_binding', 'check_issuer'],
      verify_binding: ['check_revocation'],
      validate_structure: ['verify_binding'],
      check_revocation: ['complete'],
      complete: [],
    },
    'BBS+': {
      init: ['verify_proof', 'check_issuer'],
      verify_proof: ['selective_disclosure', 'check_revocation'],
      selective_disclosure: ['check_revocation'],
      check_revocation: ['complete'],
      complete: [],
    },
    EUDI: {
      init: ['validate_format', 'check_eu_signature'],
      validate_format: ['check_eu_signature', 'verify_claims'],
      check_eu_signature: ['verify_claims'],
      verify_claims: ['complete'],
      complete: [],
    },
  };

  return transitions[proofType]?.[currentState] || [];
}

/**
 * Task 363.3 — Chain-health-aware verification logic
 * Modify flow when chain lag spikes
 */
export async function checkChainHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  const recentMetrics = await prisma.chainMetrics.findMany({
    orderBy: { capturedAt: 'desc' },
    take: 10,
  });

  if (recentMetrics.length === 0) return 'healthy';

  const avgBlockTime = recentMetrics.reduce((sum, m) => sum + m.blockTimeMs, 0) / recentMetrics.length;
  const avgFinalityLag = recentMetrics.reduce((sum, m) => sum + m.finalityLag, 0) / recentMetrics.length;

  // Healthy: block time < 5s, finality < 30s
  if (avgBlockTime < 5000 && avgFinalityLag < 30000) return 'healthy';

  // Degraded: block time < 15s, finality < 60s
  if (avgBlockTime < 15000 && avgFinalityLag < 60000) return 'degraded';

  return 'unhealthy';
}

/**
 * Task 363.4 — Verifier-privilege-level routing
 * Route flows based on verifier role & PoU
 */
export function getPrivilegeLevel(verifierRole: string, proofOfUse: string): string {
  // Determine privilege level
  if (verifierRole === 'admin' || verifierRole === 'regulator') {
    return 'high';
  }
  if (verifierRole === 'issuer' && proofOfUse === 'credential_issuance') {
    return 'high';
  }
  if (verifierRole === 'employer' && proofOfUse === 'hiring') {
    return 'medium';
  }
  return 'low';
}

/**
 * Task 363.6 — Verification-fallback pathways
 * Fallback to cached anchors or alternate chains
 */
export function getFallbackPath(
  currentState: string,
  proofType: string,
  chainHealth: string,
): string | null {
  if (chainHealth === 'unhealthy') {
    return 'cached_anchor';
  }

  if (currentState === 'check_revocation' && chainHealth === 'degraded') {
    return 'cached_revocation_status';
  }

  return null;
}

/**
 * Task 363.7 — AI-driven verification optimizer
 * Predict fastest successful verification path
 */
export async function optimizeVerificationPath(
  proofType: 'VC' | 'SD-JWT' | 'BBS+' | 'EUDI',
  chainHealth: string,
  verifierPrivilege: string,
): Promise<string[]> {
  // Start with standard path
  let path = ['init'];

  // Adjust based on proof type
  if (proofType === 'SD-JWT') {
    path.push('parse_disclosures', 'verify_binding', 'check_revocation', 'complete');
  } else if (proofType === 'VC') {
    path.push('validate_schema', 'check_signature');

    // Skip revocation check if chain is unhealthy
    if (chainHealth !== 'unhealthy') {
      path.push('check_revocation');
    }

    path.push('verify_claims', 'complete');
  } else {
    path.push('verify_proof', 'check_revocation', 'complete');
  }

  // High privilege can skip some checks
  if (verifierPrivilege === 'high') {
    // Remove redundant checks for high privilege
    if (path.includes('validate_schema') && proofType === 'VC') {
      const index = path.indexOf('validate_schema');
      path.splice(index, 1);
    }
  }

  return path;
}

/**
 * Task 363.8 — State timeline analyzer
 * Track state transitions per verification session
 */
export async function trackStateTransition(
  sessionId: string,
  from: string,
  to: string,
  reason: string,
): Promise<void> {
  const machine = await prisma.verificationStateMachine.findUnique({
    where: { sessionId },
  });

  const state = machine?.state as VerificationState | null;
  const transitions = state?.transitions || [];

  transitions.push({
    from,
    to,
    timestamp: new Date().toISOString(),
    reason,
  });

  await prisma.verificationStateMachine.upsert({
    where: { sessionId },
    update: {
      state: {
        ...state,
        transitions,
        currentState: to,
      },
    },
    create: {
      sessionId,
      state: {
        currentState: to,
        proofType: 'VC',
        chainHealth: 'healthy',
        verifierPrivilege: 'medium',
        transitions,
      },
    },
  });
}

/**
 * Get verification state machine state
 */
export async function getVerificationState(
  sessionId: string,
): Promise<VerificationState> {
  const machine = await prisma.verificationStateMachine.findUnique({
    where: { sessionId },
  });

  if (machine) {
    return machine.state as VerificationState;
  }

  // Create initial state
  const chainHealth = await checkChainHealth();
  const state: VerificationState = {
    currentState: 'init',
    proofType: 'VC',
    chainHealth,
    verifierPrivilege: 'medium',
    transitions: [],
  };

  await prisma.verificationStateMachine.create({
    data: {
      sessionId,
      state,
    },
  });

  return state;
}

/**
 * Transition to next state
 */
export async function transitionState(
  sessionId: string,
  newState: string,
  reason: string = 'user_action',
): Promise<VerificationState> {
  const currentState = await getVerificationState(sessionId);

  await trackStateTransition(
    sessionId,
    currentState.currentState,
    newState,
    reason,
  );

  return getVerificationState(sessionId);
}

/**
 * Task 363.9 — Verification machine export pack
 * Audit-ready state machine logs
 */
export async function exportStateMachineLogs(
  sessionId: string,
): Promise<{
  state: VerificationState;
  timeline: Array<{ timestamp: string; state: string; reason: string }>;
  summary: string;
}> {
  const state = await getVerificationState(sessionId);

  const timeline = state.transitions.map(t => ({
    timestamp: t.timestamp,
    state: t.to,
    reason: t.reason,
  }));

  const summary = `Verification session ${sessionId}: ${state.transitions.length} transitions.
    Current state: ${state.currentState}.
    Proof type: ${state.proofType}.
    Chain health: ${state.chainHealth}.`;

  return {
    state,
    timeline,
    summary,
  };
}

/**
 * Task 363.10 — Anchor verification state machine snapshot
 */
export async function anchorStateMachineSnapshot(
  sessionId: string,
): Promise<string> {
  const state = await getVerificationState(sessionId);

  const receipt = await chainClient.submitAuditEvent({
    eventType: 'verificationStateMachineAnchored',
    correlationId: sessionId,
    tags: ['verification', 'state_machine', 'snapshot'],
    payload: {
      sessionId,
      currentState: state.currentState,
      proofType: state.proofType,
      transitionCount: state.transitions.length,
      anchoredAt: new Date().toISOString(),
    },
  });

  return receipt.txHash || receipt.eventId;
}

