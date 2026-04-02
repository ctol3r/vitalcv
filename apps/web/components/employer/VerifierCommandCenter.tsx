'use client';

/**
 * VerifierCommandCenter — Wave F: Split-Pane Credential Intake Dashboard
 *
 * Left pane (35%):  Candidate queue with NPI, role, L-level badge, trust band
 * Right pane (65%): Golden record, CRS ring, credential list, Instant Approve, AuditTerminal
 */

import type { ClaimLevel, TrustBand } from '@/components/trust-state/types';
import { Button } from '@/components/ui/button';
import { ClaimBadge } from '@/components/ui/claim-badge';
import { HoverCard } from '@/components/ui/HoverCard';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Inbox, ShieldCheck } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AuditTerminal, type AuditLogEntry } from './AuditTerminal';

// ── Demo Data ───────────────────────────────────────────────────────────────

interface DemoCredential {
  name: string;
  type: string;
  claimLevel: ClaimLevel;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED';
}

interface DemoCandidate {
  npi: string;
  name: string;
  role: string;
  claimLevel: ClaimLevel;
  trustBand: TrustBand;
  crsScore: number;
  lastUpdated: string;
  credentials: DemoCredential[];
  auditLog: AuditLogEntry[];
}

const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    npi: '1234567890',
    name: 'Dr. Amara Okafor',
    role: 'Cardiologist',
    claimLevel: 'L3',
    trustBand: 'GREEN',
    crsScore: 94,
    lastUpdated: '2 min ago',
    credentials: [
      { name: 'CA State Medical License', type: 'STATE_LICENSE', claimLevel: 'L3', status: 'ACTIVE' },
      { name: 'ABIM Board Certification', type: 'BOARD_CERTIFICATION', claimLevel: 'L3', status: 'ACTIVE' },
      { name: 'DEA Registration', type: 'DEA_REGISTRATION', claimLevel: 'L3', status: 'ACTIVE' },
      { name: 'NPI Enrollment', type: 'NPI_ENROLLMENT', claimLevel: 'L3', status: 'ACTIVE' },
    ],
    auditLog: [
      { timestamp: '14:32:01', message: 'NPPES primary source confirmed — CA Medical Board', status: 'VERIFIED' },
      { timestamp: '14:32:03', message: 'ABIM certification cross-referenced', status: 'VERIFIED', hash: 'a4f8c2d91b3e7f0a6c5d8e2b' },
      { timestamp: '14:32:04', message: 'OIG/LEIE exclusion check passed', status: 'VERIFIED', hash: '7d2a4f8f91b6d8cfb4e7c8d0' },
      { timestamp: '14:32:05', message: 'NPI primary source match', status: 'VERIFIED', hash: 'b9a21f4e5a8d7c1f4a3b9a20' },
      { timestamp: '14:32:06', message: 'Credential bundle signed — ES256', status: 'VERIFIED', hash: '3f7d2a4f8f91b6d8cfb4e7c8' },
    ],
  },
  {
    npi: '9876543210',
    name: 'Dr. James Whitfield',
    role: 'Anesthesiologist',
    claimLevel: 'L2',
    trustBand: 'YELLOW',
    crsScore: 68,
    lastUpdated: '18 min ago',
    credentials: [
      { name: 'NY State Medical License', type: 'STATE_LICENSE', claimLevel: 'L2', status: 'ACTIVE' },
      { name: 'ABA Board Certification', type: 'BOARD_CERTIFICATION', claimLevel: 'L2', status: 'ACTIVE' },
      { name: 'DEA Registration', type: 'DEA_REGISTRATION', claimLevel: 'L1', status: 'PENDING' },
      { name: 'NPI Enrollment', type: 'NPI_ENROLLMENT', claimLevel: 'L2', status: 'ACTIVE' },
    ],
    auditLog: [
      { timestamp: '14:15:22', message: 'NPPES primary source confirmed — NY Medical Board', status: 'VERIFIED' },
      { timestamp: '14:15:24', message: 'ABA certification cross-referenced', status: 'VERIFIED', hash: 'c6d5f1e8b3a4c9d0f2a1b7e3' },
      { timestamp: '14:15:25', message: 'OIG/LEIE exclusion check passed', status: 'VERIFIED', hash: 'd7b2e4f9a1c3e8b5f6a2c9d1' },
    ],
  },
  {
    npi: '5551234567',
    name: 'Dr. Sofia Reyes-Martín',
    role: 'Emergency Medicine',
    claimLevel: 'L1',
    trustBand: 'RED',
    crsScore: 32,
    lastUpdated: '1 hr ago',
    credentials: [
      { name: 'TX State Medical License', type: 'STATE_LICENSE', claimLevel: 'L1', status: 'ACTIVE' },
      { name: 'ABEM Board Certification', type: 'BOARD_CERTIFICATION', claimLevel: 'L0', status: 'PENDING' },
      { name: 'DEA Registration', type: 'DEA_REGISTRATION', claimLevel: 'L1', status: 'ACTIVE' },
      { name: 'NPI Enrollment', type: 'NPI_ENROLLMENT', claimLevel: 'L1', status: 'ACTIVE' },
    ],
    auditLog: [
      { timestamp: '13:28:10', message: 'Identity binding initiated — TX Board', status: 'VERIFIED' },
      { timestamp: '13:28:14', message: 'Board certification — no primary source found', status: 'ERROR' },
      { timestamp: '13:28:15', message: 'Awaiting issuer attestation for ABEM', status: 'PENDING' },
    ],
  },
];

