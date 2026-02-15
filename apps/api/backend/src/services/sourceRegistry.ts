import type { VerificationSource } from '../interfaces/verificationSource';
import { NursysStubAdapter } from './adapters/nursysStubAdapter';

/**
 * Verification source registry.
 *
 * Maps source names to adapter instances. The stub adapter is always
 * available. When REAL_NURSYS_ENABLED=true, the registry throws an
 * explicit error — real adapters must be implemented before enabling.
 */

const adapters = new Map<string, VerificationSource>();

// Register built-in stub
adapters.set('NURSYS_STUB', new NursysStubAdapter());

/**
 * Retrieve a verification source adapter by name.
 *
 * Checks REAL_NURSYS_ENABLED when requesting the live adapter.
 * Throws if the adapter is not registered.
 */
export function getVerificationSource(sourceName: string): VerificationSource {
  // Guard: if requesting live Nursys, check env flag
  if (sourceName === 'NURSYS') {
    const enabled = process.env.REAL_NURSYS_ENABLED?.trim().toLowerCase();
    if (enabled === 'true' || enabled === '1') {
      throw new Error(
        'Real Nursys adapter not implemented. Set REAL_NURSYS_ENABLED=false or implement the live adapter.',
      );
    }
    // Fall through to NURSYS_STUB when live adapter is not enabled
    return getVerificationSource('NURSYS_STUB');
  }

  const adapter = adapters.get(sourceName);
  if (!adapter) {
    throw new Error(`Unknown verification source: ${sourceName}. Available: ${[...adapters.keys()].join(', ')}`);
  }

  return adapter;
}

/**
 * Register a custom verification source adapter.
 * Used for testing or future live adapter registration.
 */
export function registerVerificationSource(source: VerificationSource): void {
  adapters.set(source.name, source);
}
