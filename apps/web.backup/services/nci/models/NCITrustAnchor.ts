import {
  AccreditationStatus,
  NCITrustAnchor as NCITrustAnchorRecord,
  PrismaClient,
  TrustEntityType,
} from '@prisma/client';
import { createPublicKey, verify as verifySignature } from 'crypto';

const prisma = new PrismaClient();

export interface RegisterTrustAnchorInput {
  entityId: string;
  entityType: TrustEntityType;
  publicKey: string;
  certificateChain?: unknown;
  accreditation?: AccreditationStatus;
  jurisdiction?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
}

export interface AnchorAttestation {
  message: string | Record<string, unknown>;
  signature: string;
  algorithm?: 'ed25519' | 'rsa-sha256';
}

export interface VerifyAnchorOptions {
  entityId: string;
  attestation: AnchorAttestation;
  expectedDid?: string;
}

const ACTIVE_ACCREDITATIONS: AccreditationStatus[] = [
  AccreditationStatus.ACCREDITED,
  AccreditationStatus.PROBATION,
  AccreditationStatus.UNKNOWN,
];

export class NCITrustAnchorService {
  constructor(private readonly client: PrismaClient = prisma) {}

  async registerAnchor(input: RegisterTrustAnchorInput): Promise<NCITrustAnchorRecord> {
    if (!input.entityId?.trim()) {
      throw new Error('entityId is required for trust anchor registration');
    }

    return this.client.nCITrustAnchor.upsert({
      where: { entityId: input.entityId },
      update: {
        entityType: input.entityType,
        publicKey: input.publicKey,
        certificateChain: input.certificateChain ?? null,
        accreditation: input.accreditation ?? AccreditationStatus.UNKNOWN,
        jurisdiction: input.jurisdiction ?? null,
        metadata: input.metadata ?? null,
        isActive: input.isActive ?? true,
      },
      create: {
        entityId: input.entityId,
        entityType: input.entityType,
        publicKey: input.publicKey,
        certificateChain: input.certificateChain ?? null,
        accreditation: input.accreditation ?? AccreditationStatus.UNKNOWN,
        jurisdiction: input.jurisdiction ?? null,
        metadata: input.metadata ?? null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async getAnchor(entityId: string): Promise<NCITrustAnchorRecord | null> {
    return this.client.nCITrustAnchor.findUnique({ where: { entityId } });
  }

  async assertAnchorIsTrusted(entityId: string): Promise<NCITrustAnchorRecord> {
    const anchor = await this.getAnchor(entityId);
    if (!anchor) {
      throw new Error(`Trust anchor ${entityId} was not found`);
    }
    if (!anchor.isActive) {
      throw new Error(`Trust anchor ${entityId} is inactive`);
    }
    if (!ACTIVE_ACCREDITATIONS.includes(anchor.accreditation)) {
      throw new Error(`Trust anchor ${entityId} is not in good standing`);
    }
    return anchor;
  }

  async verifyAttestation(options: VerifyAnchorOptions): Promise<boolean> {
    const anchor = await this.assertAnchorIsTrusted(options.entityId);
    const messageBuffer = serializeAttestationPayload(options.attestation.message, options.expectedDid);
    const signatureBuffer = decodeSignature(options.attestation.signature);

    const algorithm = options.attestation.algorithm ?? 'ed25519';
    if (algorithm !== 'ed25519') {
      throw new Error(`Unsupported trust anchor algorithm: ${algorithm}`);
    }

    return verifySignature(null, messageBuffer, createPublicKey(anchor.publicKey), signatureBuffer);
  }
}

function serializeAttestationPayload(
  payload: string | Record<string, unknown>,
  expectedDid?: string
): Buffer {
  if (typeof payload === 'string') {
    assertDidMatch(payload, expectedDid);
    return Buffer.from(payload);
  }

  const did = typeof payload.did === 'string' ? payload.did : undefined;
  assertDidMatch(did, expectedDid);

  const normalized = {
    ...payload,
    did,
  };
  return Buffer.from(JSON.stringify(normalized));
}

function assertDidMatch(actual: string | undefined, expected?: string): void {
  if (!expected) {
    return;
  }
  if (!actual) {
    throw new Error('Attestation payload did not include a DID');
  }
  if (actual !== expected) {
    throw new Error(`Attestation DID mismatch: expected ${expected}, received ${actual}`);
  }
}

function decodeSignature(signature: string): Buffer {
  if (signature.startsWith('0x')) {
    return Buffer.from(signature.slice(2), 'hex');
  }
  return Buffer.from(signature, 'base64');
}
import {
  AccreditationStatus,
  NCITrustAnchor as NCITrustAnchorRecord,
  PrismaClient,
  TrustEntityType,
} from '@prisma/client';
import { createPublicKey, verify as verifySignature } from 'crypto';

const prisma = new PrismaClient();

export interface RegisterTrustAnchorInput {
  entityId: string;
  entityType: TrustEntityType;
  publicKey: string;
  certificateChain?: unknown;
  accreditation?: AccreditationStatus;
  jurisdiction?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
}

export interface AnchorAttestation {
  message: string | Record<string, unknown>;
  signature: string;
  algorithm?: 'ed25519' | 'rsa-sha256';
}

export interface VerifyAnchorOptions {
  entityId: string;
  attestation: AnchorAttestation;
  expectedDid?: string;
}

const ACTIVE_ACCREDITATIONS: AccreditationStatus[] = [
  AccreditationStatus.ACCREDITED,
  AccreditationStatus.PROBATION,
  AccreditationStatus.UNKNOWN,
];

export class NCITrustAnchorService {
  constructor(private readonly client: PrismaClient = prisma) {}

  async registerAnchor(input: RegisterTrustAnchorInput): Promise<NCITrustAnchorRecord> {
    if (!input.entityId?.trim()) {
      throw new Error('entityId is required for trust anchor registration');
    }

    return this.client.nCITrustAnchor.upsert({
      where: { entityId: input.entityId },
      update: {
        entityType: input.entityType,
        publicKey: input.publicKey,
        certificateChain: input.certificateChain ?? null,
        accreditation: input.accreditation ?? AccreditationStatus.UNKNOWN,
        jurisdiction: input.jurisdiction ?? null,
        metadata: input.metadata ?? null,
        isActive: input.isActive ?? true,
      },
      create: {
        entityId: input.entityId,
        entityType: input.entityType,
        publicKey: input.publicKey,
        certificateChain: input.certificateChain ?? null,
        accreditation: input.accreditation ?? AccreditationStatus.UNKNOWN,
        jurisdiction: input.jurisdiction ?? null,
        metadata: input.metadata ?? null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async getAnchor(entityId: string): Promise<NCITrustAnchorRecord | null> {
    return this.client.nCITrustAnchor.findUnique({ where: { entityId } });
  }

  async assertAnchorIsTrusted(entityId: string): Promise<NCITrustAnchorRecord> {
    const anchor = await this.getAnchor(entityId);
    if (!anchor) {
      throw new Error(`Trust anchor ${entityId} was not found`);
    }
    if (!anchor.isActive) {
      throw new Error(`Trust anchor ${entityId} is inactive`);
    }
    if (!ACTIVE_ACCREDITATIONS.includes(anchor.accreditation)) {
      throw new Error(`Trust anchor ${entityId} is not in good standing`);
    }
    return anchor;
  }

  async verifyAttestation(options: VerifyAnchorOptions): Promise<boolean> {
    const anchor = await this.assertAnchorIsTrusted(options.entityId);
    const messageBuffer = serializeAttestationPayload(options.attestation.message, options.expectedDid);
    const signatureBuffer = decodeSignature(options.attestation.signature);

    const algorithm = options.attestation.algorithm ?? 'ed25519';
    if (algorithm !== 'ed25519') {
      throw new Error(`Unsupported trust anchor algorithm: ${algorithm}`);
    }

    return verifySignature(null, messageBuffer, createPublicKey(anchor.publicKey), signatureBuffer);
  }
}

function serializeAttestationPayload(
  payload: string | Record<string, unknown>,
  expectedDid?: string
): Buffer {
  if (typeof payload === 'string') {
    assertDidMatch(payload, expectedDid);
    return Buffer.from(payload);
  }

  const did = typeof payload.did === 'string' ? payload.did : undefined;
  assertDidMatch(did, expectedDid);

  const normalized = {
    ...payload,
    did,
  };
  return Buffer.from(JSON.stringify(normalized));
}

function assertDidMatch(actual: string | undefined, expected?: string): void {
  if (!expected) {
    return;
  }
  if (!actual) {
    throw new Error('Attestation payload did not include a DID');
  }
  if (actual !== expected) {
    throw new Error(`Attestation DID mismatch: expected ${expected}, received ${actual}`);
  }
}

function decodeSignature(signature: string): Buffer {
  if (signature.startsWith('0x')) {
    return Buffer.from(signature.slice(2), 'hex');
  }
  return Buffer.from(signature, 'base64');
}

