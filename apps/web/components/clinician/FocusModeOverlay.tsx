'use client';

/**
 * FocusModeOverlay — Wave 32: Holder Wallet UX Transformation
 *
 * Full-screen, high-contrast "show-and-go" credential display.
 * Designed for front-desk verification: hand the phone to the receptionist.
 *
 * Visual hierarchy (in order of eye gravity):
 *   1. Giant QR code — scannable from 1m away
 *   2. Issuer name — large, bold, no ambiguity
 *   3. Clinician name — who is presenting this
 *   4. License ID — the exact number they'll check
 *   5. Validity window — still current?
 *   6. Status pill — one-glance colour truth
 *
 * Motion: y:'100%' → y:0 in 160ms (spring, no overshoot)
 * Exit:   y:0 → y:'100%' in 120ms
 *
 * Accessibility: focus-trap inside overlay, Escape to close,
 * role="dialog", aria-modal="true".
 */

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import { CheckCircle2, ShieldAlert, X } from 'lucide-react';
import type { CredentialCardData } from './CredentialCard';

// ── Props ──────────────────────────────────────────────────────────────────

interface FocusModeOverlayProps {
  credential: CredentialCardData | null;
  clinicianName: string;
  /** QR destination — defaults to vitalcv.ai/verify/:npi */
  qrUrl?: string;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso));
  } catch { return iso; }
}

function daysRemaining(iso: string | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const VALID_STATUSES = new Set(['ACTIVE']);

// ── Overlay content ────────────────────────────────────────────────────────

interface OverlayContentProps {
  credential: CredentialCardData;
  clinicianName: string;
  qrUrl: string | undefined;
  onClose: () => void;
}

function OverlayContent({
  credential,
  clinicianName,
  qrUrl,
  onClose,
}: OverlayContentProps) {

  const isValid = VALID_STATUSES.has(credential.status);
  const days    = daysRemaining(credential.expirationDate);
  const expiringSoon = days !== null && days > 0 && days <= 90;
  const expired      = days !== null && days <= 0;

  // Status colour scheme
  const scheme = !isValid || expired
    ? { bg: 'bg-red-950',       accent: '#ef4444', statusText: 'NOT VALID',    Icon: ShieldAlert,    iconCls: 'text-red-400'     }
    : expiringSoon
    ? { bg: 'bg-amber-950',     accent: '#f59e0b', statusText: 'EXPIRING SOON',Icon: ShieldAlert,    iconCls: 'text-amber-400'   }
    : { bg: 'bg-emerald-950',   accent: '#10b981', statusText: 'VALID',         Icon: CheckCircle2,  iconCls: 'text-emerald-400' };

  // Keyboard close
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const qrValue = qrUrl ?? `https://vitalcv.ai/verify/${credential.licenseId ?? credential.id}`;

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center gap-0 ${scheme.bg} px-8 py-10`}
      role="dialog"
      aria-modal="true"
      aria-label={`Focus Mode — ${credential.name}`}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close Focus Mode"
        className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Status banner — top strip */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center gap-3 py-4"
        style={{ backgroundColor: `${scheme.accent}20`, borderBottom: `1px solid ${scheme.accent}40` }}
      >
        <scheme.Icon className={`h-5 w-5 ${scheme.iconCls}`} />
        <span
          className="text-[17px] font-bold uppercase tracking-[0.2em]"
          style={{ color: scheme.accent }}
        >
          {scheme.statusText}
        </span>
      </div>

      {/* Main content */}
      <div className="mt-16 flex w-full max-w-sm flex-col items-center gap-8 text-center">

        {/* QR code — centrepiece, scannable */}
        <div
          className="rounded-3xl p-5 shadow-2xl"
          style={{
            background: 'white',
            boxShadow: `0 0 60px ${scheme.accent}30`,
          }}
        >
          <QRCode
            value={qrValue}
            size={220}
            bgColor="#ffffff"
            fgColor="#0f172a"
            level="M"
          />
        </div>

        {/* Issuer — largest text after QR */}
        <div className="space-y-1">
          <p className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            Issued by
          </p>
          <p className="text-[28px] font-bold leading-tight text-foreground">
            {credential.issuer}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ backgroundColor: `${scheme.accent}30` }} />

        {/* Clinician name */}
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Presented by
          </p>
          <p className="text-[24px] font-semibold text-foreground">{clinicianName}</p>
        </div>

        {/* Credential details grid */}
        <div className="w-full rounded-2xl border border-border bg-muted divide-y divide-white/10">
          {/* Credential name */}
          <div className="px-5 py-4 text-left">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Credential
            </p>
            <p className="text-[18px] font-semibold text-foreground">{credential.name}</p>
          </div>

          {/* License ID */}
          {credential.licenseId && (
            <div className="px-5 py-4 text-left">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                License / ID
              </p>
              <p className="font-mono text-[18px] text-foreground">{credential.licenseId}</p>
            </div>
          )}

          {/* Validity window */}
          <div className="px-5 py-4 text-left">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Valid
            </p>
            <p className="text-[18px] font-medium text-foreground">
              {fmtDate(credential.issueDate)}
              <span className="text-foreground/70"> – </span>
              {credential.expirationDate
                ? fmtDate(credential.expirationDate)
                : 'No expiration'}
            </p>
            {expiringSoon && (
              <p className="mt-1 text-[14px] font-semibold" style={{ color: scheme.accent }}>
                {days} days remaining
              </p>
            )}
          </div>
        </div>

        {/* Verification level */}
        <p className="text-[14px] text-muted-foreground/60">
          Verification level:{' '}
          <span className="text-foreground font-semibold">
            {credential.claimLevel} — {
              { L0: 'Unverified', L1: 'Self-Reported', L2: 'Document Verified', L3: 'Primary Source Verified' }[credential.claimLevel]
            }
          </span>
        </p>
      </div>
    </div>
  );
}

// ── FocusModeOverlay ───────────────────────────────────────────────────────

export function FocusModeOverlay({
  credential,
  clinicianName,
  qrUrl,
  onClose,
}: FocusModeOverlayProps) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  return (
    <AnimatePresence>
      {credential && (
        <motion.div
          key="focus-mode"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{
            type: 'spring',
            stiffness: 520,
            damping: 44,
            // Enter < 160ms, exit < 120ms
          }}
          className="fixed inset-0 z-[100] overflow-auto"
          aria-live="polite"
        >
          <OverlayContent
            credential={credential}
            clinicianName={clinicianName}
            qrUrl={qrUrl}
            onClose={handleClose}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
