/**
 * B160A-RISK-007: Risk event audit logging (RISK_EVAL, RISK_BLOCK, RISK_ALLOW)
 *
 * Records risk decisions w/{deviceId, ipHash, score, route, decision}.
 * Anchored; tests ensure event structure + anonymized IP.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export type RiskDecision = 'RISK_EVAL' | 'RISK_BLOCK' | 'RISK_ALLOW';

export interface RiskEventData {
  deviceId: string;
  ipHash: string; // SHA-256 hash of IP (anonymized)
  score: number;
  route: string;
  decision: RiskDecision;
  reasonTags?: string[];
  threshold?: number;
  metadata?: Record<string, any>;
}

/**
 * Record a risk evaluation event
 */
export async function recordRiskEvent(event: RiskEventData): Promise<string> {
  // Create hash for anchoring
  const eventData = {
    deviceId: event.deviceId,
    ipHash: event.ipHash,
    score: event.score,
    route: event.route,
    decision: event.decision,
    reasonTags: event.reasonTags || [],
    timestamp: new Date().toISOString(),
  };

  const anchoredHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(eventData))
    .digest('hex');

  // Create audit event
  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: event.decision,
      data: {
        ...eventData,
        threshold: event.threshold,
        metadata: event.metadata,
        anchoredHash,
      },
    },
  });

  // In production, anchor hash to blockchain
  // For now, we'll simulate it
  const anchoredTx = await simulateBlockchainAnchor(anchoredHash);

  // Update audit event with transaction hash
  await prisma.auditEvent.update({
    where: { id: auditEvent.id },
    data: {
      data: {
        ...(auditEvent.data as any),
        anchoredTx,
      },
    },
  });

  return auditEvent.id;
}

/**
 * Simulate blockchain anchor (replace with actual blockchain service)
 */
async function simulateBlockchainAnchor(hash: string): Promise<string> {
  // In production, this would call the blockchain service
  // For now, return a simulated transaction hash
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Get risk events for a device
 */
export async function getRiskEventsForDevice(
  deviceId: string,
  limit: number = 100
) {
  return prisma.auditEvent.findMany({
    where: {
      type: {
        in: ['RISK_EVAL', 'RISK_BLOCK', 'RISK_ALLOW'],
      },
      data: {
        path: ['deviceId'],
        equals: deviceId,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get risk events for an IP hash
 */
export async function getRiskEventsForIp(
  ipHash: string,
  limit: number = 100
) {
  return prisma.auditEvent.findMany({
    where: {
      type: {
        in: ['RISK_EVAL', 'RISK_BLOCK', 'RISK_ALLOW'],
      },
      data: {
        path: ['ipHash'],
        equals: ipHash,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Export risk events for compliance/reporting
 */
export async function exportRiskEvents(options?: {
  deviceId?: string;
  ipHash?: string;
  decision?: RiskDecision;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const where: any = {
    type: {
      in: ['RISK_EVAL', 'RISK_BLOCK', 'RISK_ALLOW'],
    },
  };

  if (options?.deviceId) {
    where.data = {
      path: ['deviceId'],
      equals: options.deviceId,
    };
  }

  if (options?.ipHash) {
    where.data = {
      ...where.data,
      path: ['ipHash'],
      equals: options.ipHash,
    };
  }

  if (options?.decision) {
    where.type = options.decision;
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit || 1000,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    deviceId: (e.data as any)?.deviceId,
    ipHash: (e.data as any)?.ipHash,
    score: (e.data as any)?.score,
    route: (e.data as any)?.route,
    decision: (e.data as any)?.decision,
    reasonTags: (e.data as any)?.reasonTags || [],
    threshold: (e.data as any)?.threshold,
    anchoredHash: (e.data as any)?.anchoredHash,
    anchoredTx: (e.data as any)?.anchoredTx,
    timestamp: e.createdAt,
  }));
}

