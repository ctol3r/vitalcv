import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash, generateKeyPairSync, randomUUID } from 'crypto';
import { ChainClient } from '../../services/chain/client';
import {
  issueRecoveryChallenge,
  verifyRecoveryChallenge,
  loadRecoverySession,
} from '../../services/recovery/challenge';
import { generateRecoveryKit, restoreRecoveryKit } from '../../services/recovery/kit';
import { anchorRecoveryEvent } from '../../services/audit/anchor';

const prisma = new PrismaClient();
const router = Router();

router.post('/did/recovery/session', async (req: Request, res: Response) => {
  const { clinicianId, method } = req.body ?? {};
  if (!clinicianId || !method) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'clinicianId and method are required',
    });
  }

  try {
    const challenge = await issueRecoveryChallenge({
      clinicianId,
      method,
    });
    return res.json(challenge);
  } catch (error) {
    console.error('[DID] recovery session init failed', error);
    return res.status(500).json({
      error: 'recovery_init_failed',
      message: error instanceof Error ? error.message : 'Unable to start recovery session',
    });
  }
});

router.post('/did/recovery/session/:sessionId/verify', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { code } = req.body ?? {};
  if (!code) {
    return res.status(400).json({
      error: 'verification_code_required',
      message: 'Provide the verification code delivered out-of-band',
    });
  }

  try {
    const session = await verifyRecoveryChallenge(sessionId, String(code));
    return res.json({
      sessionId: session.id,
      clinicianId: session.clinicianId,
      method: session.method,
      step: session.step,
    });
  } catch (error) {
    console.error('[DID] recovery verification failed', error);
    return res.status(400).json({
      error: 'recovery_verification_failed',
      message: error instanceof Error ? error.message : 'Challenge verification failed',
    });
  }
});

router.post('/did/recovery/session/:sessionId/rotate', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    const session = await loadRecoverySession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'session_not_found' });
    }
    if (session.step !== 'verify' && session.step !== 'rotateKeys') {
      return res.status(409).json({
        error: 'recovery_session_not_ready',
        message: `Session is currently in ${session.step} state`,
      });
    }

    const kitBlob = typeof req.body?.kitBlob === 'string' ? req.body.kitBlob : undefined;
    const kitKey = typeof req.body?.kitKey === 'string' ? req.body.kitKey : undefined;

    if (kitBlob && !kitKey) {
      return res.status(400).json({
        error: 'kit_key_required',
        message: 'Provide kitKey when uploading a recovery kit blob',
      });
    }

    const kit =
      kitBlob && kitKey
        ? {
            blob: kitBlob,
            secret: kitKey,
            checksum: createHash('sha256').update(kitBlob).digest('hex'),
          }
        : await generateRecoveryKit(session.clinicianId);

    const kitPayload = restoreRecoveryKit(kit.blob, kit.secret);
    const keypair = generateEd25519Keypair();
    const did = await resolveDidForClinician(session.clinicianId);
    const didDocument = buildDidDocument(did, keypair.publicKey);

    const chainClient = new ChainClient();
    const anchor = await chainClient.submitAuditEvent({
      eventType: 'did.recovery',
      payload: {
        clinicianId: session.clinicianId,
        did,
        method: session.method,
        credentialsRestored: kitPayload.credentials.length,
      },
      tags: ['did', 'recovery'],
    });

    await prisma.auditEvidence.create({
      data: {
        clinicianId: session.clinicianId,
        category: 'did-recovery',
        payload: {
          did,
          method: session.method,
          anchor,
          restoredCredentials: kitPayload.credentials.map((credential) => credential.credentialId),
        },
      },
    });

    await recordRecoveryMetadata({
      clinicianId: session.clinicianId,
      method: session.method,
      recoveryDid: did,
    });

    await prisma.recoverySession.update({
      where: { id: sessionId },
      data: {
        step: 'complete',
        metadata: {
          ...(session.metadata ?? {}),
          kitChecksum: kit.checksum,
          rotatedAt: new Date().toISOString(),
        },
      },
    });

    anchorRecoveryEvent('keysRotated', {
      clinicianId: session.clinicianId,
      recoveryMethod: session.method,
      sessionId: sessionId,
      metadata: { kitChecksum: kit.checksum },
    });

    return res.json({
      sessionId,
      did,
      didDocument,
      recoverySecret: keypair.privateKey,
      restoredCredentials: kitPayload.credentials,
      kit: {
        checksum: kit.checksum,
        credentialCount: kitPayload.credentials.length,
      },
      anchor,
    });
  } catch (error) {
    console.error('[DID] recovery rotate failed', error);
    return res.status(500).json({
      error: 'recovery_rotate_failed',
      message: error instanceof Error ? error.message : 'Unable to rotate keys',
    });
  }
});

