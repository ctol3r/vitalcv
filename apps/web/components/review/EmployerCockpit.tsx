'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, Database, CheckCircle2 } from 'lucide-react';
import type { PassportData, DecisionPosture } from '@/lib/trust/passport-contract';

interface EmployerCockpitProps {
  passport: PassportData;
}

const STATUS_COLORS: Record<string, string> = {
  READY: 'var(--vt-status-resolved)',
  PARTIAL: 'var(--vt-severity-high)',
  BLOCKED: 'var(--vt-severity-critical)',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().split('T')[0];
}

function sourceStateLabel(state: string): string {
  switch (state) {
    case 'checked': return 'CHECKED';
    case 'stale': return 'STALE';
    case 'pending': return 'PENDING';
    case 'gated':
    case 'accessRequired': return 'ACCESS REQUIRED';
    case 'reviewRequired': return 'REVIEW REQUIRED';
    case 'unavailable': return 'UNAVAILABLE';
    case 'notDecisionGrade': return 'NOT DECISION-GRADE';
    case 'previewOnly': return 'PREVIEW ONLY';
    default: return state.toUpperCase();
  }
}

function sourceStateColor(state: string): string {
  switch (state) {
    case 'checked': return 'border-[var(--vt-status-resolved)] text-[var(--vt-status-resolved)]';
    case 'stale':
    case 'reviewRequired': return 'border-[var(--vt-severity-high)] text-[var(--vt-severity-high)]';
    case 'pending':
    case 'gated':
    case 'accessRequired':
    case 'notDecisionGrade':
    case 'previewOnly':
    case 'unavailable': return 'border-[var(--vt-severity-high)] text-[var(--vt-severity-high)]';
    default: return 'border-[var(--vt-border)]';
  }
}

function dimensionLabel(dim: string): string {
  switch (dim) {
    case 'identity': return 'Identity';
    case 'safety': return 'Sanctions';
    case 'authority': return 'Licensure';
    case 'eligibility': return 'Eligibility';
    default: return dim;
  }
}

function dimensionSourceLabel(sourceId: string): string {
  switch (sourceId) {
    case 'NPPES_API':
    case 'NPPES': return 'CMS NPPES';
    case 'OIG_LEIE':
    case 'OIG': return 'OIG LEIE';
    case 'STATE_BOARD':
    case 'FSMB_MED_API':
    case 'NURSYS': return sourceId.replace(/_/g, ' ');
    case 'PECOS_PUBLIC': return 'CMS PECOS';
    default: return sourceId;
  }
}

/**
 * Resolve decision posture from passport. Uses canonical `decisionPosture`
 * when available, otherwise falls back to `readiness` + `trustPosture`.
 */
function resolveDecisionPosture(passport: PassportData): DecisionPosture {
  if (passport.decisionPosture) {
    return passport.decisionPosture;
  }

  // Fallback for passports that don't yet include decisionPosture
  const status = passport.readiness.status;
  return {
    status,
    headline:
      status === 'DECISION_GRADE' ? 'All decision-grade sources checked. Safe to proceed.'
        : status === 'BLOCKED' ? 'Critical blockers present. Do not proceed.'
          : 'Some sources pending or incomplete. Proceed with caution.',
    proven: [],
    missing: [],
    blockers: passport.readiness.blockers,
    freshness: passport.trustPosture.freshness,
    nextAction:
      status === 'DECISION_GRADE' ? 'Accept as head start and move to privileging.'
        : status === 'BLOCKED' ? 'Do not hire until blockers are resolved.'
          : 'Route to credentialing team for gap resolution.',
  };
}

