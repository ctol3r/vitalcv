'use client';

/**
 * CredentialCard — Wave 32: Holder Wallet UX Transformation
 *
 * Large-Card pattern per UI Doctrine:
 *  - 90% text / 10% icon rule — credentials read, not scanned
 *  - 18-20px minimum base text for front-desk legibility
 *  - High-contrast StatusPill (not a dot, a legible pill)
 *  - Integrated AuditScrapbook expander: PSV artifact trace,
 *    SHA-256 snapshot hash, Verifier DID, MethodologyVersion
 *  - "Focus Mode" trigger button → full-screen overlay at front desk
 */

import type { ClaimLevel, CredentialStatus } from '@/components/trust-state/types';
import { ClaimBadge } from '@/components/ui/claim-badge';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Award,
    BadgeCheck,
    BookOpen,
    Briefcase,
    ChevronDown,
    FileText,
    GraduationCap,
    Maximize2,
    ShieldCheck,
    Stethoscope,
} from 'lucide-react';
import { useCallback, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CredentialCardData {
  id: string;
  type: string;
  name: string;
  issuer: string;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  expirationDate?: string;
  issueDate?: string;
  // Wave 32 additions
  licenseId?: string;
  psvSnapshotHash?: string;
  verifierDid?: string;
  methodologyVersion?: string;
}

export interface CredentialCardProps {
  credential: CredentialCardData;
  className?: string;
  /** Triggered when the clinician taps "Focus Mode" */
  onFocusMode?: (credential: CredentialCardData) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  STATE_LICENSE:       ShieldCheck,
  BOARD_CERTIFICATION: Award,
  DEA_REGISTRATION:    Stethoscope,
  NPI_ENROLLMENT:      BadgeCheck,
  EDUCATION:           GraduationCap,
  TRAINING:            BookOpen,
  WORK_HISTORY:        Briefcase,
};

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  ACTIVE:    { label: 'Valid',       pill: 'bg-[var(--trust-green)]/15 text-[var(--trust-green)] ring-[var(--trust-green)]/30',  dot: 'bg-[var(--trust-green)]'   },
  PENDING:   { label: 'Pending',     pill: 'bg-[var(--trust-yellow)]/15 text-[var(--trust-yellow)] ring-[var(--trust-yellow)]/30', dot: 'bg-[var(--trust-yellow)]' },
  EXPIRED:   { label: 'Expired',     pill: 'bg-destructive/15 text-destructive ring-destructive/30',                              dot: 'bg-destructive'             },
  REVOKED:   { label: 'Revoked',     pill: 'bg-destructive/15 text-destructive ring-destructive/30',                              dot: 'bg-destructive'             },
  SUSPENDED: { label: 'Suspended',   pill: 'bg-destructive/15 text-destructive ring-destructive/30',                              dot: 'bg-destructive'             },
  INACTIVE:  { label: 'Inactive',    pill: 'bg-muted/60 text-muted-foreground ring-muted-foreground/20',                          dot: 'bg-muted-foreground/60'     },
  NOT_FOUND: { label: 'Not Found',   pill: 'bg-muted/60 text-muted-foreground ring-muted-foreground/20',                          dot: 'bg-muted-foreground/60'     },
  UNKNOWN:   { label: 'Unknown',     pill: 'bg-muted/60 text-muted-foreground ring-muted-foreground/20',                          dot: 'bg-muted-foreground/60'     },
};

const CLAIM_TEXT: Record<ClaimLevel, string> = {
  L0: 'Unverified',
  L1: 'Self-Reported',
  L2: 'Document Verified',
  L3: 'Primary Source Verified',
};

