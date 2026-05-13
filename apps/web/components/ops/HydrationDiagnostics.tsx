'use client';

/**
 * HydrationDiagnostics.tsx — Client-side upstream probe for operator diagnostics.
 *
 * On mount, pings:
 *   1. /api/health           → backend reachable
 *   2. NPPES registry        → NPPES reachable
 *   3. Clerk session         → auth active
 *
 * Used in degraded mode to surface WHY hydration failed.
 */

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';

export interface HydrationDiagnosticsProps {
  passportEndpointReachable?: boolean;
  nppesReachable?: boolean;
  backendApiReachable?: boolean;
  clerkSessionActive?: boolean;
}

type ProbeStatus = 'pending' | 'ok' | 'error' | 'timeout';

interface ProbeResult {
  label: string;
  status: ProbeStatus;
  detail: string | null;
}

function statusIcon(status: ProbeStatus): string {
  switch (status) {
    case 'pending': return '○';
    case 'ok':      return '●';
    case 'error':   return '✗';
    case 'timeout': return '⚠';
  }
}

function statusClass(status: ProbeStatus): string {
  switch (status) {
    case 'pending': return 'text-gray-400 font-mono text-[10px]';
    case 'ok':      return 'text-green-600 font-mono text-[10px]';
    case 'error':   return 'text-red-600 font-mono text-[10px]';
    case 'timeout': return 'text-amber-600 font-mono text-[10px]';
  }
}

const PROBE_TIMEOUT_MS = 5000;

async function probeUrl(url: string): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'unknown error';
    const isTimeout = msg.includes('abort') || msg.includes('timeout');
    return { ok: false, detail: isTimeout ? 'timeout' : msg };
  }
}

export function HydrationDiagnostics({
  passportEndpointReachable,
  nppesReachable,
  backendApiReachable,
  clerkSessionActive,
}: HydrationDiagnosticsProps) {
  const { isSignedIn, isLoaded } = useAuth();

  const [probes, setProbes] = React.useState<ProbeResult[]>([
    { label: 'Backend API (/api/health)',   status: 'pending', detail: null },
    { label: 'NPPES Registry',              status: 'pending', detail: null },
    { label: 'Clerk Session',               status: 'pending', detail: null },
    { label: 'Passport Endpoint',           status: 'pending', detail: null },
  ]);

  const updateProbe = React.useCallback((index: number, update: Partial<ProbeResult>) => {
    setProbes((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...update } : p)),
    );
  }, []);

  React.useEffect(() => {
    // If initial props are provided, use them to skip probes
    if (backendApiReachable !== undefined) {
      updateProbe(0, {
        status: backendApiReachable ? 'ok' : 'error',
        detail: backendApiReachable ? 'provided' : 'provided: unreachable',
      });
    } else {
      // Probe /api/health
      probeUrl('/api/health').then(({ ok, detail }) => {
        updateProbe(0, { status: ok ? 'ok' : 'error', detail });
      });
    }

    if (nppesReachable !== undefined) {
      updateProbe(1, {
        status: nppesReachable ? 'ok' : 'error',
        detail: nppesReachable ? 'provided' : 'provided: unreachable',
      });
    } else {
      // Probe NPPES registry
      probeUrl(
        'https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=1',
      ).then(({ ok, detail }) => {
        updateProbe(1, { status: ok ? 'ok' : 'error', detail });
      });
    }

    if (passportEndpointReachable !== undefined) {
      updateProbe(3, {
        status: passportEndpointReachable ? 'ok' : 'error',
        detail: passportEndpointReachable ? 'provided' : 'provided: unreachable',
      });
    } else {
      probeUrl('/api/passport').then(({ ok, detail }) => {
        // 401/403 = endpoint exists, just needs auth
        updateProbe(3, {
          status: ok || detail === 'HTTP 401' || detail === 'HTTP 403' ? 'ok' : 'error',
          detail,
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clerk session check via hook
  React.useEffect(() => {
    if (!isLoaded) return;
    if (clerkSessionActive !== undefined) {
      updateProbe(2, {
        status: clerkSessionActive ? 'ok' : 'error',
        detail: clerkSessionActive ? 'active' : 'no session',
      });
    } else {
      updateProbe(2, {
        status: isSignedIn ? 'ok' : 'error',
        detail: isSignedIn ? 'signed in' : 'not signed in',
      });
    }
  }, [isLoaded, isSignedIn, clerkSessionActive, updateProbe]);

  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          HYDRATION DIAGNOSTICS
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 border-b border-gray-100 px-4 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">PROBE</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400 text-center">STATUS</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">DETAIL</span>
      </div>

      {/* Probe rows */}
      <div className="divide-y divide-gray-50">
        {probes.map((probe) => (
          <div key={probe.label} className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4 py-2 items-center">
            <span className="font-mono text-[10px] text-gray-700">{probe.label}</span>
            <span className={statusClass(probe.status)}>
              {statusIcon(probe.status)}{' '}
              {probe.status === 'pending'
                ? 'PROBING'
                : probe.status === 'ok'
                  ? 'REACHABLE'
                  : probe.status === 'timeout'
                    ? 'TIMEOUT'
                    : 'UNREACHABLE'}
            </span>
            <span className="font-mono text-[10px] text-gray-500">
              {probe.detail ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="border-t border-gray-100 px-4 py-1">
        <span className="font-mono text-[9px] text-gray-300">
          probes run on client mount · timeout {PROBE_TIMEOUT_MS}ms
        </span>
      </div>
    </div>
  );
}
