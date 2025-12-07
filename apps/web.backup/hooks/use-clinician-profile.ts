/**
 * Clinician Profile Hook
 * Manages profile state and data fetching
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ClinicianProfile } from '@/app/api/profile/me/route';

export type ProfileState = 'loading' | 'ready' | 'error';

export interface UseClinicianProfileReturn {
  profile: ClinicianProfile | null;
  state: ProfileState;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useClinicianProfile(): UseClinicianProfileReturn {
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [state, setState] = useState<ProfileState>('loading');
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/profile/me', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const data = await response.json();
      setProfile(data);
      setState('ready');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      setState('error');
      console.error('[useClinicianProfile] Error:', err);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    state,
    error,
    refresh: fetchProfile,
  };
}








