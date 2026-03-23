'use client';

import Link from 'next/link';

/**
 * PassportWallet.tsx — The Your readiness
 *
 * THE PRODUCT. One screen. One truth.
 *
 * Sections (spec-exact):
 *   Header       — VitalCV wordmark only
 *   PassportCard — Name, specialty, readiness status
 *   Readiness    — ✔ verified / ✖ needed / estimated start
 *   Details      — accordion: Identity, Authority, Training, Standing
 *   Share        — [Share with employer] → biometric → POST /api/share
 *
 * Doctrine:
 *   - Status conveyed through opacity, not colour
 *   - Status badge: small pill, neutral on all states
 *   - Green (emerald) only on the Share CTA button
 *   - No sidebars, no secondary nav, no decorative gradients
 *   - Mobile-first: single column, no horizontal scroll
 *   - Touch targets ≥ 44px, font-size ≥ 16px
 */

import { useState } from 'react';
import { Accordion } from '@/components/ui/vcv-accordion';
import type { AccordionItem } from '@/components/ui/vcv-accordion';
import type { PassportData, ReadinessStatus } from '@/app/passport/[id]/page';
import FastestPathPanel from '@/components/passport/FastestPathPanel';

// ── Status configuration ──────────────────────────────────────────────────────
// NO colour on status. Hierarchy via opacity only.

const STATUS_CONFIG: Record<ReadinessStatus, {
  label:        string;
  labelOpacity: string;
  cardBorder:   string;
  cardBg:       string;
}> = {
  READY:   { label: 'Ready',          labelOpacity: 'text-white/80', cardBorder: 'border-white/15', cardBg: 'bg-white/6' },
  PARTIAL: { label: 'Partial',        labelOpacity: 'text-white/55', cardBorder: 'border-white/10', cardBg: 'bg-white/4' },
  BLOCKED: { label: 'Action needed',  labelOpacity: 'text-white/40', cardBorder: 'border-white/8',  cardBg: 'bg-white/3' },
};

// ── Row primitives ─────────────────────────────────────────────────────────────

function VerifiedRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-white/40 text-xs w-4 text-center select-none" aria-hidden>✓</span>
      <span className="text-white/70">{label}</span>
    </div>
  );
}

function MissingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-white/20 text-xs w-4 text-center select-none" aria-hidden>✕</span>
      <span className="text-white/40">{label}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/35">{label}</span>
      <span className="text-white/65">{value}</span>
    </div>
  );
}

function formatProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

// ── Accordion section builders ─────────────────────────────────────────────────

function buildIdentitySection(passport: PassportData): AccordionItem {
  const { identity, sources, lastCheckedAt } = passport;
  return {
    id:      'identity',
    trigger: 'Identity',
    status:  identity.status === 'ACTIVE' ? 'verified' : 'pending',
    content: (
      <div className="py-1">
        <DetailRow label="Name"       value={identity.displayName} />
        <DetailRow label="Specialty"  value={identity.specialty} />
        <DetailRow label="NPI"        value={identity.npi} />
        <DetailRow label="Type"       value={identity.entityType === 'PERSON' ? 'Individual provider' : 'Organization'} />
        <DetailRow label="Source"     value="CMS NPPES" />
        <DetailRow label="Last check" value={new Date(lastCheckedAt).toLocaleDateString()} />
      </div>
    ),
  };
}

// ── Unified row display contract (MS16-E) ─────────────────────────────────────
// All rows (identity, safety, authority, eligibility) use the same shape.
// This is the canonical contract — do not deviate.

interface TrustRowProps {
  title:        string;
  status:       'active' | 'enrolled' | 'not_found' | 'expired' | 'review' | 'unavailable' | 'pending' | 'unchecked';
  sourceLabel:  string;
  checkedAt?:   string | null;
  confidence?:  string | null;
  freshness?:   string | null;
  dataVersion?: string | null;
  note?:        string | null;
}

// ── Authority row renderer (MS15) ────────────────────────────────────────────
// Shared display contract: title · status · source · checkedAt · confidence · freshness

interface AuthorityRowProps {
  title:       string;
  status:      'active' | 'expired' | 'review' | 'unavailable' | 'pending';
  sourceLabel: string;
  checkedAt?:  string | null;
  confidence?: string | null;
  freshness?:  string | null;
  note?:       string | null;
}

