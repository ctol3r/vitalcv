/**
 * Admin Dashboard ViewModel Hook
 *
 * Manages state and data fetching for the admin dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { AdminDashboardState, AdminDashboardData } from '@/lib/admin/types';
import { adminDashboardApi } from '@/lib/admin/api';

export function useAdminDashboard() {
  const [state, setState] = useState<AdminDashboardState>({
    status: 'loading',
  });

  const fetchDashboardData = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const data = await adminDashboardApi.getDashboardData();
      setState({ status: 'ready', data });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      });
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  return {
    state,
    refetch: fetchDashboardData,
  };
}