// ── Trust Band Styling ──────────────────────────────────────────────────────

const TRUST_BAND_STYLE: Record<TrustBand, { bg: string; text: string; label: string }> = {
  GREEN:  { bg: 'bg-[var(--trust-green)]/15', text: 'text-[var(--trust-green)]', label: 'Green' },
  YELLOW: { bg: 'bg-[var(--trust-yellow)]/15', text: 'text-[var(--trust-yellow)]', label: 'Yellow' },
  RED:    { bg: 'bg-destructive/15', text: 'text-destructive', label: 'Red' },
};

const CREDENTIAL_STATUS_DOT: Record<string, string> = {
  ACTIVE:  'bg-[var(--trust-green)]',
  PENDING: 'bg-[var(--trust-yellow)]',
  EXPIRED: 'bg-destructive',
};

// ── CRS Ring ────────────────────────────────────────────────────────────────

function CrsRing({ score, band }: { score: number; band: TrustBand }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeColor =
    band === 'GREEN' ? 'var(--trust-green)' :
    band === 'YELLOW' ? 'var(--trust-yellow)' :
    'var(--destructive)';

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`CRS: ${score}%`}>
        <circle
          cx="60" cy="60" r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-[var(--warm-charcoal)]/10"
        />
        <motion.circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - circumference * (score / 100) }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: strokeColor }}>{score}%</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">CRS</span>
      </div>
    </div>
  );
}

// ── VerifierCommandCenter ───────────────────────────────────────────────────