// ── StatusPill ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: CredentialStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['UNKNOWN'];
  return (
    <span className={cn(
      'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[15px] font-semibold ring-1',
      cfg.pill,
    )}>
      <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch { return iso; }
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

// ── AuditScrapbook (integrated expander) ──────────────────────────────────

function AuditScrapbook({ credential }: { credential: CredentialCardData }) {
  const hasPsv = credential.claimLevel === 'L3';

  return (
    <div className="space-y-3 pt-1">
      {/* PSV Artifact Trace */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          PSV Artifact Trace
        </p>
        {hasPsv ? (
          <p className="font-mono text-[13px] text-foreground/70 leading-relaxed">
            Primary source verification completed via direct authority query.
            Receipt is cryptographically bound to this credential record.
          </p>
        ) : (
          <p className="font-mono text-[13px] text-muted-foreground/50">
            {credential.claimLevel === 'L0' ? 'No PSV. Self-reported only.'
             : credential.claimLevel === 'L1' ? 'Self-attested. Awaiting issuer verification.'
             : 'Document evidence on file. PSV pending.'}
          </p>
        )}
      </div>

      {/* SHA-256 Snapshot Hash */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          SHA-256 Snapshot Hash
        </p>
        <p className="font-mono text-[12px] break-all text-[var(--trust-green)]/80">
          {credential.psvSnapshotHash ?? `—  hash not yet anchored (${credential.claimLevel})`}
        </p>
      </div>

      {/* Verifier DID */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          Verifier DID
        </p>
        <p className="font-mono text-[12px] break-all text-foreground/60">
          {credential.verifierDid ?? 'did:web:vitalcv.ai:issuer:pending'}
        </p>
      </div>

      {/* Methodology Version */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          Methodology Version
        </p>
        <p className="font-mono text-[13px] text-foreground/70">
          {credential.methodologyVersion ?? 'VCV-PSV-2025.1 (NCQA-Aligned)'}
        </p>
      </div>

      {/* License ID */}
      {credential.licenseId && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            License / Registration ID
          </p>
          <p className="font-mono text-[13px] text-foreground/70">{credential.licenseId}</p>
        </div>
      )}
    </div>
  );
}

// ── CredentialCard ─────────────────────────────────────────────────────────

export function CredentialCard({ credential, className, onFocusMode }: CredentialCardProps) {
  const [expanded, setExpanded] = useState(false);

  const Icon = TYPE_ICONS[credential.type] ?? FileText;
  const statusCfg = STATUS_CONFIG[credential.status] ?? STATUS_CONFIG['UNKNOWN'];
  const isProblematic = ['EXPIRED', 'REVOKED', 'SUSPENDED'].includes(credential.status);
  const expiryDays = daysUntil(credential.expirationDate);
  const isExpiringSoon = expiryDays !== null && expiryDays > 0 && expiryDays <= 90;

  const handleFocusMode = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onFocusMode?.(credential); },
    [credential, onFocusMode],
  );

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl transition-all duration-300',
        'bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-white/10 shadow-glow',
        'glass-hover magnetic-button cursor-pointer',
        isProblematic
          ? 'border-destructive/25'
          : isExpiringSoon
          ? 'border-[var(--trust-yellow)]/30'
          : '',
        className,
      )}
    >
      {/* Claim badge — absolute top-right */}
      <div className="absolute top-5 right-5 z-10">
        <ClaimBadge level={credential.claimLevel} />
      </div>

      {/* ── Card body ──────────────────────────────────────────── */}
      <div className="flex-1 space-y-5 px-7 pt-8 pb-6">

        {/* Icon row — small, 10% rule */}
        <div className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl',
          'bg-primary/8 text-primary/70',
        )}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>

        {/* Credential name — 22px, heading font, high contrast */}
        <div className="pr-14">
          <h3 className="font-heading text-[22px] font-bold leading-snug tracking-tight text-foreground">
            {credential.name}
          </h3>
          <p className="mt-2 text-[17px] leading-snug text-muted-foreground">
            {credential.issuer}
          </p>
        </div>

        {/* StatusPill — prominent, legible */}
        <StatusPill status={credential.status} />

        {/* Structured field grid */}
        <dl className="space-y-4 border-t border-[var(--glass-border)] pt-5">

          {/* Validity window */}
          {(credential.issueDate || credential.expirationDate) && (
            <div>
              <dt className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                Validity Window
              </dt>
              <dd className="text-[18px] font-medium text-foreground">
                {fmtDate(credential.issueDate) ?? '—'}
                {credential.expirationDate && (
                  <span className="text-muted-foreground"> – {fmtDate(credential.expirationDate)}</span>
                )}
              </dd>
              {isExpiringSoon && (
                <p className="mt-1 text-[14px] font-semibold text-[var(--trust-yellow)]">
                  ⚠ Expires in {expiryDays} days — renew soon
                </p>
              )}
            </div>
          )}

          {/* Verification level */}
          <div>
            <dt className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
              Verification Level
            </dt>
            <dd className="text-[18px] font-medium text-foreground">
              {CLAIM_TEXT[credential.claimLevel]}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── AuditScrapbook expander ─────────────────────────────── */}
      <div className="border-t border-[var(--glass-border)]">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full items-center justify-between px-7 py-3.5',
            'text-[13px] font-semibold uppercase tracking-widest text-muted-foreground/50',
            'hover:text-muted-foreground transition-colors',
          )}
        >
          <span>Audit Scrapbook</span>
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18 }}>
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="scrapbook"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="border-t border-[var(--glass-border)]/40 bg-[var(--glass-bg)] px-7 py-5">
                <AuditScrapbook credential={credential} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Focus Mode trigger ──────────────────────────────────── */}
      {onFocusMode && (
        <div className="border-t border-[var(--glass-border)] px-7 py-3.5">
          <button
            type="button"
            onClick={handleFocusMode}
            className={cn(
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-3',
              'text-[15px] font-semibold',
              'bg-primary/6 text-primary hover:bg-primary/10',
              'ring-1 ring-primary/10 hover:ring-primary/20 transition-all',
            )}
            aria-label={`Open ${credential.name} in Focus Mode`}
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            Focus Mode
          </button>
        </div>
      )}
    </div>
  );
}