function AuthorityRow({ title, status, sourceLabel, checkedAt, confidence, freshness, note }: AuthorityRowProps) {
  const statusText = {
    active:      'Active',
    expired:     'Expired',
    review:      'Review required',
    unavailable: 'Not available',
    pending:     'Not verified',
  }[status];

  const statusOpacity = {
    active:      'text-white/55',
    expired:     'text-white/35',
    review:      'text-white/40',
    unavailable: 'text-white/20',
    pending:     'text-white/25',
  }[status];

  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs">
        <span className="text-white/65">{title}</span>
        <span className={`text-xs ${statusOpacity}`}>{statusText}</span>
      </div>
      <div className="flex justify-between text-xs mt-0.5">
        <span className="text-white/25">Source: {sourceLabel}</span>
        {freshness && <span className="text-white/15">{freshness}</span>}
      </div>
      {(checkedAt || confidence) && (
        <div className="text-white/20 text-xs mt-0.5 flex gap-2 flex-wrap">
          {checkedAt && <span>Checked {checkedAt}</span>}
          {confidence && <span>· {confidence}</span>}
        </div>
      )}
      {note && <div className="text-white/15 text-xs mt-0.5 leading-relaxed">{note}</div>}
    </div>
  );
}

function claimCodeToStatus(
  code?: string,
  reviewRequired?: boolean,
  credStatus?: string,
): AuthorityRowProps['status'] {
  if (code === 'AUTHORITY_UNAVAILABLE')       return 'unavailable';
  if (code === 'BOARD_ORDER_PRESENT')         return 'review';
  if (code === 'RN_LICENSE_DISCIPLINED')      return 'review';
  if (reviewRequired)                         return 'review';
  if (code === 'RN_LICENSE_EXPIRED')          return 'expired';
  if (credStatus === 'EXPIRED')               return 'expired';
  if (code === 'PHYSICIAN_LICENSE_ACTIVE')    return 'active';
  if (code === 'RN_LICENSE_ACTIVE')           return 'active';
  if (code === 'BOARD_CERTIFIED')             return 'active';
  if (code === 'TRAINING_COMPLETED')          return 'active';
  if (credStatus === 'ACTIVE')                return 'active';
  return 'pending';
}

function claimCodeToTitle(c: PassportData['authority']['credentials'][0]): string {
  const code = c.authorityClaimCode;
  const state = c.jurisdiction ? ` (${c.jurisdiction})` : '';
  if (code === 'PHYSICIAN_LICENSE_ACTIVE')    return `Physician license${state}`;
  if (code === 'RN_LICENSE_ACTIVE')           return `Nursing license${state}`;
  if (code === 'RN_LICENSE_EXPIRED')          return `Nursing license${state} — expired`;
  if (code === 'RN_LICENSE_DISCIPLINED')      return `Nursing license${state} — disciplinary record`;
  if (code === 'BOARD_CERTIFIED')             return `Board certified`;
  if (code === 'BOARD_ORDER_PRESENT')         return `Board order present${state}`;
  if (code === 'TRAINING_COMPLETED')          return `Training completed`;
  if (code === 'AUTHORITY_UNAVAILABLE') {
    const participation = c.participationStatus;
    if (participation === 'non_participating_state')       return `License verification — state not in network${state}`;
    if (participation === 'institution_access_unavailable') return `License verification — source not configured${state}`;
    return `License verification — unavailable${state}`;
  }
  // Fallback: use domain
  if (c.domain === 'LICENSURE')          return `License${state}`;
  if (c.domain === 'BOARD_CERTIFICATION') return `Board certification`;
  return c.domain.replace(/_/g, ' ').toLowerCase();
}

function claimCodeToNote(c: PassportData['authority']['credentials'][0]): string | null {
  const code = c.authorityClaimCode;
  const severity = c.boardOrderSeverity;
  if (code === 'BOARD_ORDER_PRESENT') {
    const sev = severity && severity !== 'NONE' ? ` Severity: ${severity}.` : '';
    return `A board order is on file for this license.${sev} Manual employer review required before proceeding.`;
  }
  if (code === 'AUTHORITY_UNAVAILABLE') {
    const p = c.participationStatus;
    if (p === 'non_participating_state' && c.jurisdiction)
      return `${c.jurisdiction} does not participate in automated license verification. Request a board-issued verification letter directly.`;
    if (p === 'institution_access_unavailable')
      return 'Requires institutional FSMB or Nursys agreement. Contact your administrator.';
    return 'Authority source access not configured for this record.';
  }
  if (code === 'RN_LICENSE_DISCIPLINED')
    return 'A disciplinary action is recorded on this license. Review required before clinical placement.';
  return null;
}

