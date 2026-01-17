/**
 * @vitalcv/runtime-mode
 *
 * Runtime mode detection and enforcement for test/dev/prod environments.
 *
 * @packageDocumentation
 */

export {
  detectRuntimeMode,
  isTestMode,
  isProdMode,
  isDevMode,
  assertNoNetwork,
  getNetworkTimeout,
} from './mode';
export type { RuntimeMode } from './mode';

export {
  NetworkServiceAdapter,
  createModeAwareAdapter,
} from './adapters';
export type { ServiceAdapter } from './adapters';
