import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { PrismaClient, type AuditProof } from '@prisma/client';

import { groth16Prover, type EventLedgerProofEnvelope, type ProofMetrics } from '../../apps/api/src/services/zk/prover';
import { anchorZkAuditProof } from '../../apps/api/src/services/audit/anchor';

const prisma = new PrismaClient();
const STALE_HOURS = Number(process.env.ZK_PROOF_REFRESH_HOURS ?? 24);

export interface ProofValidationOptions {
  limit?: number;
  force?: boolean;
}

export interface ProofValidationResult {
  processed: number;
  refreshed: number;
  verified: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

export async function runAuditProofValidationJob(
  options: ProofValidationOptions = {},
): Promise<ProofValidationResult> {
  const startedAt = performance.now();
  const limit = Math.max(1, options.limit ?? Number(process.env.ZK_PROOF_REFRESH_BATCH ?? 25));

  const records = await prisma.auditProof.findMany({
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });

  const result: ProofValidationResult = {
    processed: records.length,
    refreshed: 0,
    verified: 0,
    failed: 0,
    durationMs: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const storedProof = coerceProof(record.proof);
      const shouldForce = options.force ?? false;
      const isStale = isProofStale(storedProof.generatedAt);
      const verifySucceeded =
        storedProof.mode === 'snark' &&
        storedProof.publicSignals?.length &&
        storedProof.snark
          ? await groth16Prover.verifyProof(storedProof.publicSignals, storedProof.snark)
          : false;

      if (verifySucceeded && !isStale && !shouldForce) {
        result.verified += 1;
        continue;
      }

      if (!storedProof.block?.blockHash) {
        result.failed += 1;
        result.errors.push(`Missing block hash for ${record.eventId}`);
        continue;
      }

      const envelope = await groth16Prover.prove({
        eventHashHex: storedProof.block.blockHash,
        merklePath: storedProof.block.merklePath ?? [],
        depth: storedProof.metrics?.depth,
      });

      await prisma.auditProof.update({
        where: { id: record.id },
        data: {
          proof: serializeEnvelope(envelope, storedProof.block),
        },
      });

      anchorZkAuditProof({
        eventId: record.eventId,
        circuitType: record.circuitType,
        ledgerRoot: envelope.rootHex,
        proofCommitment: envelope.pathCommitmentHex,
        proofHash: hashProofDigest(envelope),
        metrics: envelope.metrics,
      });

      result.refreshed += 1;
    } catch (error) {
      console.warn('[audit][proof-validation] failed for', record.eventId, error);
      result.failed += 1;
      result.errors.push(
        `${record.eventId}: ${error instanceof Error ? error.message : 'Unexpected error during proof refresh'}`,
      );
    }
  }

  result.durationMs = Math.round(performance.now() - startedAt);
  return result;
}

type StoredProofPayload = {
  mode: 'snark' | 'mock';
  snark?: Record<string, unknown>;
  publicSignals?: string[];
  circuitInput?: EventLedgerProofEnvelope['circuitInput'];
  ledgerRoot?: string;
  pathCommitment?: string;
  metrics: ProofMetrics;
  generatedAt?: string;
  block?: {
    blockHash: string;
    merklePath?: string[];
    palletName?: string | null;
    eventType?: string | null;
    timestamp?: string;
  };
};

function coerceProof(payload: AuditProof['proof']): StoredProofPayload {
  if (payload && typeof payload === 'object') {
    return payload as StoredProofPayload;
  }
  return {
    mode: 'mock',
    metrics: {
      mode: 'mock',
      provingTimeMs: 0,
      circuitSize: 0,
      constraintCount: 0,
      depth: 0,
    },
  };
}

function isProofStale(timestamp?: string): boolean {
  if (!timestamp) return true;
  const ageHours = (Date.now() - new Date(timestamp).getTime()) / 1000 / 60 / 60;
  return ageHours >= STALE_HOURS;
}

function serializeEnvelope(
  envelope: EventLedgerProofEnvelope,
  block: StoredProofPayload['block'],
): StoredProofPayload {
  return {
    mode: envelope.metrics.mode,
    snark: envelope.proof,
    publicSignals: envelope.publicSignals,
    circuitInput: envelope.circuitInput,
    ledgerRoot: envelope.rootHex,
    pathCommitment: envelope.pathCommitmentHex,
    metrics: envelope.metrics,
    generatedAt: new Date().toISOString(),
    block,
  };
}

function hashProofDigest(envelope: EventLedgerProofEnvelope): string {
  return createHash('sha256')
    .update(JSON.stringify({ proof: envelope.proof, signals: envelope.publicSignals }))
    .digest('hex');
}


