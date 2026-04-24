'use client';
/**
 * Employer Decision Console — wave-134
 *
 * The answer to "Can I move forward?" in one screen.
 * Decision first. Proof inline. Actions immediate.
 * No interpretation required.
 */

import { useState, useCallback } from 'react';
import {
  StatusBadge, PostureBadge, MetricBadge, ProofTierBadge,
} from '@/components/proof/TrustLabel';
import { LiveStateLog } from '@/components/proof/LiveStateLog';
import { PilotConversionPanel } from '@/components/review/PilotConversionPanel';
import {
  STATUS_EXPLANATIONS, KNOWN_LANES,
  type SourceStatus, type ReadinessPosture, type LaneSnapshot, type StateLogEntry,
} from '@/components/proof/trust-types';
import {
  TrustContainerPanel,
  type TrustContainerManifestView,
} from '@/components/trust/TrustContainerPanel';

// ─── Types ────────────────────────────────────────────────────────

export type DecisionState = 'ready' | 'proceed_with_review' | 'blocked' | 'needs_data';

export interface BlockerItem {
  laneId: string;
  displayName: string;
  status: SourceStatus;
  reason: string;
  requiredAction: string;
  estimatedDaysImpact: number | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  ts: number;
  stateChange?: string;
}

export interface ConsoleProps {
  /**
   * Wave 4: hidden trust-container manifest entry for the reviewed
   * clinician. Optional; rendered subordinate to source coverage.
   */
  trustContainer?: TrustContainerManifestView | null;

  entityId: string;
  npi: string;
  name: string;
  taxonomy: string;
  state: string;
  posture: ReadinessPosture;
  lanes: LaneSnapshot[];
  proofTier: 'none' | 'partial' | 'decision_grade';
  score: number | null;
  blockers: BlockerItem[];
  nextAction: string;
  auditTrail: AuditEntry[];
  loopId?: string;
  onAction?: (action: 'accept_head_start' | 'request_refresh' | 'request_info' | 'manual_review') => Promise<void>;
}

// ─── Decision State Mapping ────────────────────────────────────────

