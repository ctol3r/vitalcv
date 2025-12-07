import { randomUUID, createHash } from 'crypto';
import { PrismaClient, Prisma, WalletCredential } from '@prisma/client';
import { PrismaClient as DefaultClient } from '@prisma/client';
import { LifecycleEvidencePackBuilder, type LifecycleEvidencePackResult } from './evidence-pack';
import { anchorEvent } from '../audit/anchor';

const prisma = new DefaultClient();

export interface RetirementWorkflowOptions {
  retirementDate?: Date;
  prisma?: PrismaClient;
}

export interface RetirementWorkflowResult {
  clinicianId: string;
  retiredAt: string;
  archivedCredentials: number;
  retirementLetter: WalletCredential;
  evidencePack: LifecycleEvidencePackResult;
}

export class RetirementWorkflow {
  private readonly packBuilder: LifecycleEvidencePackBuilder;

  constructor(private readonly db: PrismaClient = prisma, packBuilder?: LifecycleEvidencePackBuilder) {
    this.packBuilder = packBuilder ?? new LifecycleEvidencePackBuilder(db);
  }

  async run(clinicianId: string, options: RetirementWorkflowOptions = {}): Promise<RetirementWorkflowResult> {
    if (!clinicianId) {
      throw new Error('clinicianId is required for retirement workflow');
    }
    const retiredAt = (options.retirementDate ?? new Date()).toISOString();
    const client = options.prisma ?? this.db;

    const evidencePack = await this.packBuilder.build(clinicianId, 'lifecycle-retirement', {
      now: new Date(retiredAt),
      prisma: client,
    });

    const archivedCount = await this.archiveWalletCredentials(clinicianId, retiredAt, evidencePack.payload.packId, client);
    const retirementLetter = await this.issueRetirementLetter(clinicianId, retiredAt, evidencePack.payload.packId, client);

    anchorEvent('retirementWorkflowCompleted', {
      clinicianId,
      retiredAt,
      archivedCredentials: archivedCount,
      retirementCredentialId: retirementLetter.credentialId,
      evidencePackId: evidencePack.payload.packId,
    });

    return {
      clinicianId,
      retiredAt,
      archivedCredentials: archivedCount,
      retirementLetter,
      evidencePack,
    };
  }

  private async archiveWalletCredentials(
    clinicianId: string,
    retiredAt: string,
    packId: string,
    client: PrismaClient,
  ): Promise<number> {
    const credentials = await client.walletCredential.findMany({
      where: { clinicianId },
      orderBy: { issuedAt: 'desc' },
      take: 250,
    });

    let archived = 0;
    for (const credential of credentials) {
      if (credential.revokedAt) {
        continue;
      }
      const payload = mergePayload(credential.payload, {
        retiredAt,
        retiredVia: 'provider_lifecycle',
        lifecyclePackId: packId,
      });
      await client.walletCredential.update({
        where: { credentialId: credential.credentialId },
        data: {
          revokedAt: new Date(retiredAt),
          payload: payload as Prisma.JsonValue,
        },
      });
      archived += 1;
    }
    return archived;
  }

  private async issueRetirementLetter(
    clinicianId: string,
    retiredAt: string,
    packId: string,
    client: PrismaClient,
  ): Promise<WalletCredential> {
    const credentialId = `retirement-${randomUUID()}`;
    const payload = {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://vitalcv.health/credentials/provider-lifecycle'],
      type: ['VerifiableCredential', 'RetirementLetterCredential'],
      issuer: process.env.VC_ISSUER_DID ?? 'did:web:vitalcv.health',
      issuanceDate: retiredAt,
      credentialSubject: {
        id: clinicianId,
        lifecyclePhase: 'retired',
        retirementDate: retiredAt,
        evidencePackId: packId,
      },
      proof: {
        type: 'DataIntegrityProof',
        created: retiredAt,
        proofPurpose: 'assertionMethod',
        verificationMethod: `${process.env.VC_ISSUER_DID ?? 'did:web:vitalcv.health'}#retirement`,
        proofValue: createHash('sha256')
          .update(`${clinicianId}:${retiredAt}:${packId}`)
          .digest('hex'),
      },
    };

    return client.walletCredential.create({
      data: {
        credentialId,
        clinicianId,
        type: 'RetirementLetterV1',
        payload,
        issuedAt: new Date(retiredAt),
      },
    });
  }
}

function mergePayload(payload: Prisma.JsonValue | null, patch: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ...patch };
  }
  return {
    ...(payload as Record<string, unknown>),
    ...patch,
  };
}


