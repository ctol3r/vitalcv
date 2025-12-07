import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateKeyPairSync, randomUUID } from 'crypto';
import { ChainClient } from '../../services/chain/client';

const prisma = new PrismaClient();
const router = Router();

router.post('/did/rotate', async (req: Request, res: Response) => {
  const { clinicianId, verificationToken, reason } = req.body ?? {};
  if (!clinicianId || !verificationToken) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'clinicianId and verificationToken are required',
    });
  }

  try {
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { user: true },
    });
    if (!clinician) {
      return res.status(404).json({ error: 'clinician_not_found' });
    }

    if (!verifyIdentity(clinician, verificationToken)) {
      return res.status(403).json({
        error: 'verification_failed',
        message: 'Unable to validate identity for rotation event',
      });
    }

    const keypair = generateEd25519Keypair();
    const did = clinician.user?.did ?? `did:web:vitalcv.health:${clinician.id}`;
    const didDocument = buildDidDocument(did, keypair.publicKey);

    const anchorClient = new ChainClient();
    const anchorReceipt = await anchorClient.submitAuditEvent({
      eventType: 'did.rotation',
      payload: {
        clinicianId,
        did,
        reason: reason ?? 'scheduled-rotation',
      },
      tags: ['did', 'rotation'],
    });

    await prisma.auditEvidence.create({
      data: {
        clinicianId,
        category: 'did-rotation',
        payload: {
          did,
          didDocument,
          anchor: anchorReceipt,
          rotationReason: reason ?? 'scheduled-rotation',
        },
      },
    });

    return res.json({
      rotationId: randomUUID(),
      did,
      didDocument,
      publicKey: keypair.publicKey,
      recoverySecret: keypair.privateKey,
      anchor: anchorReceipt,
    });
  } catch (error) {
    console.error('[DID] rotation failed', error);
    return res.status(500).json({
      error: 'did_rotation_failed',
      message: error instanceof Error ? error.message : 'Unable to rotate DID keys',
    });
  }
});

function verifyIdentity(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
  token: string,
): boolean {
  const normalized = String(token ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const email = clinician.user?.email?.toLowerCase();
  const npiLast4 = clinician.npi?.slice(-4);
  return normalized === email || normalized === npiLast4;
}

function generateEd25519Keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

function buildDidDocument(did: string, publicKey: string) {
  const verificationId = `${did}#master`;
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [
      {
        id: verificationId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: `z${publicKey}`,
      },
    ],
    authentication: [verificationId],
    assertionMethod: [verificationId],
    updated: new Date().toISOString(),
  };
}

export default router;


