const activeSyncs = new Set<string>();

export class EhrSyncConcurrencyError extends Error {
  constructor(syncId: string) {
    super(`EHR synchronization ${syncId} is already running`);
    this.name = 'EhrSyncConcurrencyError';
  }
}

export async function withEhrSyncLock<T>(syncId: string, fn: () => Promise<T>): Promise<T> {
  if (!syncId) {
    throw new Error('syncId is required to acquire EHR synchronization lock');
  }

  if (activeSyncs.has(syncId)) {
    throw new EhrSyncConcurrencyError(syncId);
  }

  activeSyncs.add(syncId);
  try {
    return await fn();
  } finally {
    activeSyncs.delete(syncId);
  }
}

export function isEhrSyncLocked(syncId: string): boolean {
  return activeSyncs.has(syncId);
}


