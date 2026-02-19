import { haipConfig } from '@vitalcv/haip-config';
import prisma from '../db';

const DEFAULT_NONCE_TTL_MS = haipConfig.nonce.cNonceLifetimeSeconds * 1000;
const NONCE_LENGTH_BYTES = haipConfig.nonce.nonceLengthBytes;

function getNonceTtlMs(): number {
  return DEFAULT_NONCE_TTL_MS;
}

export async function issueNonce(now = Date.now()): Promise<{ nonce: string; expiresInSeconds: number }> {
  await prisma.verifierNonce.deleteMany({
    where: { expiresAt: { lte: new Date(now) } },
  });

  const random = globalThis.crypto?.getRandomValues
    ? Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES)).buffer).toString('base64url')
    : Math.random().toString(36).slice(2);

  const nonce = random;

  await prisma.verifierNonce.create({
    data: {
      nonce,
      expiresAt: new Date(now + getNonceTtlMs()),
      used: false,
    },
  });

  return { nonce, expiresInSeconds: getNonceTtlMs() / 1000 };
}

export type ConsumeNonceResult = 'accepted' | 'missing' | 'expired' | 'replay';

export async function consumeNonce(
  nonce: string,
  now = Date.now(),
): Promise<ConsumeNonceResult> {
  const nowDate = new Date(now);
  const normalized = nonce.trim();

  await prisma.verifierNonce.deleteMany({
    where: { expiresAt: { lte: nowDate } },
  });

  const record = await prisma.verifierNonce.findUnique({
    where: {
      nonce: normalized,
    },
  });

  if (!record) {
    return 'missing';
  }

  if (record.expiresAt <= nowDate) {
    await prisma.verifierNonce.delete({ where: { nonce: normalized } });
    return 'expired';
  }

  if (record.used) {
    return 'replay';
  }

  await prisma.verifierNonce.update({
    where: {
      nonce: normalized,
    },
    data: {
      used: true,
    },
  });

  return 'accepted';
}

export function resetNonceTable(): void {
  void prisma.verifierNonce.deleteMany().catch(() => undefined);
}
