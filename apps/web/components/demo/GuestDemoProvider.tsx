'use client';

/**
 * GuestDemoProvider.tsx — Wave 64: Guest Demo Mode
 *
 * When ?demo=true is present, provides simulated data context
 * instead of requiring authentication. Wraps /holder and /verifier.
 */

import { createContext, useContext, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────

interface DemoCredential {
  id: string;
  source: string;
  status: string;
  lifecycleState: string;
  verifiedAt: string;
  expiresAt: string | null;
}

interface DemoTrustState {
  npi: string;
  crsScore: number;
  crsBand: string;
  credentials: DemoCredential[];
}

interface GuestDemoContextValue {
  isDemoMode: boolean;
  trustState: DemoTrustState;
}

// ── Demo Data ─────────────────────────────────────────────────────────────

const DEMO_TRUST_STATE: DemoTrustState = {
  npi: '9999999999',
  crsScore: 87,
  crsBand: 'GREEN',
  credentials: [
    { id: 'demo-1', source: 'State Medical License', status: 'active', lifecycleState: 'PSV_COMPLETE', verifiedAt: '2026-02-15T10:00:00Z', expiresAt: '2027-06-30T00:00:00Z' },
    { id: 'demo-2', source: 'DEA Registration', status: 'active', lifecycleState: 'VERIFIED', verifiedAt: '2026-02-15T10:05:00Z', expiresAt: '2028-01-15T00:00:00Z' },
    { id: 'demo-3', source: 'Board Certification (ABMS)', status: 'active', lifecycleState: 'PSV_COMPLETE', verifiedAt: '2026-02-15T10:10:00Z', expiresAt: null },
    { id: 'demo-4', source: 'Hospital Privileges', status: 'active', lifecycleState: 'VERIFIED', verifiedAt: '2026-02-15T10:15:00Z', expiresAt: '2026-12-31T00:00:00Z' },
    { id: 'demo-5', source: 'Malpractice Insurance', status: 'active', lifecycleState: 'SELF_ATTESTED', verifiedAt: '2026-02-15T10:20:00Z', expiresAt: '2027-03-01T00:00:00Z' },
  ],
};

// ── Context ───────────────────────────────────────────────────────────────

const GuestDemoContext = createContext<GuestDemoContextValue>({
  isDemoMode: false,
  trustState: DEMO_TRUST_STATE,
});

export function useGuestDemo(): GuestDemoContextValue {
  return useContext(GuestDemoContext);
}

// ── Provider ──────────────────────────────────────────────────────────────

export function GuestDemoProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isDemoMode = searchParams.get('demo') === 'true';

  const value = useMemo<GuestDemoContextValue>(() => ({
    isDemoMode,
    trustState: DEMO_TRUST_STATE,
  }), [isDemoMode]);

  return (
    <GuestDemoContext.Provider value={value}>
      {children}
    </GuestDemoContext.Provider>
  );
}

export default GuestDemoProvider;
