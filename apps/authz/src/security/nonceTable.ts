import { randomBytes } from 'crypto';
import prisma from '../db';

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function issueNonce(now = Date.now()): Promise<{ nonce: string; expiresInSeconds: number }> {
  await prisma.jtiReplay.deleteMany({
    where: { service: 'authz_nonce', expiresAt: { lte: new Date(now) } },
  });

  const nonce = randomBytes(32).toString('base64url');
  await prisma.jtiReplay.create({
    data: {
      service: 'authz_nonce',
      jti: nonce,
      expiresAt: new Date(now + NONCE_TTL_MS),
    },
  });

  return { nonce, expiresInSeconds: NONCE_TTL_MS / 1000 };
}

export type ConsumeNonceResult = 'accepted' | 'missing' | 'expired' | 'replay';

export async function consumeNonce(
  nonce: string,
  now = Date.now(),
): Promise<ConsumeNonceResult> {
  const nowDate = new Date(now);
  await prisma.jtiReplay.deleteMany({
    where: { service: 'authz_nonce', expiresAt: { lte: nowDate } },
  });

  const record = await prisma.jtiReplay.findUnique({
    where: {
      service_jti: {
        service: 'authz_nonce',
        jti: nonce,
      },
    },
  }) as unknown as { used?: boolean; expiresAt: Date } | null;

  if (!record) {
    return 'missing';
  }

  if (record.expiresAt <= nowDate) {
    void prisma.jtiReplay.delete({
      where: {
        service_jti: {
          service: 'authz_nonce',
          jti: nonce,
        },
      },
    });
    return 'expired';
  }

  await prisma.jtiReplay.delete({
    where: {
      service_jti: {
        service: 'authz_nonce',
        jti: nonce,
      },
    },
  });

  return 'accepted';
}

export function resetNonceTable(): void {
  void prisma.jtiReplay.deleteMany({ where: { service: 'authz_nonce' } }).catch(() => undefined);
}

export function getNonceTtlMs(): number {
  return NONCE_TTL_MS;
}