function buildAuthoritySection(passport: PassportData): AccordionItem {
  const { authority } = passport;

  const hasBoardOrder   = authority.credentials.some(c => c.authorityClaimCode === 'BOARD_ORDER_PRESENT' || (c.boardOrderSeverity && c.boardOrderSeverity !== 'NONE'));
  const hasActive       = authority.summary.active > 0;
  const hasUnavailable  = authority.credentials.some(c => c.authorityClaimCode === 'AUTHORITY_UNAVAILABLE' || c.connectorState === 'unavailable' || c.connectorState === 'unresolved');
  const hasLicensure    = authority.credentials.some(c => c.domain === 'LICENSURE');
  const hasBoardCert    = authority.credentials.some(c => c.domain === 'BOARD_CERTIFICATION');

  const sectionStatus: AccordionItem['status'] =
    hasBoardOrder                                                ? 'action'
    : hasActive && !hasUnavailable                               ? 'verified'
    : hasUnavailable && !hasActive                               ? 'pending'
    : 'action';

  return {
    id:      'authority',
    trigger: 'Authority',
    status:  sectionStatus,
    content: (
      <div className="py-1 space-y-0">

        {/* Real credential rows — authority claim code drives display */}
        {authority.credentials.map(c => (
          <AuthorityRow
            key={c.id}
            title={claimCodeToTitle(c)}
            status={claimCodeToStatus(c.authorityClaimCode, c.reviewRequired, c.status)}
            sourceLabel={c.issuerName ?? c.sourceId ?? 'Unknown source'}
            checkedAt={c.observedAt ? formatProofDate(c.observedAt) : null}
            confidence={c.claimConfidenceLabel}
            freshness={c.dataFreshnessLabel}
            note={claimCodeToNote(c)}
          />
        ))}

        {/* Honest placeholder: no licensure credentials at all */}
        {!hasLicensure && (
          <AuthorityRow
            title="License — not yet verified"
            status="unavailable"
            sourceLabel="FSMB / Nursys"
            note="Institutional source access required. Neither FSMB nor Nursys is currently connected."
          />
        )}

        {/* Board cert placeholder */}
        {!hasBoardCert && (
          <div className="py-1.5 text-xs text-white/20">
            · Board certification — not on file
          </div>
        )}

        {/* Missing blocking domains (exclude always-present ones) */}
        {authority.summary.missing
          .filter(d => !['IDENTITY', 'EXCLUSION_CHECK'].includes(d))
          .map(d => (
            <div key={d} className="text-white/20 text-xs py-0.5">
              Missing: {d.replace(/_/g, ' ').toLowerCase()}
            </div>
          ))}
      </div>
    ),
  };
}

