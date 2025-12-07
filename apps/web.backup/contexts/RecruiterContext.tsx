'use client';

/**
 * Recruiter Context - Manages recruiter-specific state and profile
 * Phase 1: Foundation & Navigation
 */

import { ReactNode, createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from './SessionContext';

export type RecruiterState = 'loading' | 'ready' | 'error';

export interface RecruiterProfile {
  recruiterId: string;
  email: string;
  name?: string;
  organizationId?: string;
  organizationName?: string;
  permissions: RecruiterPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface RecruiterPermissions {
  canViewCandidates: boolean;
  canVerifyCredentials: boolean;
  canMatchJobs: boolean;
  canSharePackets: boolean;
  canAccessAnalytics: boolean;
  readOnlyFields: string[];
  allowedActions: string[];
}

export interface RecruiterHomeState {
  state: RecruiterState;
  profile: RecruiterProfile | null;
  error: string | null;
}

interface RecruiterContextValue {
  recruiterState: RecruiterHomeState;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  hasPermission: (action: string) => boolean;
}

const RecruiterContext = createContext<RecruiterContextValue | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export function RecruiterProvider({ children }: { children: ReactNode }) {
  const { session, hasRole } = useSession();
  const [recruiterState, setRecruiterState] = useState<RecruiterHomeState>({
    state: 'loading',
    profile: null,
    error: null,
  });

  const isRecruiter = hasRole('recruiter');

  const fetchProfile = useCallback(async () => {
    if (!isRecruiter || !session?.userId) {
      setRecruiterState({
        state: 'ready',
        profile: null,
        error: null,
      });
      return;
    }

    setRecruiterState((prev) => ({ ...prev, state: 'loading', error: null }));

    try {
      const response = await fetch(`${API_BASE}/api/recruiter/profile`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        // If 404, create a default profile
        if (response.status === 404) {
          const defaultProfile: RecruiterProfile = {
            recruiterId: session.userId,
            email: session.email,
            permissions: {
              canViewCandidates: true,
              canVerifyCredentials: true,
              canMatchJobs: true,
              canSharePackets: true,
              canAccessAnalytics: true,
              readOnlyFields: [],
              allowedActions: ['view', 'verify', 'match', 'share'],
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setRecruiterState({
            state: 'ready',
            profile: defaultProfile,
            error: null,
          });
          return;
        }
        throw new Error(`Failed to fetch recruiter profile: ${response.status}`);
      }

      const data = await response.json();
      const profile: RecruiterProfile = {
        recruiterId: data.recruiterId || session.userId,
        email: data.email || session.email,
        name: data.name,
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        permissions: data.permissions || {
          canViewCandidates: true,
          canVerifyCredentials: true,
          canMatchJobs: true,
          canSharePackets: true,
          canAccessAnalytics: true,
          readOnlyFields: data.readOnlyFields || [],
          allowedActions: data.allowedActions || ['view', 'verify', 'match', 'share'],
        },
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      setRecruiterState({
        state: 'ready',
        profile,
        error: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load recruiter profile';
      setRecruiterState({
        state: 'error',
        profile: null,
        error: errorMessage,
      });
    }
  }, [isRecruiter, session]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const hasPermission = useCallback(
    (action: string): boolean => {
      if (!recruiterState.profile) return false;
      return recruiterState.profile.permissions.allowedActions.includes(action);
    },
    [recruiterState.profile],
  );

  return (
    <RecruiterContext.Provider
      value={{
        recruiterState,
        isLoading: recruiterState.state === 'loading',
        refreshProfile: fetchProfile,
        hasPermission,
      }}
    >
      {children}
    </RecruiterContext.Provider>
  );
}

export function useRecruiter() {
  const context = useContext(RecruiterContext);
  if (context === undefined) {
    throw new Error('useRecruiter must be used within a RecruiterProvider');
  }
  return context;
}




