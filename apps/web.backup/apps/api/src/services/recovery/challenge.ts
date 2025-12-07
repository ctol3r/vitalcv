import { PrismaClient } from '@prisma/client';
import { createHash, createHmac, randomBytes } from 'crypto';
import { anchorRecoveryEvent } from '../audit/anchor';

const prisma = new PrismaClient();
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SECRET = process.env.RECOVERY_CHALLENGE_SECRET ?? 'vital-recovery-secret';

export type RecoveryMethod = 'email' | 'phone' | 'custodial' | 'recovery-kit';

export interface RecoveryChallengeRequest {
  clinicianId: string;
  method: RecoveryMethod;
}

export interface RecoveryChallengeResponse {
  sessionId: string;
  expiresAt: string;
  signature: string;
  delivery: 'email' | 'sms' | 'custodial' | 'kit';
  maskedDestination?: string;
  debugCode?: string;
}

export async function issueRecoveryChallenge(
  request: RecoveryChallengeRequest,
): Promise<RecoveryChallengeResponse> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: request.clinicianId },
    include: { user: true },
  });
  if (!clinician) {
    throw new Error(`Clinician ${request.clinicianId} not found`);
  }

  const token = buildChallengeToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const delivery = resolveDeliveryChannel(request.method);
  const signature = createHmac('sha256', SECRET)
    .update(`${request.clinicianId}:${token}:${expiresAt.toISOString()}`)
    .digest('hex');

  const session = await prisma.recoverySession.create({
    data: {
      clinicianId: clinician.id,
      method: request.method,
      step: 'init',
      metadata: {
        tokenHash: hashToken(token),
        expiresAt: expiresAt.toISOString(),
        delivery,
        destination: maskDestination(clinician, request.method),
        attempts: 0,
        signature,
      },
    },
  });

  anchorRecoveryEvent('recoveryInitiated', {
    clinicianId: session.clinicianId,
    recoveryMethod: session.method,
    sessionId: session.id,
    metadata: { delivery },
  });

  simulateChallengeDelivery(delivery, token, session.metadata?.destination as string | undefined);

  return {
    sessionId: session.id,
    expiresAt: expiresAt.toISOString(),
    signature,
    delivery,
    maskedDestination: (session.metadata as Record<string, unknown>)?.destination as string | undefined,
    debugCode: process.env.NODE_ENV === 'production' ? undefined : token,
  };
}

export async function verifyRecoveryChallenge(sessionId: string, token: string) {
  const session = await prisma.recoverySession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    throw new Error('recovery_session_not_found');
  }
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const expectedHash = metadata.tokenHash as string | undefined;
  const expiresAt = metadata.expiresAt ? new Date(String(metadata.expiresAt)) : null;

  if (!expectedHash || !expiresAt) {
    throw new Error('recovery_session_corrupt');
  }
  if (expiresAt.getTime() < Date.now()) {
    throw new Error('recovery_challenge_expired');
  }

  const providedHash = hashToken(token);
  if (providedHash !== expectedHash) {
    await prisma.recoverySession.update({
      where: { id: sessionId },
      data: {
        metadata: {
          ...metadata,
          attempts: Number(metadata.attempts ?? 0) + 1,
        },
      },
    });
    throw new Error('recovery_challenge_invalid');
  }

  const updated = await prisma.recoverySession.update({
    where: { id: sessionId },
    data: {
      step: 'verify',
      metadata: {
        ...metadata,
        verifiedAt: new Date().toISOString(),
      },
    },
  });

  anchorRecoveryEvent('recoveryVerified', {
    clinicianId: updated.clinicianId,
    recoveryMethod: updated.method,
    sessionId: updated.id,
    metadata: { attempts: metadata.attempts ?? 0 },
  });

  return updated;
}

export async function updateRecoveryStep(
  sessionId: string,
  step: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.recoverySession.update({
    where: { id: sessionId },
    data: {
      step,
      metadata: metadata ? metadata : undefined,
    },
  });
}

export async function loadRecoverySession(sessionId: string) {
  return prisma.recoverySession.findUnique({
    where: { id: sessionId },
  });
}

function buildChallengeToken(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function resolveDeliveryChannel(
  method: RecoveryMethod,
): RecoveryChallengeResponse['delivery'] {
  if (method === 'phone') return 'sms';
  if (method === 'recovery-kit') return 'kit';
  if (method === 'custodial') return 'custodial';
  return 'email';
}

function maskDestination(
  clinician: { user: { email?: string | null; phone?: string | null } | null },
  method: RecoveryMethod,
) {
  if (method === 'email' && clinician.user?.email) {
    const [name, domain] = clinician.user.email.split('@');
    const masked =
      name.length <= 2 ? `${name[0] ?? ''}*` : `${name.slice(0, 2)}***`;
    return `${masked}@${domain}`;
  }
  if (method === 'phone' && clinician.user?.phone) {
    const digits = clinician.user.phone.replace(/\D/g, '');
    return digits.length > 4 ? `***${digits.slice(-4)}` : '***';
  }
  if (method === 'custodial') {
    return 'Custodial desk';
  }
  if (method === 'recovery-kit') {
    return 'Recovery kit vault';
  }
  return undefined;
}

function simulateChallengeDelivery(
  delivery: RecoveryChallengeResponse['delivery'],
  token: string,
  destination?: string,
) {
  console.info(
    `[recovery] challenge via ${delivery} => ${destination ?? 'unknown'} :: ${token}`,
  );
}










