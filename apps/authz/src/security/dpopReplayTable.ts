const DPOP_REPLAY_TTL_MS = 5 * 60 * 1000;

type DpopReplayRecord = {
  readonly expiresAt: number;
};

const dpopReplayTable = new Map<string, DpopReplayRecord>();

function cleanupExpired(now: number): void {
  for (const [jti, record] of dpopReplayTable.entries()) {
    if (record.expiresAt <= now) {
      dpopReplayTable.delete(jti);
    }
  }
}

/**
 * Returns true when the jti is already present and unexpired (replay).
 * Returns false when the jti is newly stored.
 */
export function isDpopReplay(jti: string, now = Date.now()): boolean {
  cleanupExpired(now);

  const existing = dpopReplayTable.get(jti);
  if (existing && existing.expiresAt > now) {
    return true;
  }

  dpopReplayTable.set(jti, { expiresAt: now + DPOP_REPLAY_TTL_MS });
  return false;
}

export function resetDpopReplayTable(): void {
  dpopReplayTable.clear();
}

export function getDpopReplayTtlMs(): number {
  return DPOP_REPLAY_TTL_MS;
}
