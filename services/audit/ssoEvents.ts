import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface BaseSsoEvent {
  providerId: string;
  orgId: string;
  email?: string;
  ip?: string;
}

export interface SsoSuccessEvent extends BaseSsoEvent {
  userId: string;
  state: string;
  nonce: string;
}

export interface SsoFailureEvent extends BaseSsoEvent {
  reason: string;
  stage: 'start' | 'callback' | 'token' | 'userinfo' | 'provision' | 'unknown';
}

function hashValue(input?: string): string | null {
  if (!input) {
    return null;
  }
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function logSsoSuccess(event: SsoSuccessEvent) {
  await prisma.auditEvent.create({
    data: {
      type: 'LOGIN_SSO_SUCCESS',
      userId: event.userId,
      data: {
        providerId: event.providerId,
        orgId: event.orgId,
        emailHash: hashValue(event.email),
        ipHash: hashValue(event.ip),
        nonce: event.nonce,
        state: event.state,
      },
    },
  });
}

export async function logSsoFailure(event: SsoFailureEvent) {
  await prisma.auditEvent.create({
    data: {
      type: 'LOGIN_SSO_FAILURE',
      data: {
        providerId: event.providerId,
        orgId: event.orgId,
        emailHash: hashValue(event.email),
        ipHash: hashValue(event.ip),
        reason: event.reason,
        stage: event.stage,
      },
    },
  });
}
