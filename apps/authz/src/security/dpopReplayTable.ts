import prisma from '../db';

const DPOP_REPLAY_TTL_MS = 5 * 60 * 1000;

/**
 * Returns true when the jti is already present and unexpired (replay).
 * Returns false when the jti is newly stored.
 */
export async function isDpopReplay(jti: string, now = Date.now()): Promise<boolean> {
  const nowDate = new Date(now);
  await prisma.jtiReplay.deleteMany({
    where: {
      service: 'authz',
      expiresAt: { lte: nowDate },
    },
  });

  const existing = await prisma.jtiReplay.findUnique({
    where: {
      service_jti: {
        service: 'authz',
        jti,
      },
    },
  });

  if (existing && existing.expiresAt > nowDate) {
    return true;
  }

  await prisma.jtiReplay.create({
    data: {
      service: 'authz',
      jti,
      expiresAt: new Date(now + DPOP_REPLAY_TTL_MS),
    },
  });

  return false;
}

export function resetDpopReplayTable(): void {
  void prisma.jtiReplay.deleteMany({ where: { service: 'authz' } }).catch(() => undefined);
}

export function getDpopReplayTtlMs(): number {
  return DPOP_REPLAY_TTL_MS;
}
