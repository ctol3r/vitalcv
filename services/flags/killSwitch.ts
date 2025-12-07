import { getServiceLogger } from '../logging/serviceLogger';
const log = getServiceLogger('flags/killSwitch');
/**
 * B149A-FF-006: Feature flag kill-switch helper (fast, in-memory)
 *
 * killSwitch('key') can disable feature instantly in memory until process restart
 * guard function isFeatureEnabled('key') checks killset before DB
 */

// In-memory set of killed feature flags
const killedFlags = new Set<string>();

/**
 * Kill a feature flag (disable it instantly in memory)
 * This takes precedence over all database values
 */
export function killSwitch(flagKey: string): void {
  killedFlags.add(flagKey);
}

/**
 * Revive a killed feature flag (remove from killset)
 */
export function reviveSwitch(flagKey: string): void {
  killedFlags.delete(flagKey);
}

/**
 * Check if a feature flag is killed
 */
export function isKilled(flagKey: string): boolean {
  return killedFlags.has(flagKey);
}

/**
 * Get all killed flags
 */
export function getKilledFlags(): string[] {
  return Array.from(killedFlags);
}

/**
 * Clear all killed flags (useful for testing)
 */
export function clearKilledFlags(): void {
  killedFlags.clear();
}

/**
 * Guard function: Check if feature is enabled
 * Returns false if flag is killed, otherwise defers to getFlag
 *
 * @param getFlagFn - Function that returns the flag value (from getFlag)
 * @param flagKey - Flag key to check
 * @returns Promise<boolean> - true if enabled, false if killed or disabled
 */
export async function isFeatureEnabled(
  getFlagFn: () => Promise<any>,
  flagKey: string
): Promise<boolean> {
  // Check killset first (fast path)
  if (isKilled(flagKey)) {
    return false;
  }

  // Otherwise check database
  try {
    const result = await getFlagFn();
    // Handle various value types
    if (typeof result === 'boolean') {
      return result;
    }
    if (typeof result === 'object' && result !== null && 'value' in result) {
      return Boolean(result.value);
    }
    return Boolean(result);
  } catch (error) {
    // If flag doesn't exist or error, default to disabled
    log.error(`[KillSwitch] Error checking flag ${flagKey}:`, error);
    return false;
  }
}

