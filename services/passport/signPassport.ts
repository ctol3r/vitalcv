import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { sign, SignedMessage } from '@packages/domain-identity';
import type { PassportBundleManifest } from './v3/types';

const prisma = new PrismaClient();
const PASSPORT_SIGNING_KEY =
  process.env.PASSPORT_SIGNING_KEY || process.env.ISSUER_SECRET_KEY || '';

export interface PassportBundleMetadata {
  bundleId: string;
  clinicianId: string;
  userId: string;
  bundleHash: string;
  manifest: PassportBundleManifest;
}

export interface PassportAnchor {
  anchorId: string;
  signature: string;
  publicKey: string;
  algorithm: SignedMessage['algorithm'];
  timestamp: string;
}

export async function signPassportBundle(
  metadata: PassportBundleMetadata,
): Promise<PassportAnchor> {
  if (!PASSPORT_SIGNING_KEY) {
    throw new Error('PASSPORT_SIGNING_KEY (or ISSUER_SECRET_KEY) is not configured');
  }

  const signed = await sign(
    {
      bundleId: metadata.bundleId,
      bundleHash: metadata.bundleHash,
      clinicianId: metadata.clinicianId,
      userId: metadata.userId,
      did: metadata.manifest.did,
      generatedAt: metadata.manifest.generatedAt,
    },
    PASSPORT_SIGNING_KEY,
  );

  const anchorId = createHash('sha256')
    .update(`${metadata.bundleId}:${signed.signature}`)
    .digest('hex')
    .slice(0, 48);

  await prisma.auditEvent.create({
    data: {
      type: 'PASSPORT_BUNDLE_ANCHORED',
      subjectNpi: metadata.manifest.clinician.npi,
      userId: metadata.userId,
      data: {
        anchorId,
        bundleId: metadata.bundleId,
        bundleHash: metadata.bundleHash,
        signature: signed.signature,
        publicKey: signed.publicKey,
        algorithm: signed.algorithm,
        manifest: {
          did: metadata.manifest.did,
          credentials: Object.keys(metadata.manifest.credentials),
        },
      },
    },
  });

  return {
    anchorId,
    signature: signed.signature,
    publicKey: signed.publicKey,
    algorithm: signed.algorithm,
    timestamp: new Date(signed.timestamp).toISOString(),
  };
}