export function VerifierCommandCenter() {
  const [selectedNpi, setSelectedNpi] = useState<string | null>(null);
  const [approvedNpis, setApprovedNpis] = useState<Set<string>>(new Set());

  const selected = useMemo(
    () => DEMO_CANDIDATES.find((c) => c.npi === selectedNpi) ?? null,
    [selectedNpi],
  );

  const allL3 = useMemo(
    () => selected?.credentials.every((c) => c.claimLevel === 'L3') ?? false,
    [selected],
  );

  const handleApprove = useCallback(() => {
    if (!selectedNpi || !allL3) return;
    setApprovedNpis((prev) => new Set(prev).add(selectedNpi));
  }, [selectedNpi, allL3]);

  const isApproved = selectedNpi ? approvedNpis.has(selectedNpi) : false;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ── Left Pane: Candidate Queue ──────────────────────────── */}
      <div className="w-full shrink-0 lg:w-[35%]">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] backdrop-blur-[var(--glass-blur)] shadow-[var(--glass-shadow)]">
          <div className="border-b border-[var(--glass-border)] px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Candidate Queue
            </h2>
          </div>

          <ul className="divide-y divide-[var(--glass-border)]/50" role="listbox" aria-label="Candidates">
            {DEMO_CANDIDATES.map((candidate) => {
              const isActive = selectedNpi === candidate.npi;
              const bandStyle = TRUST_BAND_STYLE[candidate.trustBand];
              const wasApproved = approvedNpis.has(candidate.npi);

              return (
                <li key={candidate.npi} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => setSelectedNpi(candidate.npi)}
                    className={cn(
                      'w-full text-left px-5 py-4 transition-all duration-150',
                      'hover:bg-[var(--glass-bg)]',
                      isActive && 'bg-primary/[0.04] border-l-2 border-l-primary',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-foreground truncate">
                          {candidate.name}
                          {wasApproved && (
                            <CheckCircle2 className="ml-1.5 inline h-4 w-4 text-[var(--trust-green)]" aria-label="Approved" />
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          NPI {candidate.npi} · {candidate.role}
                        </p>
                      </div>
                      <ClaimBadge level={candidate.claimLevel} showLabel={false} className="shrink-0 mt-0.5" />
                    </div>

                    <div className="mt-2.5 flex items-center gap-2.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                        bandStyle.bg, bandStyle.text,
                        `ring-current/20`,
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', bandStyle.text, 'bg-current')} />
                        {bandStyle.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60">{candidate.lastUpdated}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Right Pane: Golden Record ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.npi}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Golden Record Header */}
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] backdrop-blur-[var(--glass-blur)] shadow-[var(--glass-shadow)] p-6">
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  <CrsRing score={selected.crsScore} band={selected.trustBand} />

                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-xl font-bold text-foreground">{selected.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      NPI {selected.npi} · {selected.role}
                    </p>

                    {/* Credential list */}
                    <ul className="mt-5 space-y-2.5">
                      {selected.credentials.map((cred) => (
                        <HoverCard
                          key={cred.name}
                          align="start"
                          trigger={
                            <li className="flex items-center gap-3 p-1 rounded hover:bg-muted cursor-help transition-colors">
                              <span className={cn('h-2 w-2 rounded-full shrink-0', CREDENTIAL_STATUS_DOT[cred.status] ?? 'bg-muted-foreground/40')} />
                              <span className="flex-1 text-sm text-foreground truncate">{cred.name}</span>
                              <ClaimBadge level={cred.claimLevel} showLabel={false} className="shrink-0" />
                            </li>
                          }
                        >
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-foreground">{cred.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{cred.type}</p>
                            <div className="pt-1 mt-1 border-t border-border flex items-center justify-between gap-4">
                              <span className="text-[10px] font-medium text-muted-foreground">Status: <span className={CREDENTIAL_STATUS_DOT[cred.status] ? 'text-foreground' : ''}>{cred.status}</span></span>
                              <ClaimBadge level={cred.claimLevel} showLabel={true} />
                            </div>
                          </div>
                        </HoverCard>
                      ))}
                    </ul>

                    {/* Instant Approve */}
                    <div className="mt-6">
                      {isApproved ? (
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--trust-green)]">
                          <CheckCircle2 className="h-5 w-5" />
                          Candidate Approved
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!allL3}
                          onClick={handleApprove}
                          className="gap-2"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {allL3 ? 'Accept as Head Start' : 'Awaiting Full Verification'}
                        </Button>
                      )}
                      {!allL3 && !isApproved && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          All credentials must reach L3 (Primary Source Verified) before approval.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Terminal */}
              <AuditTerminal entries={selected.auditLog} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)] text-center"
            >
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Select a candidate to review
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Choose from the queue to view their golden record and run verification.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
