import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

/**
 * Batch 221 — Credential Exchange Orchestration v4
 * High-speed pipeline for requesting, issuing, updating, revoking, and validating VCs
 */

export interface VCExchangeRequest {
  requestId: string;
  holderId: string;
  issuerId: string;
  credentialType: string;
  metadata?: Record<string, unknown>;
}

export interface VCExchangeSession {
  sessionId: string;
  participants: Array<{ role: 'issuer' | 'verifier' | 'holder'; id: string }>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  exchangeData: Record<string, unknown>;
}

/**
 * Orchestrate VC exchange request through correct issuer → agency → chain
 */
export async function orchestrateExchangeRequest(
  request: VCExchangeRequest,
): Promise<{
  exchangeId: string;
  route: Array<{ step: string; entityId: string }>;
  status: string;
}> {
  // Determine routing based on credential type and issuer
  const route: Array<{ step: string; entityId: string }> = [
    { step: 'issuer', entityId: request.issuerId },
    { step: 'agency', entityId: 'default_agency' }, // Would be determined by business logic
    { step: 'chain', entityId: 'pilot-l2' },
  ];

  // Create exchange record
  const exchange = await prisma.vCExchange.create({
    data: {
      exchange: {
        requestId: request.requestId,
        holderId: request.holderId,
        issuerId: request.issuerId,
        credentialType: request.credentialType,
        route,
        status: 'pending',
        metadata: request.metadata || {},
      } as any,
      orgId: request.issuerId,
      updatedAt: new Date(),
    },
  });

  return {
    exchangeId: exchange.id,
    route,
    status: 'pending',
  };
}

/**
 * Manage multi-party VC session (issuer + verifier + holder)
 */
export async function createMultiPartySession(
  holderId: string,
  issuerId: string,
  verifierId?: string,
): Promise<VCExchangeSession> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const participants: Array<{ role: 'issuer' | 'verifier' | 'holder'; id: string }> = [
    { role: 'holder', id: holderId },
    { role: 'issuer', id: issuerId },
  ];

  if (verifierId) {
    participants.push({ role: 'verifier', id: verifierId });
  }

  const session: VCExchangeSession = {
    sessionId,
    participants,
    status: 'pending',
    exchangeData: {
      createdAt: new Date().toISOString(),
      holderId,
      issuerId,
      verifierId: verifierId || null,
    },
  };

  // Store session (would use a session store in production)
  await prisma.vCExchange.create({
    data: {
      exchange: session as any,
      orgId: issuerId,
      updatedAt: new Date(),
    },
  });

  return session;
}

/**
 * Synchronize revocation status across chain + caches
 */
export async function synchronizeRevocation(
  credentialId: string,
  revoked: boolean,
): Promise<{
  synced: boolean;
  chainStatus: string;
  cacheStatus: string;
}> {
  // Update chain status (would call actual chain in production)
  const chainStatus = revoked ? 'revoked' : 'active';

  // Update cache (would use Redis or similar in production)
  const cacheStatus = 'updated';

  // Update exchange records
  await prisma.vCExchange.updateMany({
    where: {
      exchange: {
        path: ['credentialId'],
        equals: credentialId,
      } as any,
    },
    data: {
      exchange: {
        revocationStatus: revoked ? 'revoked' : 'active',
        revokedAt: revoked ? new Date().toISOString() : null,
      } as any,
      updatedAt: new Date(),
    },
  });

  return {
    synced: true,
    chainStatus,
    cacheStatus,
  };
}

/**
 * Inspect in-flight VC exchanges
 */
export async function inspectExchangeQueue(filters?: {
  orgId?: string;
  status?: string;
  limit?: number;
}): Promise<Array<{
  exchangeId: string;
  status: string;
  participants: string[];
  createdAt: string;
}>> {
  const where: any = {};

  if (filters?.orgId) {
    where.orgId = filters.orgId;
  }

  if (filters?.status) {
    where.exchange = {
      path: ['status'],
      equals: filters.status,
    };
  }

  const exchanges = await prisma.vCExchange.findMany({
    where,
    take: filters?.limit || 100,
    orderBy: { updatedAt: 'desc' },
  });

  return exchanges.map((ex) => ({
    exchangeId: ex.id,
    status: (ex.exchange as any)?.status || 'unknown',
    participants: (ex.exchange as any)?.participants?.map((p: any) => p.id) || [],
    createdAt: ex.updatedAt.toISOString(),
  }));
}

