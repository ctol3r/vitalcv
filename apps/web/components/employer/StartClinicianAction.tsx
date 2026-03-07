'use client';

/**
 * StartClinicianAction — Wave 41: Start Attestation Engine
 *
 * The closing panel of the ON Loop: once the Superbrain returns "CLEARED",
 * an employer can formally accept a clinician and then attest their start date.
 *
 * STATE MACHINE
 * ─────────────
 *  LOCKED         → cleared === false.  Panel is disabled with terracotta lock UI.
 *  READY_ACCEPT   → cleared === true.  "Confirm Acceptance" button is live.
 *  ACCEPTING      → POST /api/hiring/accept in flight.
 *  ACCEPTED       → Acceptance confirmed.  "Signal Start Date" section unlocks.
 *  STARTING       → POST /api/hiring/start in flight.
 *  COMPLETE       → ON Loop closed.  Shows Merkle anchor proof.
 *
 * DESIGN
 * ──────
 * High-contrast Antigravity panel:
 *  • LOCKED state:      terracotta tint + lock icon
 *  • CLEARED/ACCEPTED:  trust-green glow ring + animated progress
 *  • COMPLETE:          full trust-green fill + Merkle hash fingerprint
 */

import { useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  ShieldCheck,
  CalendarCheck2,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Hash,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { getApiBase } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StartClinicianActionProps {
  /** 10-digit NPI of the clinician. */
  npi: string;
  /** Display name for the clinician. */
  name: string;
  /** Role / specialty label. */
  role: string;
  /** When true the Superbrain has returned "CLEARED" — unlocks Step 1. */
  cleared: boolean;
  /** Employer domain identifier sent to the API. */
  employerId: string;
  /** Optional artifact UUID that anchored the clearance decision. */
  artifactId?: string;
}

type Phase =
  | 'LOCKED'
  | 'READY_ACCEPT'
  | 'ACCEPTING'
  | 'ACCEPTED'
  | 'STARTING'
  | 'COMPLETE';

interface AcceptResult {
  acceptanceId: string;
  acceptedAt:   string;
}

interface StartResult {
  startAttestationId: string;
  startedAt:          string;
  on_loop_delta_ms:   number | null;
  merkle: {
    auditEventId:    string;
    attestationHash: string;
    anchoredRoot:    string | null;
    status:          string;
  };
}

// ── Constants ──────────────────────────────────────────────────────────────

const TC: CSSProperties = { color: 'oklch(0.52 0.11 30)' };
const TC_BG: CSSProperties = { backgroundColor: 'oklch(0.52 0.11 30 / 0.08)' };
const TC_BORDER: CSSProperties = { borderColor: 'oklch(0.52 0.11 30 / 0.35)' };

function apiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

function formatDelta(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

// ── Step indicators ────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ring-2',
          done  && 'bg-[var(--trust-green)] ring-[var(--trust-green)]/30 text-white',
          active && !done && 'bg-primary ring-primary/30 text-primary-foreground',
          !active && !done && 'bg-muted ring-transparent text-muted-foreground',
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : null}
        {!done && active   ? <ChevronRight className="h-3.5 w-3.5" /> : null}
        {!done && !active  ? '·' : null}
      </div>
      <span className={cn(
        'text-[10px] uppercase tracking-wider font-medium',
        (active || done) ? 'text-foreground' : 'text-muted-foreground/50',
      )}>
        {label}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function StartClinicianAction({
  npi,
  name,
  role,
  cleared,
  employerId,
  artifactId,
}: StartClinicianActionProps) {
  const [phase, setPhase] = useState<Phase>(cleared ? 'READY_ACCEPT' : 'LOCKED');
  const [error, setError] = useState<string | null>(null);

  // Step 2 fields
  const [facility, setFacility]     = useState('');
  const [roleInput, setRoleInput]   = useState(role);
  const [startDate, setStartDate]   = useState('');

  // Persisted results
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);
  const [started,  setStarted]  = useState<StartResult  | null>(null);

  // If cleared prop changes after mount (e.g. Superbrain scan completes), unlock.
  const effectivePhase: Phase =
    phase === 'LOCKED' && cleared ? 'READY_ACCEPT' : phase;

  // ── Step 1: Confirm Acceptance ─────────────────────────────────────────

  async function handleAccept() {
    if (effectivePhase !== 'READY_ACCEPT') return;
    setError(null);
    setPhase('ACCEPTING');

    try {
      const res = await fetch(apiUrl('/api/hiring/accept'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerId, clinicianNpi: npi, artifactId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        // 409 = already accepted → treat as success
        if (res.status === 409 && typeof body['acceptanceId'] === 'string') {
          setAccepted({ acceptanceId: body['acceptanceId'] as string, acceptedAt: new Date().toISOString() });
          setPhase('ACCEPTED');
          return;
        }
        throw new Error((body['error_description'] as string | undefined) ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { acceptanceId: string; acceptedAt: string };
      setAccepted({ acceptanceId: data.acceptanceId, acceptedAt: data.acceptedAt });
      setPhase('ACCEPTED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acceptance failed — please retry.');
      setPhase('READY_ACCEPT');
    }
  }

  // ── Step 2: Signal Start Date ──────────────────────────────────────────

  async function handleStart() {
    if (!accepted || effectivePhase !== 'ACCEPTED') return;
    if (!facility.trim() || !startDate) {
      setError('Facility and start date are required.');
      return;
    }

    setError(null);
    setPhase('STARTING');

    try {
      const res = await fetch(apiUrl('/api/hiring/start'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptanceId: accepted.acceptanceId,
          role:         roleInput.trim() || role,
          facility:     facility.trim(),
          startedAt:    new Date(startDate).toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (res.status === 409 && typeof body['startAttestationId'] === 'string') {
          // Already started — treat as success
          setStarted({
            startAttestationId: body['startAttestationId'] as string,
            startedAt: new Date(startDate).toISOString(),
            on_loop_delta_ms: null,
            merkle: { auditEventId: '', attestationHash: '', anchoredRoot: null, status: 'PENDING_ANCHOR' },
          });
          setPhase('COMPLETE');
          return;
        }
        throw new Error((body['error_description'] as string | undefined) ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as StartResult;
      setStarted(data);
      setPhase('COMPLETE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Start attestation failed — please retry.');
      setPhase('ACCEPTED');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const isLocked   = effectivePhase === 'LOCKED';
  const isDone     = effectivePhase === 'COMPLETE';
  const step1Done  = ['ACCEPTED', 'STARTING', 'COMPLETE'].includes(effectivePhase);
  const step2Done  = isDone;
  const step1Active = ['READY_ACCEPT', 'ACCEPTING'].includes(effectivePhase);
  const step2Active = ['ACCEPTED', 'STARTING'].includes(effectivePhase);

  return (
    <GlassCard
      weight="heavy"
      className={cn(
        'relative overflow-hidden transition-all duration-500',
        isDone && 'ring-2 ring-[var(--trust-green)]/40',
        isLocked && 'opacity-75',
      )}
    >
      {/* Trust-green progress bar at top */}
      <AnimatePresence>
        {!isLocked && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{
              scaleX: isDone ? 1 : step1Done ? 0.6 : 0.1,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute top-0 left-0 h-0.5 w-full origin-left bg-[var(--trust-green)]"
          />
        )}
      </AnimatePresence>

      <GlassCardHeader>
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
            isDone   && 'bg-[var(--trust-green)]/15',
            isLocked && 'bg-muted/30',
            !isDone && !isLocked && 'bg-primary/10',
          )}>
            {isDone   && <CheckCircle2 className="h-5 w-5 text-[var(--trust-green)]" />}
            {isLocked && <Lock className="h-5 w-5" style={TC} />}
            {!isDone && !isLocked && <Zap className="h-5 w-5 text-primary" />}
          </div>

          <div className="min-w-0 flex-1">
            <GlassCardTitle className={cn(isDone && 'text-[var(--trust-green)]')}>
              {isDone ? 'ON Loop Closed' : 'Signal Start'}
            </GlassCardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {name} · NPI {npi.slice(0, 4)}····
            </p>
          </div>

          {/* Cleared badge */}
          {cleared && !isLocked && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[var(--trust-green)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--trust-green)] ring-1 ring-[var(--trust-green)]/25">
              <ShieldCheck className="h-3 w-3" />
              CLEARED
            </span>
          )}
          {isLocked && (
            <span
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1"
              style={{ ...TC, ...TC_BG, ...TC_BORDER }}
            >
              <Lock className="h-3 w-3" />
              AWAITING CLEARANCE
            </span>
          )}
        </div>

        {/* Step indicators */}
        {!isLocked && (
          <div className="flex items-start gap-4 pt-1">
            <StepDot active={step1Active} done={step1Done} label="Accept" />
            <div className={cn('mt-3 h-px w-6 shrink-0 transition-colors duration-300', step1Done ? 'bg-[var(--trust-green)]' : 'bg-border')} />
            <StepDot active={step2Active} done={step2Done} label="Start" />
          </div>
        )}
      </GlassCardHeader>

      <GlassCardContent>
        <AnimatePresence mode="wait">

          {/* ── LOCKED ─────────────────────────────────────────── */}
          {isLocked && (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl p-4 text-center"
              style={{ ...TC_BG, border: '1px solid', ...TC_BORDER }}
            >
              <Lock className="mx-auto mb-2 h-6 w-6" style={TC} />
              <p className="text-sm font-medium" style={TC}>
                Superbrain clearance required
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Run the Superbrain eligibility scan. When it returns{' '}
                <span className="font-semibold text-[var(--trust-green)]">CLEARED</span>,
                this panel will unlock.
              </p>
            </motion.div>
          )}

          {/* ── READY_ACCEPT / ACCEPTING ───────────────────────── */}
          {(effectivePhase === 'READY_ACCEPT' || effectivePhase === 'ACCEPTING') && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Formally accept this clinician&apos;s verified credential bundle.
                This records your hiring decision on the VitalCV trust ledger.
              </p>

              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Clinician</span>
                  <span className="font-medium text-foreground">{name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium text-foreground">{role}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">NPI</span>
                  <span className="font-mono font-medium text-foreground">{npi}</span>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/8 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                className="w-full gap-2"
                disabled={effectivePhase === 'ACCEPTING'}
                onClick={handleAccept}
              >
                {effectivePhase === 'ACCEPTING' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording acceptance…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Confirm Acceptance
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* ── ACCEPTED / STARTING ───────────────────────────── */}
          {(effectivePhase === 'ACCEPTED' || effectivePhase === 'STARTING') && accepted && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Acceptance confirmation pill */}
              <div className="flex items-center gap-2 rounded-lg bg-[var(--trust-green)]/8 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--trust-green)]" />
                <span className="text-xs text-[var(--trust-green)] font-medium">
                  Acceptance recorded · {new Date(accepted.acceptedAt).toLocaleString()}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Signal the exact start date and facility. This timestamp is
                cryptographically anchored to the VitalCV Merkle audit ledger.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role / Title
                  </label>
                  <Input
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    placeholder="e.g. Attending Cardiologist"
                    disabled={effectivePhase === 'STARTING'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Facility / Unit
                  </label>
                  <Input
                    value={facility}
                    onChange={(e) => setFacility(e.target.value)}
                    placeholder="e.g. Stanford Medical Center – Cardiology"
                    disabled={effectivePhase === 'STARTING'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={effectivePhase === 'STARTING'}
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/8 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                className="w-full gap-2"
                disabled={effectivePhase === 'STARTING' || !facility.trim() || !startDate}
                onClick={handleStart}
              >
                {effectivePhase === 'STARTING' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Anchoring to Merkle ledger…
                  </>
                ) : (
                  <>
                    <CalendarCheck2 className="h-4 w-4" />
                    Signal Start Date
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* ── COMPLETE ──────────────────────────────────────── */}
          {effectivePhase === 'COMPLETE' && started && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-4"
            >
              {/* Hero success state */}
              <div className="rounded-xl bg-[var(--trust-green)]/8 ring-1 ring-[var(--trust-green)]/20 p-5 text-center space-y-2">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--trust-green)]/15"
                >
                  <CheckCircle2 className="h-8 w-8 text-[var(--trust-green)]" />
                </motion.div>
                <p className="text-base font-bold text-[var(--trust-green)]">ON Loop Closed</p>
                <p className="text-xs text-muted-foreground">
                  {name} starts{' '}
                  <span className="font-semibold text-foreground">
                    {new Date(started.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </p>
                {started.on_loop_delta_ms !== null && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--trust-green)]/10 px-3 py-1 text-xs font-semibold text-[var(--trust-green)]">
                    <Zap className="h-3 w-3" />
                    Time-to-hire: {formatDelta(started.on_loop_delta_ms)}
                  </div>
                )}
              </div>

              {/* Merkle proof fingerprint */}
              <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Merkle Audit Proof
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--trust-yellow)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--trust-yellow)]">
                    PENDING ANCHOR
                  </span>
                </div>
                <p className="break-all font-mono text-[10px] text-muted-foreground leading-relaxed">
                  {started.merkle.attestationHash}
                </p>
                <p className="text-[10px] text-muted-foreground/50">
                  Wave 35 merkleBatcher will anchor this hash in the next 5-min batch cycle.
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </GlassCardContent>

      {/* Footer — always visible except locked */}
      {!isLocked && (
        <GlassCardFooter>
          <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground/50">
            <span>ON Loop · VitalCV Wave 41</span>
            {accepted && (
              <span className="font-mono">
                acc/{accepted.acceptanceId.slice(0, 8)}
              </span>
            )}
          </div>
        </GlassCardFooter>
      )}
    </GlassCard>
  );
}
