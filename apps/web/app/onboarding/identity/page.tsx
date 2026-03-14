'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IdentityPage() {
  const router = useRouter();

  useEffect(() => {
    const npi = sessionStorage.getItem('onboarding_npi');
    router.replace(npi ? '/onboarding/readiness' : '/onboarding');
  }, [router]);

  return (
    <div className="w-full max-w-2xl mx-auto flex min-h-[50vh] items-center justify-center">
      <p className="text-lg text-white/60">Redirecting to activation…</p>
    </div>
  );
}
