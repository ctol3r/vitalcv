import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'supervisor-lock' });

/**
 * Error thrown when a supervisor run is already in progress for an organization.
 */
export class SupervisorLockError extends Error {
  constructor(public readonly orgId: string) {
    super(`Supervisor run already in progress for org ${orgId}`);
    this.name = 'SupervisorLockError';
  }
}

/**
 * In-memory lock store for supervisor runs.
 * Note: For production, this should be replaced with a distributed lock mechanism
 * (e.g., Redis, database-backed locks) to work across multiple processes.
 */
const activeSupervisorLocks = new Set<string>();

/**
 * Acquire a lock for a supervisor run on an organization.
 * Only one supervisor run per org can execute at a time.
 *
 * @param orgId - Organization ID
 * @returns true if lock was acquired, false if already locked
 */
export function acquireSupervisorLock(orgId: string): boolean {
  if (activeSupervisorLocks.has(orgId)) {
    logger.warn('Supervisor lock already exists', { orgId });
    return false;
  }

  activeSupervisorLocks.add(orgId);
  logger.info('Acquired supervisor lock', { orgId });
  return true;
}

/**
 * Release a supervisor lock.
 *
 * @param orgId - Organization ID
 */
export function releaseSupervisorLock(orgId: string): void {
  const removed = activeSupervisorLocks.delete(orgId);
  if (removed) {
    logger.info('Released supervisor lock', { orgId });
  } else {
    logger.warn('Attempted to release non-existent supervisor lock', { orgId });
  }
}

/**
 * Check if a supervisor lock exists for an organization.
 *
 * @param orgId - Organization ID
 * @returns true if lock exists
 */
export function isSupervisorLocked(orgId: string): boolean {
  return activeSupervisorLocks.has(orgId);
}

/**
 * Execute work with a supervisor lock.
 * Automatically acquires and releases the lock.
 *
 * @param orgId - Organization ID
 * @param work - Work to execute while locked
 * @returns Result of work
 * @throws SupervisorLockError if lock cannot be acquired
 */
export async function withSupervisorLock<T>(
  orgId: string,
  work: () => Promise<T>
): Promise<T> {
  if (!acquireSupervisorLock(orgId)) {
    throw new SupervisorLockError(orgId);
  }

  try {
    return await work();
  } finally {
    releaseSupervisorLock(orgId);
  }
}

