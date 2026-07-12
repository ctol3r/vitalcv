import type { VerificationSource } from '../interfaces/verificationSource';
import { NursysStubAdapter } from './adapters/nursysStubAdapter';
import { isProductionRuntime } from '../utils/environment';

/**
 * Verification source registry.
 *
 * Maps source names to adapter instances. The stub adapter is always
 * available. When REAL_NURSYS_ENABLED=true, the registry throws an
 * explicit error — real adapters must be implemented before enabling.
 *
 * Truth contract: adapters that fabricate results (decisionGrade=false)
 * are never served in production. Callers get SourceAccessRequiredError
 * and must surface an honest "source access required" state instead of
 * persisting or presenting a fabricated verification.
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

// Register built-in stub
adapters.set('NURSYS_STUB', new NursysStubAdapter());

/**
 * Retrieve a verification source adapter by name.
 *
 * Checks REAL_NURSYS_ENABLED when requesting the live adapter.
 * Throws if the adapter is not registered, or — in production — if the
 * resolved adapter is not decision-grade (fabricating stand-ins).
 */
export function getVerificationSource(sourceName: string): VerificationSource {
  let resolvedName = sourceName;

  // Guard: if requesting live Nursys, check env flag
  if (sourceName === 'NURSYS') {
    const enabled = process.env.REAL_NURSYS_ENABLED?.trim().toLowerCase();
    if (enabled === 'true' || enabled === '1') {
      throw new Error(
        'Real Nursys adapter not implemented. Set REAL_NURSYS_ENABLED=false or implement the live adapter.',
      );
    }
    // Fall through to NURSYS_STUB when live adapter is not enabled
    resolvedName = 'NURSYS_STUB';
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
