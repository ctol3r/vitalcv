'use client';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Loader2, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { buildPassportLookupHref } from '@/lib/trust/public-wedge-parity';

const COMPLIANCE_ITEMS = ['Source-backed', 'NPPES identity', 'Provenance-tracked', 'VC-compatible architecture (planned)'] as const;

const MOCK_CREDENTIALS = [
  { label: 'State License', level: 'L3', color: 'var(--claim-l3)' },
  { label: 'OIG/LEIE', level: 'L2', color: 'var(--claim-l2)' },
  { label: 'PECOS', level: 'L1', color: 'var(--claim-l1)' },
] as const;

export function HeroSection() {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedNpi = npi.replace(/\D/g, '');

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(normalizedNpi)) {
      setError('Enter a valid 10-digit NPI.');
      setShowPreview(false);
      return;
    }

    setError('');
    setIsVerifying(true);
    setShowPreview(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Show a brief local confirmation, then route to the canonical passport
    // intake where primary-source verification actually runs.
    timerRef.current = setTimeout(() => {
      setIsVerifying(false);
      setShowPreview(true);
      router.push(buildPassportLookupHref(normalizedNpi));
    }, 200);
  };

  return (
    <section className="relative px-6 pt-20 pb-24">
      <div className="noise-overlay" />

      {/* Bioluminescent glow artifact */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <div className="h-[600px] w-[600px] rounded-full bg-[var(--sage)] opacity-20 blur-[120px] animate-glow-breathe" />
      </div>

      <div className="mx-auto max-w-6xl relative z-10">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          {/* ── Left column ─────────────────────────────── */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--trust-green)]/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--trust-green)]">
              Healthcare Credentialing Reinvented
            </p>

            <h1
              style={{ fontFamily: 'var(--font-fraunces, var(--font-sans), Georgia, serif)' }}
              className="text-[clamp(2.2rem,4.8vw,4.5rem)] font-semibold leading-[1.02] tracking-tight text-[var(--warm-charcoal)]"
            >
              Start clinicians faster.
            </h1>

            <p className="max-w-2xl text-lg leading-relaxed text-[var(--warm-charcoal)]/75">
              VitalCV checks source-backed credential readiness and generates
              audit-ready packets for employer review. Data freshness varies by
              source, from daily checks to quarterly snapshots.
            </p>

            <form onSubmit={onSubmit} className="max-w-xl space-y-3">
              <label htmlFor="hero-npi-input" className="sr-only">
                NPI number
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Input
                    id="hero-npi-input"
                    inputMode="numeric"
                    type="text"
                    maxLength={10}
                    placeholder="Enter clinician NPI (10 digits)"
                    value={npi}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '');
                      setNpi(value);
                      if (error) {
                        setError('');
                      }
                    }}
                    className="bg-white/70 backdrop-blur-md dark:bg-muted border border-white/35"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'hero-npi-error' : undefined}
                  />
                  {error ? (
                    <p id="hero-npi-error" className="absolute -bottom-5 left-2 text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="gap-2"
                  disabled={isVerifying || !normalizedNpi}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    <>
                      Verify
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="gap-2 bg-card5 dark:bg-muted">
                <Link href="/demo">
                  Launch Demo
                  <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/employer/dashboard">Employer Portal</Link>
              </Button>
            </div>

            {/* ── Compliance marquee ──────────────────────── */}
            <div className="relative overflow-hidden pt-4">
              <div className="flex animate-marquee whitespace-nowrap">
                {[0, 1].map((set) => (
                  <div
                    key={set}
                    className="flex shrink-0 items-center gap-6 pr-6"
                    aria-hidden={set === 1 ? 'true' : undefined}
                  >
                    {COMPLIANCE_ITEMS.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--warm-charcoal)]/40"
                      >
                        <Shield className="h-3 w-3" />
                        {item}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Right column: NPI Terminal / Clearance State ── */}
          <motion.div
            layout
            className="rounded-3xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-muted dark:bg-muted backdrop-blur-xl p-6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, layout: { type: 'spring', stiffness: 200, damping: 30 } }}
          >
            <h2 className="font-fraunces text-2xl font-semibold tracking-tight text-[var(--warm-charcoal)]">
              Readiness preview
            </h2>
            <p className="mt-2 text-sm text-[var(--warm-charcoal)]/65">
              Source-backed readiness check runs on the next screen.
            </p>

            <AnimatePresence mode="wait">
              {isVerifying ? (
                <motion.div
                  key="loading"
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  <Skeleton className="h-48 w-full rounded-xl" />
                </motion.div>
              ) : showPreview ? (
                <motion.div
                  key="ready"
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-8"
                  role="status"
                >
                  <GlassCard
                    className="border-[var(--trust-green)]/40 ring-1 ring-[var(--trust-green)]/30 shadow-[0_0_32px_rgba(74,222,128,0.18)]"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--trust-green)]">
                      <CheckCircle2 className="h-4 w-4" />
                      Routing to the readiness surface
                    </div>
                    <p className="mt-3 text-sm text-[var(--warm-charcoal)]/80">
                      NPI <span className="font-mono">{normalizedNpi}</span> — source-backed checks and
                      freshness labels are rendered on the passport page.
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <dt className="text-xs text-[var(--warm-charcoal)]/50">Primary sources</dt>
                        <dd className="font-semibold text-[var(--warm-charcoal)]">NPPES · OIG · PECOS</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--warm-charcoal)]/50">Freshness</dt>
                        <dd className="font-semibold text-[var(--warm-charcoal)]">Labeled per source</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--warm-charcoal)]/50">Next step</dt>
                        <dd className="font-semibold text-[var(--trust-green)]">Open passport</dd>
                      </div>
                    </dl>
                  </GlassCard>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  {/* Glass identity card preview */}
                  <div className="rounded-2xl border border-[var(--warm-charcoal)]/10 bg-[var(--warm-charcoal)]/[0.02] p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[var(--warm-charcoal)]/8" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 rounded-full bg-[var(--warm-charcoal)]/10" />
                        <div className="h-2 w-20 rounded-full bg-[var(--warm-charcoal)]/6" />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {MOCK_CREDENTIALS.map((cred) => (
                        <span
                          key={cred.label}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                          style={{
                            background: `color-mix(in oklch, ${cred.color} 15%, transparent)`,
                            color: cred.color,
                          }}
                        >
                          {cred.level} {cred.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-[var(--warm-charcoal)]/6" />
                  </div>
                  <p className="mt-4 text-sm text-[var(--warm-charcoal)]/60">
                    Enter an NPI and click Verify to simulate clearance readiness.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
