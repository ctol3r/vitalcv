'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import CrossOriginBridge, {
  useCrossOriginBridge,
} from '@/components/widget/CrossOriginBridge';

// ── Types ────────────────────────────────────────────────

type WidgetStatus = 'READY' | 'CONNECTING' | 'VERIFIED';

interface VerificationReceipt {
  requestId: string;
  clinicianName: string;
  credentialsVerified: string[];
  readinessScore: number;
  verifiedAt: string;
  signature: string;
}

// ── Motion variants ──────────────────────────────────────

const cardEntry = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
      mass: 0.8,
      when: 'beforeChildren' as const,
      staggerChildren: 0.06,
    },
  },
};

const itemFadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const },
  },
};

const statusTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2 },
};

// ── Icons (inline SVG to avoid external deps) ────────────

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CircleDotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ── Credential label formatting ──────────────────────────

function formatCredentialLabel(credential: string): string {
  return credential
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Widget content (inside bridge context) ───────────────

function EmbedWidgetContent() {
  const searchParams = useSearchParams();
  const bridge = useCrossOriginBridge();

  const params = useMemo(
    () => ({
      clientId: searchParams.get('clientId') || '',
      jobId: searchParams.get('jobId') || '',
      role: searchParams.get('role') || 'Healthcare Professional',
      credentials: (searchParams.get('credentials') || '')
        .split(',')
        .filter(Boolean),
      theme: (searchParams.get('theme') as 'light' | 'dark') || 'light',
    }),
    [searchParams]
  );

  const [status, setStatus] = useState<WidgetStatus>('READY');
  const [verifiedCredentials, setVerifiedCredentials] = useState<Set<string>>(
    new Set()
  );

  // Send resize after mount and status changes
  useEffect(() => {
    const timer = setTimeout(() => bridge.sendResize(), 100);
    return () => clearTimeout(timer);
  }, [status, bridge]);

  const handleConnect = useCallback(async () => {
    setStatus('CONNECTING');

    // Simulate OIDC4VP flow: in production this would open a credential
    // presentation flow and await the verifiable presentation response
    try {
      // Simulate sequential credential verification
      for (const cred of params.credentials) {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
        setVerifiedCredentials((prev) => new Set([...prev, cred]));
      }

      const receipt: VerificationReceipt = {
        requestId: `req_${Date.now().toString(36)}`,
        clinicianName: 'Verified Clinician',
        credentialsVerified: params.credentials,
        readinessScore: 1.0,
        verifiedAt: new Date().toISOString(),
        signature: `sig_${crypto.randomUUID().slice(0, 16)}`,
      };

      setStatus('VERIFIED');
      bridge.sendVerified(receipt);
    } catch {
      bridge.sendError({
        code: 'VERIFICATION_FAILED',
        message: 'Credential verification could not be completed.',
      });
      setStatus('READY');
      setVerifiedCredentials(new Set());
    }
  }, [params.credentials, bridge]);

  const isDark = params.theme === 'dark';

  return (
    <main
      className={`min-h-[240px] p-4 ${isDark ? 'dark bg-[oklch(0.18_0.012_60)]' : 'bg-background'}`}
    >
      <motion.div
        className="max-w-md mx-auto"
        variants={cardEntry}
        initial="hidden"
        animate="visible"
      >
        <div className="glass rounded-2xl p-6">
          {/* Header */}
          <motion.div
            variants={itemFadeIn}
            className="flex items-center gap-2 mb-4"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.15_155/0.12)]">
              <ShieldIcon className="text-[oklch(0.72_0.15_155)]" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                Apply with VitalCV
              </div>
            </div>
          </motion.div>

          {/* Role */}
          <motion.h2
            variants={itemFadeIn}
            className="text-xl font-semibold text-foreground mb-1"
          >
            {params.role}
          </motion.h2>
          {params.jobId && (
            <motion.p
              variants={itemFadeIn}
              className="text-sm text-muted-foreground mb-4"
            >
              Job: {params.jobId}
            </motion.p>
          )}

          {/* Credential list */}
          <motion.div variants={itemFadeIn} className="space-y-2 mb-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Required Credentials
            </div>
            {params.credentials.map((cred) => {
              const isVerified = verifiedCredentials.has(cred);
              const isVerifying =
                status === 'CONNECTING' && !isVerified;

              return (
                <div
                  key={cred}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[oklch(0.957_0.008_90/0.5)] transition-colors"
                >
                  <AnimatePresence mode="wait">
                    {isVerified ? (
                      <motion.div key="check" {...statusTransition}>
                        <CheckCircleIcon className="text-[oklch(0.72_0.15_155)]" />
                      </motion.div>
                    ) : isVerifying ? (
                      <motion.div
                        key="loading"
                        {...statusTransition}
                        animate={{
                          ...statusTransition.animate,
                          rotate: 360,
                        }}
                        transition={{
                          rotate: {
                            repeat: Infinity,
                            duration: 1,
                            ease: 'linear',
                          },
                        }}
                      >
                        <LoaderIcon className="text-[oklch(0.82_0.13_85)]" />
                      </motion.div>
                    ) : (
                      <motion.div key="pending" {...statusTransition}>
                        <CircleDotIcon className="text-muted-foreground/50" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span
                    className={`text-sm ${isVerified ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                  >
                    {formatCredentialLabel(cred)}
                  </span>
                </div>
              );
            })}
          </motion.div>

          {/* Action area */}
          <motion.div variants={itemFadeIn}>
            <AnimatePresence mode="wait">
              {status === 'READY' && (
                <motion.button
                  key="connect-btn"
                  {...statusTransition}
                  onClick={handleConnect}
                  className="w-full px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition cursor-pointer"
                >
                  Connect &amp; Verify
                </motion.button>
              )}

              {status === 'CONNECTING' && (
                <motion.div
                  key="connecting-status"
                  {...statusTransition}
                  className="w-full px-5 py-3 rounded-2xl bg-[oklch(0.82_0.13_85/0.15)] text-center"
                >
                  <span className="text-sm font-medium text-[oklch(0.55_0.10_85)]">
                    Verifying credentials...
                  </span>
                </motion.div>
              )}

              {status === 'VERIFIED' && (
                <motion.div
                  key="verified-status"
                  {...statusTransition}
                  className="w-full px-5 py-3 rounded-2xl bg-[oklch(0.72_0.15_155/0.12)] text-center"
                >
                  <span className="text-sm font-medium text-[oklch(0.50_0.12_155)]">
                    All credentials verified
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <motion.p
            variants={itemFadeIn}
            className="mt-4 text-xs text-muted-foreground text-center"
          >
            Secured by VitalCV cryptographic trust infrastructure
          </motion.p>
        </div>
      </motion.div>
    </main>
  );
}

// ── Page wrapper ─────────────────────────────────────────

import { Suspense } from 'react';

function EmbedWidgetInner() {
  const searchParams = useSearchParams();
  const parentOrigin = searchParams.get('parentOrigin') || '';

  return (
    <CrossOriginBridge parentOrigin={parentOrigin}>
      <EmbedWidgetContent />
    </CrossOriginBridge>
  );
}

export default function EmbedWidgetPage() {
  return (
    <Suspense
      fallback={<div className="min-h-[240px] bg-background p-4" />}
    >
      <EmbedWidgetInner />
    </Suspense>
  );
}
