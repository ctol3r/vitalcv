import type { VerificationSource } from '../interfaces/verificationSource';
import { log } from '../obs/logger';
import { NursysAccessPendingAdapter } from './adapters/nursysAccessPendingAdapter';
import { NursysStubAdapter } from './adapters/nursysStubAdapter';

/**
 * Verification source registry.
 *
 * Maps source names to adapter instances. The stub adapter is always
 * available. Flag semantics for 'NURSYS' (REAL_NURSYS_ENABLED, the same
 * flag the pilot runbook and ingest orchestrator use):
 *
 *   - flag on + a live 'NURSYS' adapter registered  → the live adapter
 *   - flag on + no live adapter                     → NursysAccessPendingAdapter
 *     (honest UNKNOWN placeholder; previously this THREW, crashing
 *     monitoring sweeps and artifact issuance the moment the flag flipped)
 *   - flag off                                      → deterministic stub
 */

const adapters = new Map<string, VerificationSource>();

// Register built-in adapters
adapters.set('NURSYS_STUB', new NursysStubAdapter());
adapters.set('NURSYS_ACCESS_PENDING', new NursysAccessPendingAdapter());

function isRealNursysEnabled(): boolean {
  const enabled = process.env.REAL_NURSYS_ENABLED?.trim().toLowerCase();
  return enabled === 'true' || enabled === '1';
}

/**
 * Retrieve a verification source adapter by name.
 * Throws only for names that were never registered.
 */
export function getVerificationSource(sourceName: string): VerificationSource {
  if (sourceName === 'NURSYS') {
    const liveAdapter = adapters.get('NURSYS');
    if (isRealNursysEnabled()) {
      if (liveAdapter) {
        return liveAdapter;
      }
      log('error', 'source_registry: REAL_NURSYS_ENABLED set but no live Nursys adapter registered', {
        served: 'NURSYS_ACCESS_PENDING',
      });
      return getVerificationSource('NURSYS_ACCESS_PENDING');
    }
    // Flag off: legacy deterministic stub (fabricated statuses — see
    // NursysStubAdapter header; live callers of this path are tracked
    // as a separate honesty follow-up).
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
