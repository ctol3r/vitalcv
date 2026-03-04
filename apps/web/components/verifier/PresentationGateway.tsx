'use client';

/**
 * PresentationGateway — Wave 49: OIDC4VP Verifier UI
 *
 * Renders the credential verification request interface.
 * Displays a QR code placeholder for wallet scanning, a deep link
 * button for mobile, and real-time status polling with animated transitions.
 *
 * Visual language: Glass card with trust-signal color transitions
 * matching the Antigravity design system.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { durations, easings } from '../../design/tokens';
import { usePresentationPolling } from '../../hooks/usePresentationPolling';
import type { PresentationStatus, DisclosedClaim } from '../../hooks/usePresentationPolling';

// ── Props ──────────────────────────────────────────────────

interface PresentationGatewayProps {
  requestUrl: string;
  requestId: string;
  scope?: string;
}

// ── Status configuration ───────────────────────────────────

interface StatusConfig {
  label: string;
  sublabel: string;
  color: string;
  bgClass: string;
  ringClass: string;
  pulseClass: string;
}

const STATUS_MAP: Record<PresentationStatus, StatusConfig> = {
  PENDING: {
    label: 'Awaiting Credential',
    sublabel: 'Scan the QR code or tap the link from your wallet app',
    color: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    ringClass: 'ring-amber-500/30',
    pulseClass: 'bg-amber-400',
  },
  COMPLETED: {
    label: 'Verified',
    sublabel: 'Credential presentation verified successfully',
    color: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    ringClass: 'ring-emerald-500/30',
    pulseClass: 'bg-emerald-400',
  },
  EXPIRED: {
    label: 'Request Expired',
    sublabel: 'This verification request has timed out',
    color: 'text-red-400',
    bgClass: 'bg-red-500/10',
    ringClass: 'ring-red-500/30',
    pulseClass: 'bg-red-400',
  },
  ERROR: {
    label: 'Error',
    sublabel: 'Something went wrong during verification',
    color: 'text-red-400',
    bgClass: 'bg-red-500/10',
    ringClass: 'ring-red-500/30',
    pulseClass: 'bg-red-400',
  },
};

// ── Motion variants ────────────────────────────────────────

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: durations.slow,
      ease: [...easings.decelerate],
    },
  },
};

const statusVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: [...easings.easeOut],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: durations.fast },
  },
};

// ── QR Code placeholder ────────────────────────────────────

function QrPlaceholder({ url }: { url: string }) {
  // Generate a deterministic grid pattern from the URL
  const cells = useMemo(() => {
    const grid: boolean[] = [];
    for (let i = 0; i < 64; i++) {
      const charCode = url.charCodeAt(i % url.length) ?? 0;
      grid.push((charCode + i) % 3 !== 0);
    }
    return grid;
  }, [url]);

  return (
    <div className="relative mx-auto h-48 w-48 rounded-xl bg-white p-3">
      {/* QR pattern grid */}
      <svg
        viewBox="0 0 8 8"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="QR code for credential verification"
        role="img"
      >
        {/* Finder patterns (corners) */}
        <rect x="0" y="0" width="3" height="3" fill="#1e293b" rx="0.3" />
        <rect x="0.5" y="0.5" width="2" height="2" fill="white" rx="0.2" />
        <rect x="0.8" y="0.8" width="1.4" height="1.4" fill="#1e293b" rx="0.1" />

        <rect x="5" y="0" width="3" height="3" fill="#1e293b" rx="0.3" />
        <rect x="5.5" y="0.5" width="2" height="2" fill="white" rx="0.2" />
        <rect x="5.8" y="0.8" width="1.4" height="1.4" fill="#1e293b" rx="0.1" />

        <rect x="0" y="5" width="3" height="3" fill="#1e293b" rx="0.3" />
        <rect x="0.5" y="5.5" width="2" height="2" fill="white" rx="0.2" />
        <rect x="0.8" y="5.8" width="1.4" height="1.4" fill="#1e293b" rx="0.1" />

        {/* Data cells */}
        {cells.map((filled, i) => {
          const x = (i % 8);
          const y = Math.floor(i / 8);
          // Skip finder pattern areas
          if (x < 3 && y < 3) return null;
          if (x >= 5 && y < 3) return null;
          if (x < 3 && y >= 5) return null;
          if (!filled) return null;

          return (
            <rect
              key={i}
              x={x + 0.1}
              y={y + 0.1}
              width={0.8}
              height={0.8}
              fill="#334155"
              rx="0.1"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── Verified claims display ────────────────────────────────

function ClaimsList({ claims }: { claims: DisclosedClaim[] }) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Disclosed Claims
      </p>
      {claims.map((claim) => (
        <div
          key={claim.hash}
          className="flex items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 dark:bg-white/5"
        >
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {claim.name}
          </span>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {String(claim.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────

export function PresentationGateway({
  requestUrl,
  requestId,
  scope,
}: PresentationGatewayProps) {
  const { status, claims, error } = usePresentationPolling(requestId);
  const config = STATUS_MAP[status];

  const scopeLabel = useMemo(() => {
    if (!scope) return 'Credential';
    return scope
      .replace('credential:', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, [scope]);

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="glass w-full max-w-md overflow-hidden rounded-2xl"
    >
      {/* Header */}
      <div className="border-b border-slate-200/50 px-6 pt-6 pb-4 dark:border-white/10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Verify {scopeLabel}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Present your verifiable credential to complete verification
        </p>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {/* QR Code — visible while PENDING */}
        <AnimatePresence mode="wait">
          {status === 'PENDING' && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: durations.normal }}
            >
              <QrPlaceholder url={requestUrl} />

              {/* Deep link button */}
              <a
                href={requestUrl}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Open in Wallet
              </a>
            </motion.div>
          )}

          {/* Completed — show checkmark and claims */}
          {status === 'COMPLETED' && claims && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.normal }}
            >
              <div className="flex flex-col items-center py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                  <svg
                    className="h-8 w-8 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
              </div>
              <ClaimsList claims={claims} />
            </motion.div>
          )}

          {/* Expired / Error */}
          {(status === 'EXPIRED' || status === 'ERROR') && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durations.normal }}
              className="flex flex-col items-center py-8"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
                <svg
                  className="h-8 w-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              {error && (
                <p className="mt-3 text-xs text-red-400">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status footer */}
      <div className="border-t border-slate-200/50 px-6 py-4 dark:border-white/10">
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            variants={statusVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-center gap-3"
          >
            {/* Pulse indicator */}
            <span className="relative flex h-3 w-3">
              {status === 'PENDING' && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.pulseClass}`}
                />
              )}
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${config.pulseClass}`}
              />
            </span>

            <div>
              <p className={`text-sm font-medium ${config.color}`}>
                {config.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {config.sublabel}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Request ID footer */}
      <div className="border-t border-slate-200/50 px-6 py-3 dark:border-white/10">
        <p className="font-mono text-[10px] text-slate-400 dark:text-slate-600">
          Request: {requestId}
        </p>
      </div>
    </motion.div>
  );
}
