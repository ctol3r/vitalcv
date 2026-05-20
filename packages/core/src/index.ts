/**
 * @vitalcv/core — cross-app shared services.
 */

// NPPES resolver (WAVE C77)
export {
  NPPES_API_BASE,
  NPPES_API_VERSION,
  NPPES_DEFAULT_TIMEOUT_MS,
  isValidNpiChecksum,
  projectMinimalDto,
  resolveNppes,
} from './services/nppesResolver';
export type {
  NppesProviderDto,
  NppesResolutionOutcome,
  NppesResolverDeps,
} from './services/nppesResolver';