export function EmployerCockpit({ passport }: EmployerCockpitProps) {
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  const { identity, readiness } = passport;
  const posture = resolveDecisionPosture(passport);
  const name = identity?.displayName || 'Unknown Clinician';
  const score = readiness?.score || 0;
  const isBlocked = posture.status === 'BLOCKED';
  const statusColor = STATUS_COLORS[posture.status] ?? STATUS_COLORS.BLOCKED;

  // Build source truth rows from sourceCoverage (canonical) rather than raw credentials
  const coverageChecks = passport.sourceCoverage?.checks ?? [];
  const truthSet = passport.truth;

  const sourceRows = [
    ...posture.proven.map((s) => ({ ...s, decisionGrade: true })),
    ...posture.missing.map((s) => ({ ...s, decisionGrade: false })),
  ];

  return (
    <div className="min-h-screen bg-[var(--vt-bg)] text-[var(--vt-text-primary)] font-sans antialiased pb-24">
      {/* Header */}
      <header className="border-b border-[var(--vt-border)] p-6 flex justify-between items-center bg-[var(--vt-bg)] sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-[var(--vt-text-primary)]">
          <div className="w-8 h-8 bg-[var(--vt-text-primary)] flex items-center justify-center font-bold text-[var(--vt-bg)]">V</div>
          <h1 className="text-xl font-bold tracking-tighter uppercase">VitalCV</h1>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest border border-[var(--vt-border)] px-3 py-1">
            Employer Review
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-12 space-y-16">

        {/* Clinician Header */}
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-2">{name}</h2>
          <p className="text-sm font-mono opacity-60 uppercase tracking-widest">
            {identity?.specialty || 'Clinician'} · NPI: {passport.npi}
          </p>
        </div>

        {/* Decision Posture Block */}
        <div className="border-2 bg-white/5 p-8 relative" style={{ borderColor: statusColor }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-8 border-b border-[var(--vt-border-subtle)] gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Decision Posture</div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold tracking-tighter uppercase" style={{ color: statusColor }}>
                  {posture.status}
                </span>
                <span className="text-sm font-mono border border-[var(--vt-border)] px-3 py-1 bg-[var(--vt-bg)] text-[var(--vt-text-primary)]">
                  {posture.headline}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Readiness Score</div>
              <div className="text-4xl font-mono tracking-tighter">{score}<span className="text-xl opacity-40">/100</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Blockers ({posture.blockers.length})
              </h3>
              {posture.blockers.length > 0 ? (
                <ul className="space-y-2 font-mono text-sm">
                  {posture.blockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[var(--vt-severity-critical)] mt-0.5">■</span> {b}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-sm opacity-60">No critical blockers identified.</p>
              )}
            </div>

            <div className="bg-[var(--vt-text-primary)] text-[var(--vt-bg)] p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Next Best Action</h3>
              <p className="text-lg font-bold leading-snug">{posture.nextAction}</p>
            </div>
          </div>
        </div>

        {/* Source Truth Panel — from canonical sourceCoverage + truth */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-6">Source Truth</h3>
          <div className="border border-[var(--vt-border)] bg-white/5">
            <div className="grid grid-cols-5 p-4 border-b border-[var(--vt-border)] font-serif italic text-[11px] uppercase tracking-widest opacity-50">
              <div>Dimension</div>
              <div>Status</div>
              <div>Source</div>
              <div>Freshness</div>
              <div>Decision Grade</div>
            </div>
            {sourceRows.map((s, i) => (
              <div key={i} className="grid grid-cols-5 p-4 border-b border-[var(--vt-border-subtle)] last:border-0 hover:bg-[var(--vt-text-primary)] hover:text-[var(--vt-bg)] transition-colors group font-mono text-xs items-center">
                <div className="font-bold">{dimensionLabel(s.dimension)}</div>
                <div>
                  <span className={`px-2 py-0.5 border ${sourceStateColor(s.state)} group-hover:border-[var(--vt-bg)] group-hover:text-[var(--vt-bg)] uppercase text-[10px]`}>
                    {sourceStateLabel(s.state)}
                  </span>
                  {s.state !== 'checked' && (
                    <div className="text-[10px] mt-1 opacity-60 group-hover:opacity-90">{s.reason}</div>
                  )}
                </div>
                <div className="opacity-80">{dimensionSourceLabel(s.sourceId)}</div>
                <div className="opacity-80 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDate(s.checkedAt)}
                </div>
                <div>{s.decisionGrade ? 'YES' : 'NO'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scope Disclosure */}
        <div className="border border-[var(--vt-border)] bg-white/5 p-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-4">Verification Scope</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">This review covers</div>
              <ul className="space-y-1 font-mono text-xs opacity-80">
                <li>Primary identity (CMS NPPES)</li>
                <li>Federal exclusion screening (OIG/LEIE)</li>
                <li>State license authority verification</li>
                <li>Medicare enrollment (CMS PECOS)</li>
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--vt-severity-high)] mb-2">Not included in this review</div>
              <ul className="space-y-1 font-mono text-xs opacity-80">
                <li>NPDB (National Practitioner Data Bank)</li>
                <li>DEA registration verification</li>
                <li>Board certification (ABMS/ABNS)</li>
                <li>SAM.gov federal exclusion</li>
                <li>Malpractice claims history</li>
              </ul>
              <p className="text-[10px] font-mono opacity-50 mt-3">
                For comprehensive credentialing, pair this review with source-specific verification for items not covered above.
              </p>
            </div>
          </div>
        </div>

        {/* Freshness Panel */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-6">
            Freshness — {posture.freshness.label}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {posture.freshness.items.map((item) => (
              <div key={item.id} className="border border-[var(--vt-border)] p-4 bg-white/5">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">{item.label}</div>
                <div className="font-mono text-sm mb-1">
                  <span className={`px-2 py-0.5 border text-[10px] uppercase ${
                    item.state === 'current' ? 'border-[var(--vt-status-resolved)] text-[var(--vt-status-resolved)]'
                      : item.state === 'stale' ? 'border-[var(--vt-severity-critical)] text-[var(--vt-severity-critical)]'
                        : 'border-[var(--vt-severity-high)] text-[var(--vt-severity-high)]'
                  }`}>{item.state}</span>
                </div>
                <div className="text-[10px] font-mono opacity-60 mt-2">{item.source}</div>
                <div className="text-[10px] font-mono opacity-50 mt-1">{item.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Proven Evidence */}
        {passport.trustPosture.safeToRelyOnNow.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-6">
              Proven — Safe to Rely On ({passport.trustPosture.safeToRelyOnNow.length})
            </h3>
            <ul className="space-y-2 font-mono text-sm">
              {passport.trustPosture.safeToRelyOnNow.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--vt-status-resolved)] mt-0.5">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing / Gaps */}
        {(passport.trustPosture.missingItems.length > 0 || passport.trustPosture.gatedItems.length > 0) && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-6">
              Missing or Gated
            </h3>
            <ul className="space-y-2 font-mono text-sm">
              {[...passport.trustPosture.missingItems, ...passport.trustPosture.gatedItems].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--vt-severity-high)] mt-0.5">○</span> {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Panel */}
        <div className="border-t-4 border-[var(--vt-border)] pt-12 pb-12 sticky bottom-0 bg-[var(--vt-bg)] z-10 flex flex-col md:flex-row justify-between items-center gap-6 mt-24">
          <div>
            <h3 className="text-lg font-bold uppercase tracking-widest mb-1">Make a Decision</h3>
            <p className="text-xs font-mono opacity-60">Your action will be captured as audit-boundary metadata.</p>
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            {actionTaken ? (
              <div className="flex items-center gap-2 text-[var(--vt-status-resolved)] font-bold uppercase tracking-widest border border-[var(--vt-status-resolved)] px-6 py-4">
                <CheckCircle2 className="w-5 h-5" />
                {actionTaken}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setActionTaken('Routed to Credentialing')}
                  className="flex-1 md:flex-none border border-[var(--vt-border)] px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Route to Credentialing
                </button>
                <button
                  onClick={() => setActionTaken('Requested Update')}
                  className="flex-1 md:flex-none border border-[var(--vt-border)] px-6 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Request Update
                </button>
                <button
                  onClick={() => setActionTaken('Accepted Head Start')}
                  disabled={isBlocked}
                  className="flex-1 md:flex-none border border-[var(--vt-text-primary)] bg-[var(--vt-text-primary)] text-[var(--vt-bg)] px-8 py-4 text-sm font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  Accept as Head Start
                </button>
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
