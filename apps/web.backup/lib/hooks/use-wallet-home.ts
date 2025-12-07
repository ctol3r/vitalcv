/**
 * useWalletHome Hook
 * React hook for Wallet Home state management (replaces ViewModel)
 */

import { useCallback, useEffect, useState } from 'react';
import { CredentialRepository } from '../wallet/repository';
import { WalletCache } from '../wallet/cache';
import type { CredentialListItem, WalletHomeState } from '../wallet/types';
import { useSession } from '@/contexts/SessionContext';

export function useWalletHome() {
  const { session } = useSession();
  const [state, setState] = useState<WalletHomeState>({ type: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const loadCredentials = useCallback(async (useCache = true) => {
    // Try cache first
    if (useCache) {
      const cached = WalletCache.get();
      if (cached && cached.length > 0) {
        setState({ type: 'loaded', credentials: cached });
        // Still fetch fresh data in background
        void refreshCredentials(false);
        return;
      }
    }

    setState({ type: 'loading' });
    try {
      const credentials = await CredentialRepository.listAll();
      WalletCache.set(credentials);
      setState({ type: 'loaded', credentials });
    } catch (error) {
      console.error('[useWalletHome] Failed to load credentials:', error);
      setState({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to load credentials',
      });
    }
  }, []);

  const refreshCredentials = useCallback(async (showRefreshing = true) => {
    if (showRefreshing) setRefreshing(true);
    try {
      WalletCache.invalidate();
      const credentials = await CredentialRepository.listAll();
      WalletCache.set(credentials);
      setState({ type: 'loaded', credentials });
    } catch (error) {
      console.error('[useWalletHome] Failed to refresh credentials:', error);
      setState({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to refresh credentials',
      });
    } finally {
      if (showRefreshing) setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadCredentials(true);
  }, [loadCredentials]);

  // Real-time sync via polling (can be upgraded to WebSocket/SSE later)
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshCredentials(false);
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [refreshCredentials]);

  return {
    state,
    refreshing,
    refresh: () => refreshCredentials(true),
    reload: () => loadCredentials(false),
  };
}








