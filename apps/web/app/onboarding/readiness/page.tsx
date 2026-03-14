'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ResolverProgressIndicator } from '@/components/onboarding/ResolverProgressIndicator';

interface ActivationResult {
  readinessScore: number;
  readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
  readinessStatus: string;
}

async function runActivation(npi: string): Promise<{ ok: boolean; readiness?: ActivationResult }> {
  try {
    const res = await fetch('/api/clinician/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi }),
    });

    if (!res.ok) {
      return { ok: false };
    }

    return {
      ok: true,
      readiness: (await res.json()) as ActivationResult,
    };
  } catch {
    return { ok: false };
  }
}

export default function ReadinessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const npi = sessionStorage.getItem('onboarding_npi') ?? '';
    if (!npi || !/^\d{10}$/.test(npi)) {
      router.replace('/onboarding');
      return;
    }

    runActivation(npi).then(({ ok, readiness }) => {
      if (!ok || !readiness) {
        setError('Activation failed. Please retry your NPI onboarding.');
        setLoading(false);
        return;
      }

      sessionStorage.setItem('onboarding_activation', JSON.stringify({
        npi,
        ...readiness,
      }));

      setTimeout(() => {
        router.push('/holder/readiness');
      }, 600);
    });
  }, [router]);

  return (
    <div className="w-full flex-col flex items-center justify-center min-h-[50vh]">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full flex justify-center"
          >
            <ResolverProgressIndicator 
              durationPerStep={800} 
            />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center"
          >
            <p className="text-xl font-semibold text-white">Activation failed</p>
            <p className="mt-3 text-white/60">{error}</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900"
            >
              Start over
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
