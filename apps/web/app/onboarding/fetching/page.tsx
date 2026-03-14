'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  'Locating NPPES identity...',
  'Verifying state medical licenses...',
  'Checking sanctions and exclusions...',
  'Compiling Trust Passport...',
];

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface StepState {
  label: string;
  status: StepStatus;
}

interface TrustStateResult {
  readiness_level: 'L0' | 'L1' | 'L2' | 'L3';
  readiness_score: number;
  readiness_status: string;
  gap_summary: string[];
  npi: string;
  computedAt: string;
}

async function runIngestion(npi: string): Promise<{ ok: boolean; trustState?: TrustStateResult }> {
  const [bootstrapRes, ingestRes] = await Promise.allSettled([
    fetch('/api/profile/npi/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi }),
    }),
    fetch('/api/credentials/ingest-npi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi }),
    }),
  ]);

  const bootstrapOk =
    bootstrapRes.status === 'fulfilled' && bootstrapRes.value.ok;
  const ingestOk =
    ingestRes.status === 'fulfilled' &&
    (ingestRes.value.ok || ingestRes.value.status === 409);

  if (!bootstrapOk && !ingestOk) {
    return { ok: false };
  }

  try {
    const tsRes = await fetch(`/api/trust-state/${encodeURIComponent(npi)}`);
    if (tsRes.ok) {
      const trustState = (await tsRes.json()) as TrustStateResult;
      return { ok: true, trustState };
    }
  } catch {
    // non-blocking
  }

  return { ok: true };
}

export default function FetchingPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<StepState[]>(
    STEPS.map((label) => ({ label, status: 'pending' as StepStatus })),
  );
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const npi = sessionStorage.getItem('onboarding_npi') ?? '';
    if (!npi || !/^\d{10}$/.test(npi)) {
      router.push('/onboarding/readiness');
      return;
    }

    // Stagger step UI
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx < i ? 'done' : idx === i ? 'running' : 'pending',
          })),
        );
      }, i * 400);
    });

    runIngestion(npi).then(({ ok, trustState }) => {
      setSteps((prev) => prev.map((s) => ({ ...s, status: ok ? 'done' : 'error' })));
      if (trustState) {
        sessionStorage.setItem('onboarding_trust_state', JSON.stringify(trustState));
      }
      sessionStorage.setItem('onboarding_ingestion_ok', String(ok));
      setTimeout(() => router.push('/onboarding/readiness'), 600);
    });
  }, [router]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
      <div className="relative w-32 h-32 mb-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
        <div className="absolute inset-0 rounded-full border border-emerald-500/10 scale-150" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-full bg-emerald-400 blur-xl opacity-50"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-t-2 border-emerald-400"
        />
      </div>

      <div className="flex flex-col gap-3 w-full text-center">
        <AnimatePresence mode="popLayout">
          {steps.map((step) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: step.status === 'pending' ? 0.25 : 1, y: 0 }}
              className="flex items-center justify-center gap-3"
            >
              <span className="text-sm w-4">
                {step.status === 'done' && '✓'}
                {step.status === 'running' && '⋯'}
                {step.status === 'error' && '✗'}
                {step.status === 'pending' && '·'}
              </span>
              <p className={`text-lg md:text-xl font-medium transition-colors ${
                step.status === 'done' ? 'text-emerald-400'
                  : step.status === 'running' ? 'text-white'
                  : step.status === 'error' ? 'text-red-400'
                  : 'text-white/30'
              }`}>
                {step.label}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
