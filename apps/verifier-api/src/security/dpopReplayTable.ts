const DPOP_REPLAY_TTL_MS = 5 * 60 * 1000;

type DpopReplayRecord = {
  readonly expiresAt: number;
};

const replayTable = new Map<string, DpopReplayRecord>();

function cleanupExpired(now: number): void {
  for (const [jti, record] of replayTable.entries()) {
    if (record.expiresAt <= now) {
      replayTable.delete(jti);
    }
  }
}

export function isReplayJti(jti: string, now = Date.now()): boolean {
  cleanupExpired(now);
  const existing = replayTable.get(jti);
  if (existing && existing.expiresAt > now) {
    return true;
  }

  replayTable.set(jti, { expiresAt: now + DPOP_REPLAY_TTL_MS });
  return false;
}

export function resetReplayTable(): void {
  replayTable.clear();
}