router.get('/did/recovery/kit/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_required',
      message: 'clinicianId path param is required',
    });
  }

  try {
    const kit = await generateRecoveryKit(clinicianId);
    return res.json(kit);
  } catch (error) {
    console.error('[DID] recovery kit export failed', error);
    return res.status(500).json({
      error: 'recovery_kit_failed',
      message: error instanceof Error ? error.message : 'Unable to export recovery kit',
    });
  }
});

router.post('/did/recovery', async (req: Request, res: Response) => {
  const { clinicianId, method, code } = req.body ?? {};
  if (!clinicianId || !method || !code) {
    return res.status(400).json({
      error: 'invalid_payload',
      message: 'clinicianId, method, and code are required',
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

    if (!verifyRecoveryCode(clinician, method, code)) {
      return res.status(403).json({
        error: 'recovery_validation_failed',
        message: 'Recovery challenge failed validation',
      });
    }

    const keypair = generateEd25519Keypair();
    const did = clinician.user?.did ?? `did:web:vitalcv.health:${clinician.id}`;
    const didDocument = buildDidDocument(did, keypair.publicKey);
    const restoredCredentials = await prisma.walletCredential.findMany({
      where: { clinicianId },
      take: 10,
    });

    const chainClient = new ChainClient();
    const anchor = await chainClient.submitAuditEvent({
      eventType: 'did.recovery',
      payload: {
        clinicianId,
        did,
        method,
        credentialsRestored: restoredCredentials.length,
      },
      tags: ['did', 'recovery'],
    });

    await prisma.auditEvidence.create({
      data: {
        clinicianId,
        category: 'did-recovery',
        payload: {
          did,
          method,
          anchor,
          restoredCredentials: restoredCredentials.map((credential) => credential.credentialId),
        },
      },
    });

    await recordRecoveryMetadata({
      clinicianId,
      method,
      recoveryDid: did,
    });

    anchorRecoveryEvent('keysRotated', {
      clinicianId,
      recoveryMethod: method,
      sessionId: `legacy-${randomUUID()}`,
      metadata: { legacyFlow: true },
    });

    return res.json({
      recoveryId: randomUUID(),
      did,
      didDocument,
      recoverySecret: keypair.privateKey,
      restoredCredentials,
      anchor,
    });
  } catch (error) {
    console.error('[DID] recovery failed', error);
    return res.status(500).json({
      error: 'did_recovery_failed',
      message: error instanceof Error ? error.message : 'Unable to recover DID',
    });
  }
});

async function resolveDidForClinician(clinicianId: string) {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });
  if (clinician?.user?.did) {
    return clinician.user.did;
  }
  return `did:web:vitalcv.health:${clinicianId}`;
}

function verifyRecoveryCode(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
  method: string,
  code: string,
): boolean {
  const normalized = String(code ?? '').trim();
  if (normalized.length < 4) {
    return false;
  }
  if (method === 'email') {
    return Boolean(clinician.user?.email && clinician.user.email.toLowerCase().includes(normalized.toLowerCase()));
  }
  if (method === 'phone' || method === 'sms') {
    return Boolean(clinician.user?.phone && clinician.user.phone.replace(/\D/g, '').endsWith(normalized));
  }
  if (method === 'escrow' || method === 'custodial') {
    return normalized.toLowerCase().startsWith('escrow-');
  }
  return false;
}

async function recordRecoveryMetadata(payload: {
  clinicianId: string;
  recoveryDid: string;
  method: string;
}) {
  const recoveryStore = (prisma as any).dIDRecovery;
  if (!recoveryStore?.create) {
    return;
  }
  try {
    await recoveryStore.create({
      data: {
        clinicianId: payload.clinicianId,
        recoveryDid: payload.recoveryDid,
        method: payload.method,
      },
    });
  } catch (error) {
    console.warn('[DID] recovery metadata skipped', error);
  }
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


