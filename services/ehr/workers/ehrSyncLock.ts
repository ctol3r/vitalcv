const activeSyncLocks = new Set<string>();

export class EhrSyncConcurrencyError extends Error {
  constructor(message?: string) {
    super(message ?? 'EHR synchronization already running for this syncId');
    this.name = 'EhrSyncConcurrencyError';
  }
}

export async function withEhrSyncLock<T>(syncId: string, work: () => Promise<T>): Promise<T> {
  if (activeSyncLocks.has(syncId)) {
    throw new EhrSyncConcurrencyError(`EHR synchronization ${syncId} is already running`);
  }

  activeSyncLocks.add(syncId);

  try {
    return await work();
  } finally {
    activeSyncLocks.delete(syncId);
  }
}

