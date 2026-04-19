'use client';

/**
 * ClinicalPrivilegeDelta — Employer-side privilege ledger.
 *
 * Renders the requested clinical privileges (procedure-level), the required
 * proof, and the VitalCV-matched evidence, so a Medical Staff Office can see
 * privilege-to-evidence alignment without leaving the review surface.
 *
 * Doctrine
 * --------
 *   - Status vocabulary is a narrow literal union — no free-form labels
 *   - tabular-nums on all case counts and windows so rows stay optically locked
 *   - Absent evidence renders as "Not on file" / "0 cases logged" rather than
 *     a cheerful placeholder; the gap drives the peer-reference CTA
 *   - Brutal density: the table leads with what hospital MSOs actually care
 *     about (procedure · required · matched · gap) before any decoration
 */

import React from 'react';
import { Lock, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

void React;
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type {
  ClinicalPrivilegeRequest,
  PrivilegeProofStatus,
} from '@/lib/clinical/privilege-types';

interface ClinicalPrivilegeDeltaProps {
  privileges: ClinicalPrivilegeRequest[];
  className?: string;
  onRequestPeerReference?: (privilege: ClinicalPrivilegeRequest) => void;
  peerReferenceDisabled?: boolean;
  peerReferenceDisabledReason?: string;
}

const STATUS_TO_BADGE: Record<PrivilegeProofStatus, {
  status: 'checked' | 'pending' | 'review_required' | 'access_required' | 'unavailable';
  label: string;
}> = {
  met:            { status: 'checked',        label: 'Met' },
  partial:        { status: 'review_required', label: 'Partial' },
  missing:        { status: 'unavailable',    label: 'No evidence' },
  peer_requested: { status: 'pending',        label: 'Peer ref requested' },
  not_applicable: { status: 'access_required', label: 'N/A' },
};

function formatCaseCount(
  count: number | null | undefined,
  required: number | null | undefined,
): string {
  const have = typeof count === 'number' ? count : null;
  const need = typeof required === 'number' ? required : null;
  if (have === null && need === null) return '—';
  if (have === null) return `— / ${need}`;
  if (need === null) return `${have}`;
  return `${have} / ${need}`;
}

export function ClinicalPrivilegeDelta({
  privileges,
  className,
  onRequestPeerReference,
  peerReferenceDisabled,
  peerReferenceDisabledReason,
}: ClinicalPrivilegeDeltaProps) {
  const metCount = privileges.filter((p) => p.status === 'met').length;
  const gapCount = privileges.filter(
    (p) => p.status === 'missing' || p.status === 'partial' || p.status === 'peer_requested',
  ).length;

  return (
    <section
      data-slot="clinical-privilege-delta"
      className={cn(
        'rounded-2xl border border-[var(--vt-border)] bg-card px-5 py-4',
        className,
      )}
      aria-label="Requested clinical privileges"
    >
      <header className="flex flex-col gap-3 border-b border-white/6 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Requested clinical privileges
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Procedure-level proof aligned to the institution&apos;s privilege criteria.
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
          <span>
            <span className="text-foreground/80">{metCount}</span>
            <span className="text-muted-foreground/50"> met</span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground/30">·</span>
          <span>
            <span className="text-foreground/80">{gapCount}</span>
            <span className="text-muted-foreground/50"> gap{gapCount === 1 ? '' : 's'}</span>
          </span>
        </div>
      </header>

      {privileges.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground/50">
          No privilege requests attached to this review yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-white/6 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40">
                <th scope="col" className="py-2 pr-3 font-semibold">Privilege</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Required proof</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Matched evidence</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Cases</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Window</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                <th scope="col" className="py-2 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {privileges.map((row) => {
                const badge = STATUS_TO_BADGE[row.status];
                const needsPeer =
                  row.status === 'missing' || row.status === 'partial';
                const hasPeerPending = row.status === 'peer_requested';
                return (
                  <tr
                    key={row.id}
                    className="border-b border-white/4 align-top last:border-0"
                    data-privilege-id={row.id}
                    data-privilege-status={row.status}
                  >
                    <td className="py-3 pr-3">
                      <div className="font-medium text-foreground/90 leading-tight">
                        {row.label}
                      </div>
                      {row.context && (
                        <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground/40">
                          {row.context}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs leading-relaxed text-foreground/60">
                      {row.requiredProof}
                    </td>
                    <td className="py-3 pr-3 text-xs leading-relaxed">
                      <span className={cn(
                        'leading-relaxed',
                        row.matchedEvidence ? 'text-foreground/70' : 'text-muted-foreground/50',
                      )}>
                        {row.matchedEvidence ?? 'Not on file'}
                      </span>
                      {row.note && (
                        <span className="mt-1 block text-[10px] italic leading-relaxed text-muted-foreground/50">
                          {row.note}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <span className="font-mono text-xs tabular-nums text-foreground/70">
                        {formatCaseCount(row.caseCount, row.caseCountRequired)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <span className="font-mono text-[11px] uppercase tabular-nums text-muted-foreground/60">
                        {row.window ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <TrustStatusBadge
                        status={badge.status}
                        label={badge.label}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 text-right">
                      {(needsPeer || hasPeerPending) ? (
                        <button
                          type="button"
                          onClick={() => onRequestPeerReference?.(row)}
                          disabled={peerReferenceDisabled || hasPeerPending}
                          title={
                            hasPeerPending
                              ? 'Peer reference request is in flight.'
                              : peerReferenceDisabled
                                ? peerReferenceDisabledReason
                                : 'Request a peer reference to close this gap.'
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border border-[var(--vt-border)] bg-transparent px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/70 transition-colors',
                            'hover:border-foreground/40 hover:text-foreground',
                            'disabled:cursor-not-allowed disabled:border-white/6 disabled:text-muted-foreground/40',
                          )}
                          data-privilege-peer-cta={row.id}
                        >
                          {hasPeerPending ? (
                            <>
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              Requested
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3 w-3" aria-hidden="true" />
                              Peer reference
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ClinicalPrivilegeDelta;
