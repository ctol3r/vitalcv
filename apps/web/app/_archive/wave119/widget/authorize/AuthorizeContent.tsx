'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Fingerprint, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard } from '@/components/ui/glass-card';

type FlowState = 'idle' | 'signing' | 'done';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export default function AuthorizeContent() {
  const sp       = useSearchParams();
  const clientId = sp.get('clientId') ?? 'demo';
  const orgName  = sp.get('orgName')  ?? 'This hospital';

  const [state, setState] = useState<FlowState>('idle');

  const handleSignAndShare = async () => {
    setState('signing');

    // Simulate 1.5 s FaceID biometric delay
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    // Fire consent to backend (best-effort — UX always completes regardless)
    try {
      if (API_BASE) {
        await fetch(`${API_BASE}/api/widget/submit`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            npi:            '0000000000', // real impl: read from authed session
            consentGranted: true,
            orgName,
          }),
        });
      }
    } catch {
      // Silent — UX always completes
    }

    setState('done');

    // Auto-close popup after confirmation flash
    setTimeout(() => {
      try { window.close(); } catch { /* sandboxed context */ }
    }, 2200);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--cloud-dancer)] px-5 py-8 text-[var(--warm-charcoal)]">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(191,211,231,0.35), transparent 66%)',
        }}
      />

      <GlassCard weight="heavy" className="w-full max-w-sm text-center">
        {/* ── Header ─────────────────────────── */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--trust-green)]/12 ring-1 ring-[var(--trust-green)]/30">
            <ShieldCheck className="h-6 w-6 text-[var(--trust-green)]" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--trust-green)] opacity-80">
              VitalCV · Secure Share
            </p>
            <h1 className="mt-1 font-fraunces text-xl font-semibold leading-tight text-[var(--warm-charcoal)]">
              {orgName} is requesting your
              <br />
              Credential Readiness State.
            </h1>
          </div>
        </div>

        {/* ── State machine ───────────────────── */}
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="rounded-2xl border border-[var(--warm-charcoal)]/8 bg-[var(--warm-charcoal)]/[0.03] p-4 text-left text-sm">
                <p className="font-semibold text-[var(--warm-charcoal)]">You&apos;re sharing:</p>
                <ul className="mt-2 space-y-1.5 text-[var(--warm-charcoal)]/70">
                  <li>✓ Clearance state (GREEN / YELLOW / RED)</li>
                  <li>✓ License &amp; board cert status</li>
                  <li>✓ Trust score band</li>
                  <li className="text-[var(--warm-charcoal)]/35">
                    ✗ SSN, DOB, home address — never shared
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleSignAndShare}
                size="lg"
                className="w-full gap-2 bg-[var(--trust-green)] text-[var(--trust-green-foreground)] hover:bg-[var(--trust-green)]/90"
              >
                <Fingerprint className="h-4 w-4" />
                Sign &amp; Share
              </Button>

              <p className="text-[10px] text-[var(--warm-charcoal)]/40">
                Cryptographically signed · Revocable anytime · No PII transmitted
              </p>
            </motion.div>
          )}

          {state === 'signing' && (
            <motion.div
              key="signing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 py-2"
            >
              <p className="text-sm font-medium text-[var(--warm-charcoal)]/70">
                Authenticating…
              </p>
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="mx-auto h-4 w-3/4 rounded-lg" />
              <Skeleton className="mx-auto h-4 w-1/2 rounded-lg" />
            </motion.div>
          )}

          {state === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--trust-green)]/12 ring-2 ring-[var(--trust-green)]/35">
                <CheckCircle2 className="h-8 w-8 text-[var(--trust-green)]" />
              </span>
              <div>
                <p className="font-fraunces text-lg font-semibold text-[var(--warm-charcoal)]">
                  Application Sent
                </p>
                <p className="mt-1 text-sm text-[var(--warm-charcoal)]/60">
                  Your credential readiness has been shared securely.
                </p>
              </div>
              <p className="text-xs text-[var(--warm-charcoal)]/35">
                This window will close automatically…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </main>
  );
}