const DECISION_CONFIG: Record<DecisionState, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  confidence: 'measured' | 'estimated' | 'unverified';
}> = {
  ready:               { label: 'READY TO PROCEED',    color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-300', dot: 'bg-green-500',  confidence: 'measured' },
  proceed_with_review: { label: 'PROCEED WITH REVIEW', color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-300', dot: 'bg-amber-500',  confidence: 'estimated' },
  blocked:             { label: 'BLOCKED',              color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-300',   dot: 'bg-red-500',    confidence: 'unverified' },
  needs_data:          { label: 'NEEDS MORE DATA',      color: 'text-slate-700', bg: 'bg-slate-50',  border: 'border-slate-300', dot: 'bg-slate-400',  confidence: 'unverified' },
};

function deriveDecisionState(posture: ReadinessPosture, blockers: BlockerItem[]): DecisionState {
  if (posture === 'blocked') return 'blocked';
  if (posture === 'decision_grade') return 'ready';
  if (blockers.some(b => b.status === 'adverse')) return 'blocked';
  if (posture === 'partial') return 'proceed_with_review';
  return 'needs_data';
}

// ─── Console ──────────────────────────────────────────────────────

export function EmployerDecisionConsole({
  entityId, npi, name, taxonomy, state, posture, lanes, proofTier,
  score, blockers, nextAction, auditTrail, loopId, onAction, trustContainer,
}: ConsoleProps) {
  const decisionState = deriveDecisionState(posture, blockers);
  const cfg = DECISION_CONFIG[decisionState];
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<StateLogEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

  const handleAction = useCallback(async (
    action: Parameters<NonNullable<typeof onAction>>[0],
    label: string
  ) => {
    setActionLoading(action);
    setActionLog(prev => [...prev, { ts: Date.now(), message: `Sending: ${label}…`, level: 'info' }]);
    try {
      await onAction?.(action);
      setActionLog(prev => [...prev, { ts: Date.now(), message: `${label} — recorded`, level: 'info' }]);
    } catch {
      setActionLog(prev => [...prev, { ts: Date.now(), message: `${label} — failed`, level: 'error' }]);
    } finally {
      setActionLoading(null);
    }
  }, [onAction]);

  return (
    <div className="max-w-5xl mx-auto space-y-0 font-sans">

      {/* ── 1. Decision Header ── */}
      <div className={`rounded-t-xl border-b-0 border-2 ${cfg.border} ${cfg.bg} px-6 py-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
              <MetricBadge label={cfg.confidence} type={cfg.confidence} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              <span className="font-mono">{npi}</span>
              {taxonomy && <span> · {taxonomy}</span>}
              {state && <span> · {state}</span>}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2 flex-wrap justify-end">
              <PostureBadge posture={posture} />
              <ProofTierBadge tier={proofTier} />
            </div>
            {score !== null
              ? <p className="font-mono text-2xl font-black text-slate-800 tabular-nums">{score}<span className="text-xs font-normal text-slate-400 ml-0.5">%</span></p>
              : <p className="text-xs text-slate-400 italic">Score unavailable</p>
            }
          </div>
        </div>
        {/* Next Action — single line, always visible */}
        <div className="mt-4 flex items-start gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">Next Action</span>
          <span className="text-sm font-semibold text-slate-800">{nextAction}</span>
        </div>
      </div>

      <div className="border-2 border-t-0 border-slate-200 rounded-b-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">

          {/* ── LEFT: Main content ── */}
          <div className="divide-y divide-slate-100">

            {/* ── 2. Blocker Panel ── */}
            {blockers.length > 0 && (
              <section className="px-6 py-5">
                <h2 className="text-xs font-black uppercase tracking-widest text-red-600 mb-3">
                  What Is Blocking This Start
                </h2>
                <div className="space-y-3">
                  {blockers.map(b => (
                    <BlockerRow key={b.laneId} blocker={b} />
                  ))}
                </div>
              </section>
            )}

            {/* ── 3. Lane Evidence (inline proof) ── */}
            <section className="px-6 py-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                Source Coverage
              </h2>
              <div className="space-y-2">
                {lanes.map(lane => (
                  <LaneRow key={lane.laneId} lane={lane} />
                ))}
              </div>
            </section>

            {/* ── 5. Time Signal ── */}
            {blockers.some(b => b.estimatedDaysImpact !== null) && (
              <section className="px-6 py-4 bg-slate-50">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Estimated Readiness Impact
                </h2>
                <div className="space-y-1">
                  {blockers.filter(b => b.estimatedDaysImpact !== null).map(b => (
                    <p key={b.laneId} className="text-sm text-slate-700">
                      <span className="font-semibold">{b.displayName}:</span>{' '}
                      resolving may reduce onboarding delay by{' '}
                      <span className="font-mono font-bold text-amber-700">~{b.estimatedDaysImpact} days</span>
                      {' '}<span className="text-xs text-slate-400">(estimated)</span>
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* ── 6. Audit Trail ── */}
            <section className="px-6 py-4">
              <button
                onClick={() => setAuditOpen(v => !v)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
              >
                <span>{auditOpen ? '▾' : '▸'}</span>
                Audit Trail ({auditTrail.length} event{auditTrail.length !== 1 ? 's' : ''})
              </button>
              {auditOpen && (
                <div className="mt-3 space-y-2">
                  {auditTrail.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No actions recorded yet.</p>
                  )}
                  {auditTrail.map(entry => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                  {/* Trust Container UX — subordinate to source coverage */}
                  {trustContainer !== undefined ? (
                    <TrustContainerPanel entry={trustContainer} className="mt-4" />
                  ) : null}

                  {loopId && (
                    <p className="font-mono text-[10px] text-slate-400 pt-1">
                      Loop ID: {loopId}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── RIGHT: Action Rail ── */}
          <div className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 px-5 py-5 flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Actions</h2>

            <ActionButton
              label="Accept as Head Start"
              description="Signal intent to onboard. Pending OIG + license."
              impact="Writes audit event. Starts onboarding signal."
              variant="primary"
              loading={actionLoading === 'accept_head_start'}
              disabled={decisionState === 'blocked'}
              onClick={() => handleAction('accept_head_start', 'Accept as head start')}
            />

            <ActionButton
              label="Request Credential Refresh"
              description="Ask clinician to re-verify specific sources."
              impact="Sends refresh request. No state change."
              variant="secondary"
              loading={actionLoading === 'request_refresh'}
              onClick={() => handleAction('request_refresh', 'Request refresh')}
            />

            <ActionButton
              label="Request Missing Info"
              description="Flag specific gaps for clinician to fill."
              impact="Creates info request. Logs to audit."
              variant="secondary"
              loading={actionLoading === 'request_info'}
              onClick={() => handleAction('request_info', 'Request missing info')}
            />

            <ActionButton
              label="Route to Manual Review"
              description="Escalate to credentialing team."
              impact="Logs escalation. No data shared externally."
              variant="ghost"
              loading={actionLoading === 'manual_review'}
              onClick={() => handleAction('manual_review', 'Route to manual review')}
            />

            {/* Action feedback log */}
            {actionLog.length > 0 && (
              <div className="mt-2">
                <LiveStateLog entries={actionLog} maxHeight={120} autoScroll />
              </div>
            )}

            {/* Conversion panel */}
            <PilotConversionPanel
              entityId={entityId}
              npi={npi}
              posture={posture}
              proofTier={proofTier}
              score={score}
              decisionState={cfg.label}
              blockerCount={blockers.length}
              lanes={lanes}
            />

            {/* Proof tier context */}
            <div className="mt-auto pt-4 border-t border-slate-200 space-y-1">
              <ProofTierBadge tier={proofTier} />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {proofTier === 'none' && 'No lanes verified. Action available but proof is absent.'}
                {proofTier === 'partial' && 'Partial proof. Actions available with limitations.'}
                {proofTier === 'decision_grade' && 'All required lanes verified. Full proof pack available.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function BlockerRow({ blocker }: { blocker: BlockerItem }) {
  const isAdverse = blocker.status === 'adverse';
  return (
    <div className={`rounded-lg border px-4 py-3 ${isAdverse ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-slate-800">{blocker.displayName}</span>
        <StatusBadge status={blocker.status} />
      </div>
      <p className="text-xs text-slate-600 mb-1">{blocker.reason}</p>
      <p className={`text-xs font-semibold ${isAdverse ? 'text-red-700' : 'text-amber-700'}`}>
        → {blocker.requiredAction}
      </p>
    </div>
  );
}

function LaneRow({ lane }: { lane: LaneSnapshot }) {
  const [open, setOpen] = useState(false);
  const def = KNOWN_LANES.find(d => d.laneId === lane.laneId);
  const explanation = STATUS_EXPLANATIONS[lane.status as SourceStatus];

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">
            {def?.displayName ?? lane.laneId.replace(/_/g, ' ')}
          </span>
          {def?.isRequired && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Required</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={lane.status as SourceStatus} />
          <span className="text-slate-300 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100 space-y-2 text-xs">
          <p className="text-slate-600">{explanation}</p>
          {lane.value && (
            <p className="font-mono text-slate-700"><span className="text-slate-400">value:</span> {lane.value}</p>
          )}
          {lane.checkedAt && (
            <p className="font-mono text-slate-500">
              <span className="text-slate-400">checked_at:</span> {new Date(lane.checkedAt).toLocaleString()}
            </p>
          )}
          {lane.receiptId
            ? <p className="font-mono text-slate-500"><span className="text-slate-400">receipt_id:</span> {lane.receiptId}</p>
            : <p className="text-amber-600">No receipt — lane not verified in this session.</p>
          }
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const ts = new Date(entry.ts).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' });
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="font-mono text-slate-400 flex-shrink-0">{ts}</span>
      <div>
        <span className="font-semibold text-slate-700">{entry.action}</span>
        {entry.actor && <span className="text-slate-400"> · {entry.actor}</span>}
        {entry.stateChange && <span className="text-slate-400"> · {entry.stateChange}</span>}
      </div>
    </div>
  );
}

function ActionButton({
  label, description, impact, variant, loading, disabled, onClick,
}: {
  label: string;
  description: string;
  impact: string;
  variant: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const base = 'w-full text-left rounded-xl px-4 py-3 border transition-colors disabled:opacity-40';
  const styles = {
    primary:   `${base} bg-slate-900 hover:bg-slate-700 text-white border-slate-900`,
    secondary: `${base} bg-white hover:bg-slate-50 text-slate-800 border-slate-200`,
    ghost:     `${base} bg-transparent hover:bg-slate-100 text-slate-600 border-transparent`,
  }[variant];

  return (
    <button className={styles} disabled={disabled || loading} onClick={onClick}>
      <div className="font-bold text-sm mb-0.5">
        {loading ? 'Sending…' : label}
      </div>
      <div className={`text-xs opacity-70 mb-1`}>{description}</div>
      <div className={`text-[10px] font-mono opacity-50`}>{impact}</div>
    </button>
  );
}
