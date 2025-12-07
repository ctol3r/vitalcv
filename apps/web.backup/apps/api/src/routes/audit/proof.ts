import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { Router, type Request, type Response } from 'express';

import { getBlockProof } from '../../services/chain/proofs';
import { groth16Prover, type EventLedgerProofEnvelope } from '../../services/zk/prover';
import { anchorZkAuditProof } from '../../services/audit/anchor';

const prisma = new PrismaClient();
const router = Router();
const CIRCUIT_TYPE = 'event-ledger.v1';

router.post('/audit/proof/:eventId', async (req: Request, res: Response) => {
  const eventId = req.params.eventId?.trim();
  if (!eventId) {
    return res.status(400).json({
      error: 'invalid_event_id',
      message: 'Provide an audit event id in the path parameter.',
    });
  }

  const force = parseBoolean(req.query.force ?? req.body?.force ?? false);

  try {
    if (!force) {
      const existing = await prisma.auditProof.findUnique({ where: { eventId } });
      if (existing) {
        return res.json(buildResponse(eventId, CIRCUIT_TYPE, existing.proof, existing.createdAt));
      }
    }

    const blockProof = await getBlockProof(eventId);
    if (!blockProof) {
      return res.status(404).json({
        error: 'block_proof_not_found',
        message: `No chain proof available for event ${eventId}`,
      });
    }

    const merklePath = coerceMerklePath(blockProof.merklePath);
    const proofEnvelope = await groth16Prover.prove({
      eventHashHex: blockProof.blockHash,
      merklePath,
    });

    const persisted = await prisma.auditProof.upsert({
      where: { eventId },
      update: {
        circuitType: CIRCUIT_TYPE,
        proof: serializeProof(proofEnvelope, blockProof),
      },
      create: {
        eventId,
        circuitType: CIRCUIT_TYPE,
        proof: serializeProof(proofEnvelope, blockProof),
      },
    });

    const proofHash = hashProofPayload(proofEnvelope);
    const anchor = anchorZkAuditProof({
      eventId,
      circuitType: CIRCUIT_TYPE,
      ledgerRoot: proofEnvelope.rootHex,
      proofCommitment: proofEnvelope.pathCommitmentHex,
      proofHash,
      metrics: proofEnvelope.metrics,
    });

    return res.json(
      buildResponse(eventId, CIRCUIT_TYPE, persisted.proof, persisted.createdAt, anchor),
    );
  } catch (error) {
    console.error('[audit][proof] failed', error);
    return res.status(500).json({
      error: 'audit_proof_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function coerceMerklePath(payload: unknown): string[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => (typeof entry === 'string' ? entry : null))
      .filter((entry): entry is string => Boolean(entry));
  }
  if (typeof payload === 'object' && 'path' in (payload as Record<string, unknown>)) {
    return coerceMerklePath((payload as Record<string, unknown>).path);
  }
  return [];
}

function serializeProof(
  envelope: EventLedgerProofEnvelope,
  blockProof: Awaited<ReturnType<typeof getBlockProof>>,
) {
  return {
    mode: envelope.metrics.mode,
    snark: envelope.proof,
    publicSignals: envelope.publicSignals,
    circuitInput: envelope.circuitInput,
    ledgerRoot: envelope.rootHex,
    pathCommitment: envelope.pathCommitmentHex,
    metrics: envelope.metrics,
    generatedAt: new Date().toISOString(),
    block: {
      blockHash: blockProof?.blockHash,
      palletName: blockProof?.palletName ?? 'audit.scrapbook',
      eventType: blockProof?.eventType ?? 'unknown',
      timestamp: blockProof?.timestamp,
      merklePath: blockProof?.merklePath,
    },
  };
}

function hashProofPayload(envelope: EventLedgerProofEnvelope): string {
  return createHash('sha256')
    .update(JSON.stringify({ proof: envelope.proof, signals: envelope.publicSignals }))
    .digest('hex');
}

function buildResponse(
  eventId: string,
  circuitType: string,
  proofPayload: any,
  createdAt: Date,
  anchor?: ReturnType<typeof anchorZkAuditProof>,
) {
  return {
    eventId,
    circuitType,
    issuedAt: createdAt,
    proof: proofPayload,
    anchor: anchor ?? null,
  };
}


