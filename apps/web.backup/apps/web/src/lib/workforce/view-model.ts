/**
 * Workforce Command Center - ViewModel
 * Task 1: WorkforceDashboardViewModel - ObservableObject @MainActor equivalent
 *
 * In React/Next.js, we use a custom hook pattern instead of SwiftUI's ObservableObject
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  WorkforceDashboardState,
  WorkforceDashboardData,
  WorkforceOverview,
  CredentialProportions,
  SpecialtyDistribution,
  RoleCoverage,
} from './models';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface WorkforceDashboardViewModelState {
  state: WorkforceDashboardState;
  data: WorkforceDashboardData | null;
  error: string | null;
  lastRefreshed: string | null;
}

export function useWorkforceDashboard() {
  const [viewModelState, setViewModelState] = useState<WorkforceDashboardViewModelState>({
    state: 'loading',
    data: null,
    error: null,
    lastRefreshed: null,
  });

  // Load workforce dashboard data
  const load = useCallback(async () => {
    setViewModelState((prev) => ({ ...prev, state: 'loading', error: null }));

    try {
      const response = await fetch(`${API_BASE}/api/workforce/dashboard`);
      if (!response.ok) {
        throw new Error(`Failed to fetch workforce data: ${response.statusText}`);
      }

      const data: WorkforceDashboardData = await response.json();

      setViewModelState({
        state: 'ready',
        data,
        error: null,
        lastRefreshed: new Date().toISOString(),
      });
    } catch (err) {
      setViewModelState({
        state: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to load workforce data',
        lastRefreshed: null,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  // Computed properties
  const overview = useMemo(() => viewModelState.data?.overview || null, [viewModelState.data]);
  const credentialProportions = useMemo(
    () => viewModelState.data?.credentialProportions || null,
    [viewModelState.data],
  );
  const specialtyDistribution = useMemo(
    () => viewModelState.data?.specialtyDistribution || [],
    [viewModelState.data],
  );
  const roleCoverage = useMemo(() => viewModelState.data?.roleCoverage || [], [viewModelState.data]);

  const isLoading = useMemo(() => viewModelState.state === 'loading', [viewModelState.state]);
  const isReady = useMemo(() => viewModelState.state === 'ready', [viewModelState.state]);
  const hasError = useMemo(() => viewModelState.state === 'error', [viewModelState.state]);

  return {
    // State
    state: viewModelState.state,
    data: viewModelState.data,
    error: viewModelState.error,
    lastRefreshed: viewModelState.lastRefreshed,
    isLoading,
    isReady,
    hasError,

    // Computed
    overview,
    credentialProportions,
    specialtyDistribution,
    roleCoverage,

    // Actions
    refresh,
  };
}








