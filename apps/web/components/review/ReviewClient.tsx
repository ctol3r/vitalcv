'use client';

/**
 * ReviewClient.tsx — Employer decision surface
 *
 * THE DECISION SURFACE. One screen. Can you hire this person?
 *
 * Layout (spec-exact):
 *   Header         — VitalCV + "Employer review"
 *   DecisionCard   — Name, specialty, READY/PARTIAL/BLOCKED, start estimate, confidence
 *   ReadinessBreak — Identity / Authority / Standing / Enrollment rows
 *   ProofPanel     — accordion: each credential with source + timestamp + status
 *   ActionPanel    — Accept / Request missing / Save
 *   ShareContext   — if accessed via share link, shows who shared + when
 *
 * UX rules:
 *   - Decision first, proof collapsible
 *   - < 10 seconds to decide
 *   - No tabs, no sidebars, no clutter
 *   - Status via opacity only (doctrine)
 */

import { useState } from 'react';
import Link from 'next/link';
import { Accordion } from '@/components/ui/vcv-accordion';
import type { AccordionItem } from '@/components/ui/vcv-accordion';
import type { PassportData, ReadinessStatus } from '@/app/passport/[id]/page';

// ── Decision card config ───────────────────────────────────────────────────────

const DECISION_CONFIG: Record<ReadinessStatus, {
  label:    string;
  opacity:  string;
  border:   string;
  bg:       string;
  confidence: string;
}> = {
  READY:   { label: 'Ready to hire',     opacity: 'text-white/80', border: 'border-white/15', bg: 'bg-white/6',  confidence: 'HIGH' },
  PARTIAL: { label: 'Conditionally ready', opacity: 'text-white/55', border: 'border-white/10', bg: 'bg-white/4', confidence: 'MEDIUM' },
  BLOCKED: { label: 'Blocked — action required', opacity: 'text-white/40', border: 'border-white/8', bg: 'bg-white/3', confidence: 'LOW' },
};

// ── Readiness row ─────────────────────────────────────────────────────────────

function ReadinessRow({
  label,
  verified,
  detail,
}: {
  label:    string;
  verified: boolean | null;  // null = unknown/pending
  detail?:  string;
}) {
  const icon   = verified === true ? '✓' : verified === false ? '✕' : '·';
  const opacity = verified === true ? 'text-white/65' : verified === false ? 'text-white/35' : 'text-white/30';
  const iconOp  = verified === true ? 'text-white/35' : 'text-white/15';

  return (
    <div className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={`text-xs w-4 text-center select-none shrink-0 ${iconOp}`} aria-hidden>{icon}</span>
        <span className={`text-sm ${opacity}`}>{label}</span>
      </div>
      {detail && <span className="text-white/25 text-xs shrink-0 ml-2">{detail}</span>}
    </div>
  );
}

function formatProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

function exclusionRowState(status: PassportData['standing']['exclusionStatus']): boolean | null {
  if (status === 'CLEAR') return true;
  if (status === 'EXCLUDED') return false;
  return null;
}

function exclusionSectionStatus(status: PassportData['standing']['exclusionStatus']): AccordionItem['status'] {
  if (status === 'CLEAR') return 'clear';
  if (status === 'UNCHECKED' || status === 'UNKNOWN') return 'pending';
  return 'action';
}

// ── Proof accordion builder ────────────────────────────────────────────────────

