'use client';

/**
 * usePresentationPolling — Wave 49: OIDC4VP Presentation Polling
 *
 * Polls the OIDC4VP status endpoint to track presentation request lifecycle.
 * Automatically stops when the request reaches a terminal state (COMPLETED | EXPIRED).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────

export interface DisclosedClaim {
  name: string;
  value: string | number | boolean;
  salt: string;
  hash: string;
}

export type PresentationStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'ERROR';

interface PresentationPollingResult {
  status: PresentationStatus;
  claims: DisclosedClaim[] | null;
  error: string | null;
}

interface PresentationPollingOptions {
  intervalMs?: number;
  enabled?: boolean;
}

interface StatusResponse {
  requestId: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  claims: DisclosedClaim[] | null;
}

// ── Hook ───────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 2000;

export function usePresentationPolling(
  requestId: string,
  options?: PresentationPollingOptions,
): PresentationPollingResult {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;

  const [status, setStatus] = useState<PresentationStatus>('PENDING');
  const [claims, setClaims] = useState<DisclosedClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track whether we should continue polling.
  // Terminal states: COMPLETED, EXPIRED, ERROR
  const isTerminal = status === 'COMPLETED' || status === 'EXPIRED' || status === 'ERROR';

  // Use refs to avoid stale closures in the interval callback
  const requestIdRef = useRef(requestId);
  requestIdRef.current = requestId;

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/oidc/status/${requestIdRef.current}`);

      if (!res.ok) {
        setError(`Status check failed: ${res.status}`);
        setStatus('ERROR');
        return;
      }

      const data = (await res.json()) as StatusResponse;

      setStatus(data.status);
      if (data.status === 'COMPLETED' && data.claims) {
        setClaims(data.claims);
      }
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      setStatus('ERROR');
    }
  }, []);

  useEffect(() => {
    if (!enabled || isTerminal || !requestId) {
      return;
    }

    // Poll immediately on mount, then at the configured interval
    void poll();

    const intervalId = setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isTerminal, requestId, intervalMs, poll]);

  // Reset state when requestId changes
  useEffect(() => {
    setStatus('PENDING');
    setClaims(null);
    setError(null);
  }, [requestId]);

  return { status, claims, error };
}
