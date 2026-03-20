'use client';

import { useRoleContext } from '@/components/auth/RoleContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Opportunity {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  organizationName?: string;
}

interface Props {
  opportunity: Opportunity | null;
  onClose: () => void;
}

interface TrustStateResponse {
  readiness_score?: number;
  readiness_level?: string;
  readiness_status?: string;
  gap_summary?: string[];
}

type Phase = 'form' | 'submitting' | 'success' | 'error';

export default function ApplyModal({ opportunity, onClose }: Props) {
  const {
    clinicianNpi,
    isClinician,
    isLoaded,
    isSignedIn,
    role,
  } = useRoleContext();
  const [coverNote, setCoverNote] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingTrustState, setLoadingTrustState] = useState(false);
  const [trustState, setTrustState] = useState<TrustStateResponse | null>(null);

  const returnUrl = useMemo(
    () => `/explore?apply=${encodeURIComponent(opportunity?.id ?? '')}`,
    [opportunity?.id],
  );
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`;
  const onboardingHref = `/onboarding?returnTo=${encodeURIComponent(returnUrl)}`;

  useEffect(() => {
    if (!clinicianNpi || !isSignedIn || !isClinician) {
      setTrustState(null);
      return;
    }

    setLoadingTrustState(true);
    void fetch(`/api/trust-state/${encodeURIComponent(clinicianNpi)}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load readiness.');
        }

        const payload = await response.json() as TrustStateResponse;
        setTrustState(payload);
      })
      .catch(() => {
        setTrustState(null);
      })
      .finally(() => {
        setLoadingTrustState(false);
      });
  }, [clinicianNpi, isClinician, isSignedIn]);

  if (!opportunity) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!clinicianNpi || !opportunity) {
      return;
    }

    setPhase('submitting');
    setErrorMsg('');

    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npi: clinicianNpi,
          coverNote: coverNote.trim() || undefined,
        }),
      });

      if (response.ok || response.status === 409) {
        setPhase('success');
        return;
      }

      const payload = await response.json().catch(() => ({})) as { error?: string };
      setErrorMsg(payload.error ?? 'Something went wrong. Please try again.');
      setPhase('error');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setPhase('error');
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="flex items-start justify-between border-b border-zinc-100 p-6 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Apply with VitalCV</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {opportunity.title} · {opportunity.state}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-zinc-600">
                {opportunity.specialty}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-zinc-600">
                {opportunity.hiringType}
              </span>
              {opportunity.organizationName ? (
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-zinc-600">
                  {opportunity.organizationName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="p-6">
            {phase === 'success' ? (
              <motion.div
                className="space-y-4 py-4 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Application submitted</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    The employer can review your readiness, credentials, and trust signals immediately.
                  </p>
                </div>
                <div className="space-y-3">
                  <Link
                    href="/holder/home"
                    className="glue-btn glue-btn-primary w-full justify-center"
                    onClick={onClose}
                  >
                    Open my dashboard
                  </Link>
                  <button
                    onClick={onClose}
                    className="glue-btn w-full justify-center border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  >
                    Keep browsing
                  </button>
                </div>
              </motion.div>
            ) : !isLoaded ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : !isSignedIn ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-semibold text-zinc-900">Sign in to apply</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    We&apos;ll bring you back to this job and apply using your verified clinician profile.
                  </p>
                </div>
                <Link href={signInHref} className="glue-btn glue-btn-primary w-full justify-center">
                  Sign in and continue
                </Link>
              </div>
            ) : !isClinician || role === 'employer' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                  <p className="text-sm font-semibold text-zinc-900">Switch to your clinician workspace</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Applications only submit from a clinician profile with an active NPI.
                  </p>
                </div>
                <Link href="/workspace/switch" className="glue-btn glue-btn-primary w-full justify-center">
                  Open workspace switcher
                </Link>
              </div>
            ) : !clinicianNpi ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-zinc-900">Finish onboarding to apply</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    We need your NPI-linked clinician profile before this employer can review you.
                  </p>
                </div>
                <Link href={onboardingHref} className="glue-btn glue-btn-primary w-full justify-center">
                  Complete onboarding
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-500" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-zinc-900">
                        Applying as NPI {clinicianNpi}
                      </p>
                      <p className="text-sm text-zinc-600">
                        This application uses your signed-in clinician workspace, not a manual NPI field.
                      </p>
                      {loadingTrustState ? (
                        <p className="text-xs text-zinc-500">Loading readiness…</p>
                      ) : trustState ? (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Readiness {trustState.readiness_level ?? 'L0'} · {trustState.readiness_score ?? 0}/100
                          </p>
                          <p className="text-xs text-zinc-600">
                            {trustState.readiness_status ?? 'Readiness will be attached when you submit.'}
                          </p>
                          {(trustState.gap_summary ?? []).slice(0, 2).map((gap) => (
                            <p key={gap} className="text-xs text-zinc-500">
                              • {gap}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Your latest readiness state will be attached automatically.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Cover note <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <textarea
                    value={coverNote}
                    onChange={(event) => setCoverNote(event.target.value)}
                    rows={3}
                    placeholder="Briefly introduce yourself or highlight relevant experience…"
                    className="glue-input glue-input--emerald resize-none"
                  />
                </div>

                {phase === 'error' ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMsg}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={phase === 'submitting'}
                  className="glue-btn glue-btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Apply with VitalCV
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {(trustState?.gap_summary?.length ?? 0) > 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Employers will still see your missing credentials and current readiness after you apply.</p>
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-zinc-400">
                    Your readiness and trust signals travel with this application automatically.
                  </p>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