function buildTrainingSection(passport: PassportData): AccordionItem {
  const { training } = passport;
  return {
    id:      'training',
    trigger: 'Training confirmed by issuing institution',
    status:  training.degreeVerified && training.hasResidency ? 'verified'
           : training.hasDegree                               ? 'pending'
           : 'action',
    content: (
      <div className="py-1 space-y-1">
        {training.records.length === 0 && (
          <p className="text-white/25 text-xs py-1">No training records on file.</p>
        )}
        {training.records.map(r => (
          <div key={r.id} className="py-1.5 border-b border-white/5 last:border-0">
            <div className="flex justify-between text-xs">
              <span className="text-white/65">{r.degreeOrTitle ?? r.recordType.replace(/_/g, ' ').toLowerCase()}</span>
              <span className="text-white/35">{r.endYear ?? '—'}</span>
            </div>
            {(r.institutionName || r.specialty) && (
              <div className="text-white/30 text-xs mt-0.5">
                {[r.institutionName, r.specialty].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  };
}

function buildStandingSection(passport: PassportData): AccordionItem {
  const { standing } = passport;
  // Standing = exclusion / sanctions only (PECOS moved to Eligibility section)
  const safetyNegative = standing.negativeFindings.filter(f =>
    !/pecos|enrollment|medicare/i.test(f)
  );
  const allClear =
    standing.exclusionClear &&
    standing.licensureStatus === 'verified' &&
    safetyNegative.length === 0;

  return {
    id:      'standing',
    trigger: 'Safety',
    status:  allClear                               ? 'clear'
           : standing.exclusionStatus === 'UNCHECKED' ? 'pending'
           : safetyNegative.length > 0             ? 'action'
           : 'pending',
    content: (
      <div className="py-1">
        <DetailRow label="Exclusion check"   value={standing.exclusionStatus} />
        <DetailRow label="Checked"           value={formatProofDate(standing.exclusionCheckedAt)} />
        <DetailRow label="Confidence"        value={standing.exclusionConfidenceLabel} />
        <DetailRow label="License"           value={standing.licensureStatus} />
        <DetailRow label="DEA"               value={standing.deaStatus} />
        {safetyNegative.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
            <span className="text-white/25 select-none">⚠</span>
            <span className="text-white/50">{f}</span>
          </div>
        ))}
        {safetyNegative.length === 0 && (
          <div className="text-white/30 text-xs pt-1">No negative findings.</div>
        )}
      </div>
    ),
  };
}

// ── MS16-B: Eligibility row (same contract as AuthorityRow) ──────────────────

interface EligibilityRowProps {
  title:        string;
  /** ENROLLED | NOT_FOUND | UNKNOWN | UNCHECKED */
  status:       'enrolled' | 'not_found' | 'unknown' | 'unchecked';
  sourceLabel:  string;
  checkedAt?:   string | null;
  dataVersion?: string | null;
  freshness?:   string | null;
  confidence?:  string | null;
  note?:        string | null;
}

function EligibilityRow({
  title, status, sourceLabel, checkedAt, dataVersion, freshness, confidence, note,
}: EligibilityRowProps) {
  const icon =
    status === 'enrolled'  ? '✔' :
    status === 'not_found' ? '⚠' :
    '○';

  const iconOpacity =
    status === 'enrolled'  ? 'text-white/45' :
    status === 'not_found' ? 'text-white/35' :
    'text-white/20';

  const titleOpacity =
    status === 'enrolled'  ? 'text-white/65' :
    status === 'not_found' ? 'text-white/50' :
    'text-white/30';

  const statusText =
    status === 'enrolled'  ? 'Enrolled' :
    status === 'not_found' ? 'Not found' :
    status === 'unknown'   ? 'Unconfirmed' :
    'Not checked';

  const statusOpacity =
    status === 'enrolled'  ? 'text-white/45' :
    status === 'not_found' ? 'text-white/30' :
    'text-white/20';

  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs gap-2">
        <span className={`flex items-center gap-1.5 ${titleOpacity}`}>
          <span className={`${iconOpacity} select-none w-3 shrink-0`} aria-hidden>{icon}</span>
          {title}
        </span>
        <span className={`text-xs shrink-0 ${statusOpacity}`}>{statusText}</span>
      </div>
      <div className="flex justify-between text-xs mt-0.5 pl-4">
        <span className="text-white/25">Source: {sourceLabel}</span>
        {freshness && <span className="text-white/15">{freshness}</span>}
      </div>
      {(checkedAt || dataVersion || confidence) && (
        <div className="text-white/20 text-xs mt-0.5 pl-4 flex gap-2 flex-wrap">
          {dataVersion && <span>{dataVersion}</span>}
          {checkedAt && <span>· Checked {checkedAt}</span>}
          {confidence && <span>· {confidence}</span>}
        </div>
      )}
      {note && <div className="text-white/15 text-xs mt-0.5 pl-4 leading-relaxed">{note}</div>}
    </div>
  );
}

function buildEligibilitySection(passport: PassportData): AccordionItem {
  const { standing } = passport;
  const s = standing.pecosEnrollmentStatus ?? (
    standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
    standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
  );

  const rowStatus: EligibilityRowProps['status'] =
    s === 'ENROLLED'  ? 'enrolled' :
    s === 'NOT_FOUND' ? 'not_found' :
    s === 'UNKNOWN'   ? 'unknown' :
    'unchecked';

  const sectionStatus: AccordionItem['status'] =
    rowStatus === 'enrolled'  ? 'clear' :
    rowStatus === 'not_found' ? 'action' :
    'pending';

  // Build observed-as quarter label
  function enrolledAsLabel(observedAt?: string | null, dataVersion?: string | null): string | null {
    if (dataVersion) return dataVersion;
    if (!observedAt) return null;
    const d = new Date(observedAt);
    if (Number.isNaN(d.getTime())) return null;
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} ${d.getFullYear()}`;
  }

  const quarterLabel = enrolledAsLabel(standing.enrollmentObservedAt, standing.enrollmentDataVersion);
  const titleWithQuarter =
    rowStatus === 'enrolled' && quarterLabel
      ? `Medicare enrolled — as of ${quarterLabel}`
      : rowStatus === 'enrolled'
        ? 'Medicare enrolled'
        : rowStatus === 'not_found'
          ? 'Medicare enrollment — not found'
          : 'Medicare enrollment';

  return {
    id:      'eligibility',
    trigger: 'Eligibility',
    status:  sectionStatus,
    content: (
      <div className="py-1 space-y-0">
        <EligibilityRow
          title={titleWithQuarter}
          status={rowStatus}
          sourceLabel={standing.enrollmentSourceLabel ?? 'CMS PECOS'}
          checkedAt={standing.enrollmentObservedAt ? formatProofDate(standing.enrollmentObservedAt) : null}
          dataVersion={quarterLabel}
          freshness={standing.enrollmentDataFreshness ?? standing.enrollmentFreshnessLabel ?? 'Quarterly'}
          confidence={standing.enrollmentConfidenceLabel ?? undefined}
          note={standing.enrollmentNote ?? undefined}
        />
        {rowStatus === 'not_found' && (
          <div className="py-1.5 text-white/20 text-xs pl-4 leading-relaxed">
            Not finding a provider in PECOS may indicate non-enrollment or a quarterly data lag.
            Confirm by requesting current enrollment confirmation directly or via pecos.cms.hhs.gov.
          </div>
        )}
        {rowStatus === 'unchecked' && (
          <div className="py-1.5 text-white/20 text-xs pl-4">
            PECOS lookup has not been performed. Eligibility is unknown.
          </div>
        )}
      </div>
    ),
  };
}

// ── Main wallet component ──────────────────────────────────────────────────────

interface Props {
  passport: PassportData;
}

export default function PassportWallet({ passport }: Props) {
  const [sharing, setSharing] = useState(false);
  const [shared,  setShared]  = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const { identity, readiness } = passport;
  const cfg = STATUS_CONFIG[readiness.status];

  const verifiedItems: string[] = [];
  const missingItems:  string[] = [];

  // MS16-B: verifiedItems uses canonical pecosEnrollmentStatus
  const pecosStatus = passport.standing.pecosEnrollmentStatus ?? (
    passport.standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
    passport.standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
  );

  if (passport.identity.displayName)                          verifiedItems.push('Identity (CMS)');
  if (passport.standing.exclusionClear)                       verifiedItems.push('Not excluded (OIG)');
  if (pecosStatus === 'ENROLLED')                             verifiedItems.push('Medicare enrolled (PECOS)');
  if (passport.standing.licensureStatus === 'verified')       verifiedItems.push('State license (Board)');
  if (passport.standing.deaStatus === 'registered')           verifiedItems.push('DEA registration');
  if (passport.training.hasDegree)                            verifiedItems.push('Medical degree');
  if (passport.training.hasResidency)                         verifiedItems.push('Residency');

  if (passport.standing.exclusionStatus === 'UNCHECKED')                missingItems.push('Exclusion check pending');
  if (passport.standing.exclusionStatus === 'POSSIBLE_MATCH')           missingItems.push('Exclusion review required');
  if (passport.standing.exclusionStatus === 'EXCLUDED')                 missingItems.push('Exclusion confirmed');
  if (passport.standing.licensureStatus !== 'verified')                 missingItems.push('License unresolved');
  if (passport.standing.deaStatus === 'none')                           missingItems.push('No DEA registration');
  // MS16-B: Eligibility missing items — per canonical state
  if (pecosStatus === 'NOT_FOUND')   missingItems.push('Medicare enrollment not found — review required');
  if (pecosStatus === 'UNCHECKED')   missingItems.push('Medicare enrollment not checked');
  [...readiness.blockers, ...passport.authority.summary.missing.map(d =>
    `${d.replace(/_/g, ' ').toLowerCase()} missing`)
  ].forEach(b => { if (!missingItems.includes(b)) missingItems.push(b); });

  // MS16-F: Trust stack order — Identity → Safety → Authority → Eligibility → Readiness
  const accordionItems: AccordionItem[] = [
    buildIdentitySection(passport),
    buildAuthoritySection(passport),
    buildTrainingSection(passport),
    buildStandingSection(passport),
    buildEligibilitySection(passport),
  ];

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      // Biometric confirmation (WebAuthn) — fallback gracefully if unavailable
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const optRes = await fetch('/api/webauthn/authenticate-options');
          if (optRes.ok) {
            const { startAuthentication } = await import('@simplewebauthn/browser');
            const opts = await optRes.json();
            const assertion = await startAuthentication({ optionsJSON: opts });
            await fetch('/api/webauthn/verify-assertion', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assertion),
            });
          }
        } catch { /* biometric unavailable — proceed with log-only share */ }
      }

      // POST /api/share
      const res = await fetch('/api/share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId:              passport.entityId,
          organizationContextId: 'demo', // replaced when org context flow is wired
        }),
      });

      if (!res.ok) throw new Error('Share failed. Try again.');
      setShared(true);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Share failed.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-12 sm:pt-16 pb-24">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Header — minimal ──────────────────────────────────────────────── */}
        <div className="text-center">
          <span className="text-white/30 text-xs tracking-widest uppercase">VitalCV</span>
        </div>

        {/* ── Passport card — primary object ────────────────────────────────── */}
        <div className={`rounded-2xl border ${cfg.cardBorder} ${cfg.cardBg} px-5 py-5`}>
          {/* Identity */}
          <h1 className="text-white text-2xl font-semibold tracking-tight leading-tight">
            {identity.displayName}
          </h1>
          {identity.specialty && (
            <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
          )}

          {/* Status pill removed to match spec, keeping just Name and Specialty locally here */}
        </div>

        {/* ── Readiness section ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="space-y-2">
            {verifiedItems.length > 0 && verifiedItems.slice(0, 6).map((item, i) => (
              <VerifiedRow key={i} label={item} />
            ))}
          </div>

          {missingItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/6">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-amber-400 text-xs w-4 text-center select-none" aria-hidden>⚠</span>
                <span className="text-white/70">Missing / unresolved</span>
              </div>
              <div className="pl-7 space-y-1">
                {missingItems.slice(0, 4).map((item, i) => (
                  <div key={i} className="text-white/40 text-xs">{item}</div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/6 flex items-baseline justify-between">
            <span className="text-white/50 text-sm font-medium">Readiness:</span>
            <span className="text-white text-xl font-semibold tabular-nums tracking-tight">{readiness.score}%</span>
          </div>
        </div>

        {/* ── NPI disclaimer — identity anchor clarification ─────────────── */}
        {passport.npi && (
          <p className="text-white/20 text-xs text-center leading-relaxed border border-white/6 rounded-xl px-4 py-2.5">
            NPI {passport.npi} confirms identity only — does not confirm licensure, enrollment, or credential status.
          </p>
        )}

        {/* ── Next actions (from readiness engine) ──────────────────────────── */}
        {readiness.nextActions && readiness.nextActions.length > 0 && (
          <div className="space-y-2 border-t border-white/6 pt-4">
            <p className="text-white/50 text-sm font-medium mb-3">Next steps:</p>
            {readiness.nextActions.slice(0, 4).map(action => (
              <div key={action.id} className="flex items-start gap-3">
                <span className="text-white/25 mt-1 select-none text-xs">—</span>
                <div>
                  <p className="text-white/70 text-sm">{action.title}</p>
                  <p className="text-white/40 text-xs mt-0.5">{action.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Details accordion ─────────────────────────────────────────────── */}
        <div>
          <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Proof — view source per section</p>
          <Accordion items={accordionItems} />
        </div>

        {/* ── MiroFish fastest path — clinician-facing, clearly advisory ─── */}
        <FastestPathPanel passport={passport} />

        {/* ── Share section ─────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          {!shared ? (
            <>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-white rounded-xl h-14 text-sm font-medium transition-all"
                aria-label="Share passport with employer"
              >
                {sharing ? 'Confirming…' : 'Share with employer'}
              </button>
              {shareError && (
                <p className="text-red-400/70 text-xs text-center">{shareError}</p>
              )}
              <p className="text-center text-white/20 text-xs">
                Requires biometric confirmation
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/4 px-5 py-4 text-center space-y-1">
              <p className="text-white/70 text-sm font-medium">Passport shared</p>
              <p className="text-white/30 text-xs">
                Employer notified. Access expires in 24 hours.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer nav ───────────────────────────────────────────────────── */}
        <div className="text-center pt-2">
          <Link
            href="/passport"
            className="text-white/20 hover:text-white/40 text-xs transition-colors"
          >
            View another NPI
          </Link>
        </div>

      </div>
    </main>
  );
}