/**
 * Auto-route proofs based on trust + region
 */
export function routeVCByPolicy(
  credentialType: string,
  holderRegion: string,
  trustScore: number,
): {
  issuerId: string;
  route: string[];
  rationale: string[];
} {
  const rationale: string[] = [];

  // High trust → direct route
  if (trustScore >= 0.8) {
    rationale.push('high_trust_direct_route');
    return {
      issuerId: 'primary_issuer',
      route: ['issuer', 'chain'],
      rationale,
    };
  }

  // Medium trust → agency verification
  if (trustScore >= 0.5) {
    rationale.push('medium_trust_agency_verification');
    return {
      issuerId: 'primary_issuer',
      route: ['issuer', 'agency', 'chain'],
      rationale,
    };
  }

  // Low trust → full verification chain
  rationale.push('low_trust_full_verification');
  return {
    issuerId: 'primary_issuer',
    route: ['issuer', 'agency', 'verifier', 'chain'],
    rationale,
  };
}

/**
 * Auto-request refreshed credential when expired
 */
export async function handleExpiredVCRefresh(
  credentialId: string,
  holderId: string,
): Promise<{
  refreshRequestId: string;
  status: string;
}> {
  // Check if credential is expired
  const credential = await prisma.walletCredential.findUnique({
    where: { credentialId },
  });

  if (!credential) {
    throw new Error(`Credential ${credentialId} not found`);
  }

  const now = new Date();
  const issuedAt = credential.issuedAt;

  // Assume 1 year validity (would check actual expiry)
  const expiryDate = new Date(issuedAt);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  if (now < expiryDate) {
    return {
      refreshRequestId: 'not_needed',
      status: 'not_expired',
    };
  }

  // Create refresh request
  const refreshRequestId = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await prisma.vCExchange.create({
    data: {
      exchange: {
        type: 'refresh',
        credentialId,
        holderId,
        refreshRequestId,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      } as any,
      orgId: holderId,
      updatedAt: new Date(),
    },
  });

  return {
    refreshRequestId,
    status: 'pending',
  };
}

/**
 * Recover partially completed VC flows
 */
export async function recoverInterruptedExchange(
  exchangeId: string,
): Promise<{
  recovered: boolean;
  currentStep: string;
  nextActions: string[];
}> {
  const exchange = await prisma.vCExchange.findUnique({
    where: { id: exchangeId },
  });

  if (!exchange) {
    throw new Error(`Exchange ${exchangeId} not found`);
  }

  const exchangeData = exchange.exchange as any;
  const status = exchangeData?.status || 'unknown';

  if (status === 'completed') {
    return {
      recovered: false,
      currentStep: 'completed',
      nextActions: [],
    };
  }

  // Determine recovery actions based on last known state
  const nextActions: string[] = [];

  if (status === 'pending') {
    nextActions.push('resume_issuance');
  } else if (status === 'in_progress') {
    nextActions.push('verify_current_state', 'continue_exchange');
  } else if (status === 'failed') {
    nextActions.push('retry_exchange', 'contact_support');
  }

  // Update exchange status
  await prisma.vCExchange.update({
    where: { id: exchangeId },
    data: {
      exchange: {
        ...exchangeData,
        status: 'in_progress',
        recoveredAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  return {
    recovered: true,
    currentStep: status,
    nextActions,
  };
}

/**
 * Anchor VC exchange record
 */
export async function anchorVCExchange(exchangeId: string): Promise<void> {
  const exchange = await prisma.vCExchange.findUnique({
    where: { id: exchangeId },
  });

  if (!exchange) {
    throw new Error(`Exchange ${exchangeId} not found`);
  }

  const exchangeHash = createHash('sha256').update(JSON.stringify(exchange.exchange)).digest('hex');

  anchorEvent('vcExchangeAnchored', {
    exchangeId,
    orgId: exchange.orgId,
    exchangeHash,
    timestamp: new Date().toISOString(),
  });
}








