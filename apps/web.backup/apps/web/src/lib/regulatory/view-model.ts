/**
 * Regulatory Portal - ViewModel
 * Task 1: RegulatoryPortalViewModel - ObservableObject equivalent
 *
 * In React/Next.js, we use a custom hook pattern instead of SwiftUI's ObservableObject
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  RegulatoryPortalState,
  RegulatoryBundle,
  StateBoardLicense,
  DEAStatus,
  CMSPECOSStatus,
  PayerEnrollment,
} from './models';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export function useRegulatoryPortal(clinicianId: string | null) {
  const [state, setState] = useState<RegulatoryPortalState>({
    loading: false,
    ready: null,
    error: null,
  });

  // Load regulatory overview
  const load = useCallback(async () => {
    if (!clinicianId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/api/regulatory/overview?clinicianId=${clinicianId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch regulatory overview');
      }

      const bundle: RegulatoryBundle = await response.json();

      setState({
        loading: false,
        ready: bundle,
        error: null,
      });
    } catch (err) {
      setState({
        loading: false,
        ready: null,
        error: err instanceof Error ? err.message : 'Failed to load regulatory data',
      });
    }
  }, [clinicianId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  // Computed properties
  const activeLicenses = useMemo(
    () => state.ready?.stateBoards.filter((l) => l.status === 'active') || [],
    [state.ready],
  );

  const expiringLicenses = useMemo(
    () =>
      state.ready?.stateBoards.filter((l) => {
        if (l.status !== 'active') return false;
        const expDate = new Date(l.expirationDate);
        const daysUntilExp = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntilExp <= 90 && daysUntilExp > 0;
      }) || [],
    [state.ready],
  );

  const deaExpiringSoon = useMemo(() => {
    if (!state.ready?.dea || state.ready.dea.status !== 'active') return false;
    const expDate = new Date(state.ready.dea.expirationDate);
    const daysUntilExp = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExp <= 30;
  }, [state.ready]);

  const activePayerEnrollments = useMemo(
    () => state.ready?.payers.filter((p) => p.enrollmentStatus === 'active') || [],
    [state.ready],
  );

  const pendingPayerEnrollments = useMemo(
    () => state.ready?.payers.filter((p) => p.enrollmentStatus === 'pending') || [],
    [state.ready],
  );

  const trustScore = useMemo(() => state.ready?.trustScore ?? 0, [state.ready]);

  return {
    ...state,
    activeLicenses,
    expiringLicenses,
    deaExpiringSoon,
    activePayerEnrollments,
    pendingPayerEnrollments,
    trustScore,
    refresh,
  };
}








