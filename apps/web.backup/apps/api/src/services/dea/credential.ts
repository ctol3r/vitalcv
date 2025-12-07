import { randomUUID } from 'crypto';
import type { Prisma, DEACredential } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { lookupDeaRegistry, type DEARecord } from './lookup';
import { validateMateTraining, type MateValidationResult } from './mate-validator';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface IssueDeaMateCredentialInput {
  clinicianId: string;
  deaNumber?: string;
  mateHours?: number;
  mateCategories?: string[];
}

export interface DeaMateStatusCredential {
  credentialId: string;
  type: ['VerifiableCredential', 'DEAMATEStatus'];
  issuer: string;
  issuedAt: string;
  expirationDate: string;
  credentialSubject: {
    clinicianId: string;
    deaNumber: string;
    prescriptiveAuthority: string;
    schedules: string[];
    mateHours: number;
    mateCompliant: boolean;
  };
  proof: {
    anchorTx: string;
    network: string;
  };
}

export interface IssueDeaMateCredentialResult {
  credential: DeaMateStatusCredential;
  record: DEACredential;
  registry: DEARecord;
  mate: MateValidationResult;
}

export async function issueDeaMateStatusCredential(
  input: IssueDeaMateCredentialInput,
): Promise<IssueDeaMateCredentialResult> {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required');
  }

  const currentCredential = await prisma.dEACredential.findFirst({
    where: { clinicianId: input.clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  const deaNumber = input.deaNumber ?? currentCredential?.deaNumber;
  if (!deaNumber) {
    throw new Error('deaNumber is required to refresh DEA credential');
  }

  const registry = await lookupDeaRegistry({
    clinicianId: input.clinicianId,
    deaNumber,
  });

  const mateHours = typeof input.mateHours === 'number' ? input.mateHours : currentCredential?.mateHours ?? 0;
  const mateCategories =
    input.mateCategories ??
    extractMateCategories(currentCredential?.metadata);

  const mate = validateMateTraining({
    totalHours: mateHours,
    categories: mateCategories,
  });

  const metadata = buildMetadata(registry, mateCategories);

  const record =
    currentCredential
      ? await prisma.dEACredential.update({
          where: { id: currentCredential.id },
          data: {
            deaNumber,
            expiration: new Date(registry.expirationDate),
            mateHours,
            metadata,
          },
        })
      : await prisma.dEACredential.create({
          data: {
            clinicianId: input.clinicianId,
            deaNumber,
            expiration: new Date(registry.expirationDate),
            mateHours,
            metadata,
          },
        });

  const credential = buildCredentialPayload({
    clinicianId: input.clinicianId,
    registry,
    mate,
  });

  const anchor = anchorEvent('deaMateCredentialIssued', {
    clinicianId: input.clinicianId,
    credentialId: credential.credentialId,
    deaNumber,
    mateCompliant: mate.mateCompliant,
    expiresAt: credential.expirationDate,
  });

  credential.proof.anchorTx = anchor.txHash;
  credential.proof.network = anchor.network;

  return {
    credential,
    record,
    registry,
    mate,
  };
}

function buildCredentialPayload(params: {
  clinicianId: string;
  registry: DEARecord;
  mate: MateValidationResult;
}): DeaMateStatusCredential {
  const credentialId = `urn:vc:dea-mate:${randomUUID()}`;
  const issuedAt = new Date().toISOString();

  return {
    credentialId,
    type: ['VerifiableCredential', 'DEAMATEStatus'],
    issuer: process.env.VC_ISSUER_DID ?? 'did:web:vitalcv.example',
    issuedAt,
    expirationDate: params.registry.expirationDate,
    credentialSubject: {
      clinicianId: params.clinicianId,
      deaNumber: params.registry.deaNumber,
      prescriptiveAuthority: params.registry.prescriptiveAuthority,
      schedules: params.registry.schedules,
      mateHours: params.mate.totalHours,
      mateCompliant: params.mate.mateCompliant,
    },
    proof: {
      anchorTx: '',
      network: '',
    },
  };
}

function extractMateCategories(metadata: Prisma.JsonValue | null | undefined): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const value = metadata as { mateCategories?: unknown };
  if (!Array.isArray(value.mateCategories)) {
    return [];
  }
  return value.mateCategories.filter((entry): entry is string => typeof entry === 'string');
}

function buildMetadata(registry: DEARecord, mateCategories: string[]): Prisma.JsonValue {
  return {
    source: registry.source,
    registrantName: registry.registrantName,
    registrantAddress: registry.registrantAddress,
    schedules: registry.schedules,
    lastVerifiedAt: registry.lastVerifiedAt,
    prescriptiveAuthority: registry.prescriptiveAuthority,
    mateCategories,
  };
}











