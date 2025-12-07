'use client';

/**
 * Verifier Dashboard Hook
 * React equivalent of VerifierDashboardViewModel
 * Manages dashboard state, data fetching, and operations
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import type {
  DashboardState,
  VerifierDashboardOverview,
  ProviderListItem,
  VerificationQueueItem,
  ComplianceAlert,
  ChainAuditEvent,
} from '@/lib/verifier-dashboard-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface UseVerifierDashboardReturn {
  state: DashboardState;
  overview: VerifierDashboardOverview | null;
  providers: ProviderListItem[];
  queue: VerificationQueueItem[];
  alerts: ComplianceAlert[];
  auditEvents: ChainAuditEvent[];
  error: string | null;
  refresh: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  refreshAudit: () => Promise<void>;
}

export function useVerifierDashboard(): UseVerifierDashboardReturn {
  const { canAccessVerifier } = useSession();
  const [state, setState] = useState<DashboardState>('loading');
  const [overview, setOverview] = useState<VerifierDashboardOverview | null>(null);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [queue, setQueue] = useState<VerificationQueueItem[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [auditEvents, setAuditEvents] = useState<ChainAuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!canAccessVerifier()) {
      setError('Access denied: Verifier role required');
      setState('error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/verifier/dashboard/overview`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch overview: ${response.status}`);
      }

      const data = await response.json();
      setOverview(data);
      setError(null);
    } catch (err) {
      console.error('[dashboard] Failed to fetch overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard overview');
      // Set fallback data for development
      setOverview({
        totalProviders: 0,
        activeCredentials: 0,
        expiringSoon: 0,
        pendingVerification: 0,
        complianceAlerts: 0,
        chainAnchors: { total: 0, stale: 0, valid: 0 },
        recentActivity: [],
      });
    }
  }, [canAccessVerifier]);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/verifier/dashboard/providers`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.status}`);
      }

      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error('[dashboard] Failed to fetch providers:', err);
      setProviders([]);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/verifier/dashboard/queue`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch queue: ${response.status}`);
      }

      const data = await response.json();
      setQueue(data.items || []);
    } catch (err) {
      console.error('[dashboard] Failed to fetch queue:', err);
      setQueue([]);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/verifier/dashboard/compliance-alerts`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alerts: ${response.status}`);
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('[dashboard] Failed to fetch alerts:', err);
      setAlerts([]);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/verifier/dashboard/chain-audit`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audit events: ${response.status}`);
      }

      const data = await response.json();
      setAuditEvents(data.events || []);
    } catch (err) {
      console.error('[dashboard] Failed to fetch audit events:', err);
      setAuditEvents([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setState('loading');
    setError(null);
    await Promise.all([
      fetchOverview(),
      fetchProviders(),
      fetchQueue(),
      fetchAlerts(),
      fetchAudit(),
    ]);
    setState('ready');
  }, [fetchOverview, fetchProviders, fetchQueue, fetchAlerts, fetchAudit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    overview,
    providers,
    queue,
    alerts,
    auditEvents,
    error,
    refresh,
    refreshProviders: fetchProviders,
    refreshQueue: fetchQueue,
    refreshAlerts: fetchAlerts,
    refreshAudit: fetchAudit,
  };
}

