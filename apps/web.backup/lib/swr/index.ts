/**
 * SWR Module Exports
 *
 * Centralized exports for SWR-based data fetching
 */

// Fetcher utilities
export {
  fetcher,
  postFetcher,
  createAuthFetcher,
  ApiError,
  swrConfig,
  staticDataConfig,
  realtimeDataConfig,
} from './fetcher';

// Data hooks
export {
  // Session & Auth
  useSession,
  useProfile,
  // Credentials
  useCredentials,
  useCredential,
  useVerifyCredential,
  // NPI
  useNpiLookup,
  useClaimStatus,
  // Issuer
  usePendingAttestations,
  useApproveAttestation,
  // Verifier
  useVerificationHistory,
  // Utilities
  invalidateCredentials,
  invalidateCredential,
  invalidateSession,
  prefetchCredentials,
} from './hooks';
