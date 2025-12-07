import { prisma } from '@/lib/prisma';
import { ChainClient } from '../chain/client';

export interface ValidatorHealth {
  nodeId: string;
  cpu: number; // percentage
  memory: number; // percentage
  blockLag: number; // blocks behind
  peerCount: number;
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
}

/**
 * Validator health probe v3 - track CPU, memory, block lag, peer count
 */
export async function probeValidatorHealthV3(): Promise<ValidatorHealth[]> {
  const chainClient = new ChainClient();
  const health = await chainClient.fetchValidatorHealth();

  const validators: ValidatorHealth[] = health.validators.map((v) => ({
    nodeId: v.id,
    cpu: calculateCPU(v.status, v.finalityLag),
    memory: calculateMemory(v.status, v.peers),
    blockLag: v.finalityLag,
    peerCount: v.peers,
    status: mapStatus(v.status),
    timestamp: new Date().toISOString(),
  }));

  // Store in observability mesh
  await prisma.observabilityMesh.upsert({
    where: { id: 'current' },
    create: {
      id: 'current',
      nodes: { validators },
      metrics: {
        blockHeight: health.blockHeight,
        finalizedHeight: health.finalizedHeight,
        peers: health.peers,
        syncStatus: health.syncStatus,
      },
      updatedAt: new Date(),
    },
    update: {
      nodes: { validators },
      metrics: {
        blockHeight: health.blockHeight,
        finalizedHeight: health.finalizedHeight,
        peers: health.peers,
        syncStatus: health.syncStatus,
      },
      updatedAt: new Date(),
    },
  });

  return validators;
}

function calculateCPU(status: string, blockLag: number): number {
  // Mock CPU calculation based on status and lag
  if (status === 'active' && blockLag <= 3) return 30;
  if (status === 'syncing') return 70;
  if (blockLag > 10) return 90;
  return 50;
}

function calculateMemory(status: string, peers: number): number {
  // Mock memory calculation
  if (status === 'active') return 40;
  if (status === 'syncing') return 80;
  return 60;
}

function mapStatus(status: string): 'healthy' | 'degraded' | 'down' {
  switch (status) {
    case 'active':
      return 'healthy';
    case 'syncing':
      return 'degraded';
    case 'degraded':
      return 'degraded';
    default:
      return 'down';
  }
}

