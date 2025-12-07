import {
  NCIVerifiableProofType,
  PrismaClient,
  type NCIVerifiableProof,
} from '@prisma/client';
import { VerifiableProofRegistry } from '../../nci/verifiableProofRegistry';
import type { PassportEnvelope, PassportProof } from './types';

export interface ProofBinderDeps {
  prisma?: PrismaClient;
  registry?: VerifiableProofRegistry;
}

export class PassportProofBinder {
  private readonly prisma: PrismaClient;
  private readonly registry: VerifiableProofRegistry;

  constructor(deps: ProofBinderDeps = {}) {
    this.prisma = deps.prisma ?? new PrismaClient();
    this.registry = deps.registry ?? new VerifiableProofRegistry(this.prisma);
  }

  async bind(envelope: PassportEnvelope): Promise<PassportEnvelope> {
    if (!envelope.holder?.did) {
      return envelope;
    }

    const proofs = await this.registry.listProofs(envelope.holder.did);
    const normalized = proofs.map(mapProofRecord);

    return {
      ...envelope,
      proofs: normalized,
    };
  }

  async hasIssuanceProof(envelope: PassportEnvelope): Promise<boolean> {
    if (!envelope.holder?.did) {
      return false;
    }

    return this.registry.hasProof(
      envelope.holder.did,
      NCIVerifiableProofType.ISSUANCE,
      {
        passportId: envelope.passportId,
        bundleHash: envelope.bundleHash,
      },
    );
  }
}

function mapProofRecord(record: NCIVerifiableProof): PassportProof {
  return {
    proofId: record.id,
    proofType: record.proofType,
    anchorId: record.anchorTxHash,
    eventType: record.eventType,
    recordedAt: record.createdAt.toISOString(),
    metadata: record.metadata as Record<string, unknown> | null,
  };
}