function buildProofSections(passport: PassportData): AccordionItem[] {
  const items: AccordionItem[] = [];

  // Credentials
  if (passport.authority.credentials.length > 0) {
    items.push({
      id:      'credentials',
      trigger: `Credentials (${passport.authority.credentials.length})`,
      status:  passport.authority.summary.active > 0 ? 'verified' : 'action',
      content: (
        <div className="py-1 space-y-1">
          {passport.authority.credentials.map(c => (
            <div key={c.id} className="py-2 border-b border-white/5 last:border-0">
              <div className="flex justify-between text-xs">
                <span className="text-white/65 capitalize">{c.domain.replace(/_/g, ' ').toLowerCase()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  c.status === 'ACTIVE' ? 'border-white/10 text-white/45 bg-white/4' : 'border-white/6 text-white/25 bg-white/3'
                }`}>{c.status}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-white/30">
                  Source: {c.issuerName ?? c.sourceId ?? c.verificationLevel}
                </span>
                {(c.observedAt ?? c.verifiedAt) && (
                  <span className="text-white/25">
                    Checked: {formatProofDate(c.observedAt ?? c.verifiedAt)}
                  </span>
                )}
              </div>
              {(c.claimConfidenceLabel || c.dataFreshnessLabel || c.jurisdiction) && (
                <div className="text-white/25 text-xs mt-0.5">
                  {[c.claimConfidenceLabel, c.dataFreshnessLabel, c.jurisdiction].filter(Boolean).join(' · ')}
                </div>
              )}
              {(c.claimState || c.sourceDisclaimer) && (
                <div className="text-white/20 text-xs mt-0.5">
                  {[c.claimState, c.sourceDisclaimer].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    });
  }

  // Sanctions
  items.push({
    id:      'sanctions',
    trigger: 'Sanctions check',
    status:  exclusionSectionStatus(passport.standing.exclusionStatus),
    content: (
      <div className="py-1">
        <div className="flex justify-between text-xs py-1.5 border-b border-white/5">
          <span className="text-white/35">Source</span>
          <span className="text-white/55">OIG / LEIE</span>
        </div>
        <div className="flex justify-between text-xs py-1.5 border-b border-white/5">
          <span className="text-white/35">Status</span>
          <span className="text-white/55">{passport.standing.exclusionStatus}</span>
        </div>
        <div className="flex justify-between text-xs py-1.5">
          <span className="text-white/35">Checked</span>
          <span className="text-white/55">
            {formatProofDate(passport.standing.exclusionCheckedAt ?? passport.lastCheckedAt) ?? 'Unknown'}
          </span>
        </div>
        {passport.standing.exclusionConfidenceLabel && (
          <div className="flex justify-between text-xs py-1.5">
            <span className="text-white/35">Confidence</span>
            <span className="text-white/55">{passport.standing.exclusionConfidenceLabel}</span>
          </div>
        )}
      </div>
    ),
  });

  // Training
  if (passport.training.records.length > 0) {
    items.push({
      id:      'training',
      trigger: 'Training confirmed by issuing institution',
      status:  passport.training.degreeVerified ? 'verified' : 'pending',
      content: (
        <div className="py-1 space-y-1">
          {passport.training.records.slice(0, 4).map(r => (
            <div key={r.id} className="py-1.5 border-b border-white/5 last:border-0">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">{r.degreeOrTitle ?? r.recordType.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="text-white/30">{r.endYear ?? '—'}</span>
              </div>
              {r.institutionName && (
                <div className="text-white/25 text-xs mt-0.5">{r.institutionName}</div>
              )}
            </div>
          ))}
        </div>
      ),
    });
  }

  return items;
}

// ── Main review component ──────────────────────────────────────────────────────

interface Props {
  passport:   PassportData;
  contextId?: string;
  sharedBy?:  string;
}

export default function ReviewClient({ passport, contextId: _contextId, sharedBy }: Props) {
  const [action, setAction] = useState<'none' | 'accepted' | 'requested' | 'saved'>('none');

  const { identity, readiness, standing, authority } = passport;
  const cfg = DECISION_CONFIG[readiness.status];

  // Readiness breakdown rows
  const licenseActive     = authority.credentials.some(c => c.domain === 'LICENSURE' && c.status === 'ACTIVE');
  const deaActive         = standing.deaStatus === 'registered';
  const pecosEnrolled     = standing.pecosStatus === 'enrolled';
  const sanctionsClear    = standing.exclusionStatus === 'CLEAR';

  const missingDomains    = authority.summary.missing;
  const blocked = Array.from(new Set([
    ...readiness.blockers,
    ...missingDomains.map((domain) => domain.replace(/_/g, ' ').toLowerCase()),
  ]));
  const nextAction = blocked[0] ?? readiness.gaps[0] ?? 'Proceed to hire';
  const exclusionDetail = [
    standing.exclusionConfidenceLabel,
    formatProofDate(standing.exclusionCheckedAt),
  ].filter(Boolean).join(' · ');
  const enrollmentDetail = [
    standing.enrollmentObservedAt ? `As of ${formatProofDate(standing.enrollmentObservedAt)}` : null,
    standing.enrollmentFreshnessLabel,
  ].filter(Boolean).join(' · ');

  const proofItems = buildProofSections(passport);

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-10 sm:pt-16 pb-28">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-white/25 text-xs tracking-widest uppercase">VitalCV</span>
          <span className="text-white/25 text-xs">Employer review</span>
        </div>

        {/* ── Share context (if accessed via share link) ───────────────────── */}
        {sharedBy && (
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
            <div className="flex justify-between text-xs">
              <span className="text-white/35">Shared by</span>
              <span className="text-white/55">{sharedBy}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-white/35">Purpose</span>
              <span className="text-white/55">Employment review</span>
            </div>
          </div>
        )}

        {/* ── Decision card — above the fold ──────────────────────────────── */}
        <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} px-5 py-5 space-y-4 mb-6`}>

          {/* Identity */}
          <div>
            <h1 className="text-white text-xl font-semibold leading-tight">
              {identity.displayName}
            </h1>
            {identity.specialty && (
              <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
            )}
          </div>

          {/* Decision status */}
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${cfg.opacity}`}>{cfg.label}</span>
            <span className="text-white/25 text-xs">Confidence: {cfg.confidence}</span>
          </div>
        </div>

        {/* ── Employer Decision Breakdown ──────────────────────────────────── */}
        <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 space-y-1 mb-6">
          <div className="pt-2 pb-1 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">1. Safety</div>
          <ReadinessRow label="Not excluded" verified={exclusionRowState(standing.exclusionStatus)} detail={exclusionDetail || 'OIG / LEIE'} />
          <ReadinessRow label="License active" verified={licenseActive} detail={licenseActive ? 'Confirmed' : 'Review required'} />

          <div className="pt-4 pb-1 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] border-t border-white/5 mt-3">2. Eligibility</div>
          <ReadinessRow label="Medicare enrolled" verified={pecosEnrolled} detail={enrollmentDetail || 'Point-in-time PECOS'} />

          <div className="pt-4 pb-1 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] border-t border-white/5 mt-3">3. Readiness</div>
          <ReadinessRow label={`Readiness: ${readiness.score}%`} verified={readiness.score >= 80} />
          <ReadinessRow label="Blockers" verified={blocked.length === 0} detail={blocked.length > 0 ? blocked.join(', ') : 'None'} />
          <ReadinessRow label="Next action" verified={blocked.length === 0} detail={nextAction} />

          <div className="pt-4 pb-1 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] border-t border-white/5 mt-3">4. Timeline</div>
          <ReadinessRow label="When they can begin" verified={readiness.estimatedStartDays !== null && readiness.estimatedStartDays <= 14} detail={readiness.estimatedStartDays === null ? 'Blocked' : readiness.estimatedStartDays === 0 ? 'Ready now' : `~${readiness.estimatedStartDays} days`} />
        </div>

        {/* ── Proof panel — collapsible ────────────────────────────────────── */}
        {proofItems.length > 0 && (
          <div>
            <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Proof</p>
            <Accordion items={proofItems} />
          </div>
        )}

        {/* ── Action panel ─────────────────────────────────────────────────── */}
        {action === 'none' ? (
          <div className="space-y-3 pt-2">
            {/* Primary */}
            <button
              onClick={() => setAction('accepted')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white rounded-xl h-14 text-sm font-medium transition-all"
            >
              Accept / Proceed
            </button>

            {/* Secondary row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAction('requested')}
                className="rounded-xl border border-white/10 bg-white/4 text-white/55 hover:text-white/80 hover:bg-white/8 text-xs py-3.5 min-h-[48px] transition-all"
              >
                Request missing
              </button>
              <button
                onClick={() => setAction('saved')}
                className="rounded-xl border border-white/10 bg-white/4 text-white/55 hover:text-white/80 hover:bg-white/8 text-xs py-3.5 min-h-[48px] transition-all"
              >
                Save / Track
              </button>
            </div>

            {/* Tertiary */}
            <div className="flex justify-center gap-5 pt-1">
              <Link
                href={`/passport/${passport.entityId}`}
                className="text-white/25 hover:text-white/45 text-xs transition-colors min-h-[44px] flex items-center"
              >
                Full passport
              </Link>
              <button className="text-white/25 hover:text-white/45 text-xs transition-colors min-h-[44px]">
                Download bundle
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation state */
          <div className="rounded-xl border border-white/10 bg-white/4 px-5 py-4 text-center space-y-1">
            <p className="text-white/70 text-sm font-medium">
              {action === 'accepted'  ? 'Decision recorded'
               : action === 'requested' ? 'Request sent'
               :                          'Saved to your pipeline'}
            </p>
            <p className="text-white/30 text-xs">
              {action === 'accepted'  ? `${identity.displayName} — accepted for review`
               : action === 'requested' ? 'Provider will be notified of missing items'
               :                          'Added to your tracking queue'}
            </p>
            <button
              onClick={() => setAction('none')}
              className="text-white/25 hover:text-white/40 text-xs mt-2 transition-colors min-h-[44px] block w-full"
            >
              Undo
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
