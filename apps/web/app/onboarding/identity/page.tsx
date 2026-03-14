'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /onboarding/identity — Identity confirmation step.
 * Reads NPI from sessionStorage (set by /onboarding) and routes to:
 *   - /onboarding/fetching  → if NPI is present (triggers real NPPES ingestion)
 *   - /onboarding           → if no NPI (restart)
 */
export default function IdentityPage() {
  const router = useRouter();

  useEffect(() => {
    const npi = sessionStorage.getItem('onboarding_npi');
    // Route through fetching (real ingestion) — not directly to readiness
    router.replace(npi ? '/onboarding/fetching' : '/onboarding');
  }, [router]);

  return (
    <div className="w-full max-w-2xl mx-auto flex min-h-[50vh] items-center justify-center">
      <p className="text-lg text-white/60">Verifying identity…</p>
    </div>
  );
}
