import type { VerificationSource } from '../interfaces/verificationSource';
import { log } from '../obs/logger';
import { NursysAccessPendingAdapter } from './adapters/nursysAccessPendingAdapter';
import { NursysStubAdapter } from './adapters/nursysStubAdapter';
import { isProductionRuntime } from '../utils/environment';

/**
 * Verification source registry.
 *
 * Maps source names to adapter instances.
 *
 * Truth contract: adapters that fabricate or stand in for results
 * (decisionGrade=false — deterministic stubs, access-pending placeholders)
 * are never served in production. Callers get SourceAccessRequiredError
 * and must surface an honest "source access required" state instead of
 * persisting or presenting a fabricated verification.
 *
 * Flag semantics for 'NURSYS' (REAL_NURSYS_ENABLED, the same flag the
 * pilot runbook and ingest orchestrator use):
 *
 *   - flag on + a live 'NURSYS' adapter registered → the live adapter
 *     (subject to the same decision-grade gate)
 *   - flag on + no live adapter → NursysAccessPendingAdapter in dev/test
 *     (honest UNKNOWN placeholder); in production the decision-grade gate
 *     below refuses it with SourceAccessRequiredError
 *   - flag off → deterministic stub in dev/test; refused in production
 */

/**
 * Thrown when a verification is requested but the only available adapter
 * fabricates results and the runtime is production. Fail closed: no
 * artifact may be created, and no verified state may be presented.
 */
export class SourceAccessRequiredError extends Error {
  readonly code = 'SOURCE_ACCESS_REQUIRED' as const;
  readonly sourceName: string;

  constructor(sourceName: string) {
    super(
      `Verification source ${sourceName} requires primary-source access that is not connected. ` +
        'Refusing to fabricate a verification result in production.',
    );
    this.name = 'SourceAccessRequiredError';
    this.sourceName = sourceName;
  }
}

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
 *
 * Throws for names that were never registered, and — in production — throws
 * SourceAccessRequiredError when the resolved adapter is not decision-grade
 * (fabricating stubs and access-pending placeholders).
 */
export function getVerificationSource(sourceName: string): VerificationSource {
  let resolvedName = sourceName;

  if (sourceName === 'NURSYS') {
    if (isRealNursysEnabled()) {
      if (adapters.has('NURSYS')) {
        resolvedName = 'NURSYS';
      } else {
        log('error', 'source_registry: REAL_NURSYS_ENABLED set but no live Nursys adapter registered', {
          served: 'NURSYS_ACCESS_PENDING',
        });
        resolvedName = 'NURSYS_ACCESS_PENDING';
      }
    } else {
      // Flag off: legacy deterministic stub for dev/test flows. The
      // decision-grade gate below keeps it out of production.
      resolvedName = 'NURSYS_STUB';
    }
  }

  const adapter = adapters.get(resolvedName);
  if (!adapter) {
    throw new Error(`Unknown verification source: ${resolvedName}. Available: ${[...adapters.keys()].join(', ')}`);
  }

  if (!adapter.decisionGrade && isProductionRuntime()) {
    throw new SourceAccessRequiredError(sourceName);
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
