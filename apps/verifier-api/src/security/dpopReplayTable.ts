import prisma from '../db';

const DPOP_REPLAY_TTL_MS = 5 * 60 * 1000;

type VerifyReplayResult = {
  existing: boolean;
  created: boolean;
};

export async function isReplayJti(jti: string, now = Date.now()): Promise<boolean> {
  const nowDate = new Date(now);
  await prisma.jtiReplay.deleteMany({
    where: {
      service: 'verifier',
      expiresAt: { lte: nowDate },
    },
  });

  const existing = await prisma.jtiReplay.findUnique({
    where: {
      service_jti: {
        service: 'verifier',
        jti,
      },
    },
  });

  if (existing && existing.expiresAt > nowDate) {
    return true;
  }

  await prisma.jtiReplay.create({
    data: {
      service: 'verifier',
      jti,
      expiresAt: new Date(now + DPOP_REPLAY_TTL_MS),
    },
  });

  return false;
}

export function resetReplayTable(): void {
  void prisma.jtiReplay.deleteMany({ where: { service: 'verifier' } }).catch(() => undefined);
}

export function getDpopReplayTtlMs(): number {
  return DPOP_REPLAY_TTL_MS;
}
