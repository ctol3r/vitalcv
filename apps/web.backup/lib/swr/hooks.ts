/**
 * SWR Hooks for VitalCV
 *
 * Custom hooks for data fetching with SWR
 */

import useSWR, { mutate as globalMutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { fetcher, postFetcher, staticDataConfig, realtimeDataConfig, ApiError } from './fetcher';

// ============================================
// Types
// ============================================

interface Credential {
  id: string;
  type: string;
  status: 'active' | 'pending' | 'revoked' | 'expired';
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  claims?: Record<string, unknown>;
}

interface User {
  id: string;
  email: string;
  role: 'holder' | 'issuer' | 'verifier' | 'recruiter' | 'admin';
  name?: string;
  npi?: string;
}

interface Session {
  user: User;
  expiresAt: string;
}

interface NpiLookupResult {
  npi: string;
  name: string;
  specialty?: string;
  address?: {
    city: string;
    state: string;
  };
  status: 'active' | 'inactive';
}

interface ClaimStatus {
  level: 0 | 1 | 2 | 3;
  status: 'unclaimed' | 'basic' | 'verified' | 'attested';
  lastUpdated: string;
}

interface VerificationResult {
  valid: boolean;
  credential?: Credential;
  reason?: string;
}

// ============================================
// Session & Auth Hooks
// ============================================

/**
 * Hook for current user session
 */
export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<Session>(
    '/api/auth/session',
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    }
  );

  return {
    session: data,
    user: data?.user,
    isLoading,
    isAuthenticated: !!data?.user,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

/**
 * Hook for user profile
 */
export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<User>(
    '/api/user/profile',
    fetcher
  );

  return {
    profile: data,
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

// ============================================
// Credential Hooks
// ============================================

/**
 * Hook for user's credentials list
 */
export function useCredentials() {
  const { data, error, isLoading, mutate } = useSWR<{ credentials: Credential[] }>(
    '/api/credentials',
    fetcher
  );

  return {
    credentials: data?.credentials || [],
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

/**
 * Hook for single credential details
 */
export function useCredential(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Credential>(
    id ? `/api/credentials/${id}` : null,
    fetcher
  );

  return {
    credential: data,
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

/**
 * Hook for credential verification
 */
export function useVerifyCredential() {
  const { trigger, isMutating, error, data } = useSWRMutation<
    VerificationResult,
    ApiError,
    string,
    { credentialId: string }
  >(
    '/api/verify',
    async (url, { arg }) => postFetcher(url, arg)
  );

  return {
    verify: trigger,
    isVerifying: isMutating,
    result: data,
    error,
  };
}

// ============================================
// NPI Hooks
// ============================================

/**
 * Hook for NPI lookup
 */
export function useNpiLookup(npi: string | null) {
  const { data, error, isLoading } = useSWR<NpiLookupResult>(
    npi && npi.length === 10 ? `/api/npi/lookup?npi=${npi}` : null,
    fetcher,
    staticDataConfig
  );

  return {
    provider: data,
    isLoading,
    error: error as ApiError | undefined,
    isNotFound: (error as ApiError)?.isNotFound,
  };
}

/**
 * Hook for claim status
 */
export function useClaimStatus(npi: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ClaimStatus>(
    npi ? `/api/claims/${npi}/status` : null,
    fetcher,
    realtimeDataConfig
  );

  return {
    claimStatus: data,
    level: data?.level ?? 0,
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

// ============================================
// Issuer Hooks
// ============================================

/**
 * Hook for pending attestation requests (issuer view)
 */
export function usePendingAttestations() {
  const { data, error, isLoading, mutate } = useSWR<{ requests: any[] }>(
    '/api/issuer/attestations/pending',
    fetcher,
    realtimeDataConfig
  );

  return {
    requests: data?.requests || [],
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

/**
 * Hook for approving attestation
 */
export function useApproveAttestation() {
  const { trigger, isMutating, error } = useSWRMutation<
    { success: boolean },
    ApiError,
    string,
    { requestId: string; approved: boolean; reason?: string }
  >(
    '/api/issuer/attestations/approve',
    async (url, { arg }) => postFetcher(url, arg)
  );

  return {
    approve: trigger,
    isApproving: isMutating,
    error,
  };
}

// ============================================
// Verifier Hooks
// ============================================

/**
 * Hook for verification history
 */
export function useVerificationHistory() {
  const { data, error, isLoading, mutate } = useSWR<{ verifications: any[] }>(
    '/api/verifier/history',
    fetcher
  );

  return {
    verifications: data?.verifications || [],
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Invalidate all credentials cache
 */
export function invalidateCredentials() {
  globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/credentials'));
}

/**
 * Invalidate specific credential
 */
export function invalidateCredential(id: string) {
  globalMutate(`/api/credentials/${id}`);
}

/**
 * Invalidate session
 */
export function invalidateSession() {
  globalMutate('/api/auth/session');
}

/**
 * Prefetch credentials for faster navigation
 */
export function prefetchCredentials() {
  globalMutate('/api/credentials', fetcher('/api/credentials'));
}
