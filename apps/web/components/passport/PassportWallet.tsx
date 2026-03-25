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
import { PassportAdvisoryPanel } from '@/components/advisory/AdvisoryPanel';
import {
  VStatusPill,
  type TrustStatusLabel,
} from '@/components/vds/primitives';
import { formatProofDate } from '@/lib/trust/proof-language';
import {
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
  resolveAuthoritySectionStatus,
  resolveAuthorityTitle,
  resolveAuthorityVdsStatus,
} from '@/lib/trust/passport-truth';
import { SourceCoverageTag } from '@/components/trust/SourceCoverageTag';
import { normalizePassportSourceCoverageChecks } from '@/lib/trust/source-coverage';

// ── Status configuration ──────────────────────────────────────────────────────
// NO colour on status. Hierarchy via opacity only.

const STATUS_CONFIG: Record<ReadinessStatus, {
  cardBorder:   string;
  cardBg:       string;
}> = {
  READY:   { cardBorder: 'border-white/15', cardBg: 'bg-white/6' },
  PARTIAL: { cardBorder: 'border-white/10', cardBg: 'bg-white/4' },
  BLOCKED: { cardBorder: 'border-white/8', cardBg: 'bg-white/3' },
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

// ── Accordion section builders ─────────────────────────────────────────────────

function buildIdentitySection(passport: PassportData): AccordionItem {
  const { identity, lastCheckedAt } = passport;
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

// ── Authority row renderer (MS15) ────────────────────────────────────────────
// Shared display contract: title · status · source · checkedAt · confidence · freshness

interface AuthorityRowProps {
  title:       string;
  status:      TrustStatusLabel;
  sourceLabel: string;
  checkedAt?:  string | null;
  confidence?: string | null;
  freshness?:  string | null;
  note?:       string | null;
}

function AuthorityRow({ title, status, sourceLabel, checkedAt, confidence, freshness, note }: AuthorityRowProps) {
  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs">
        <span className="text-white/65">{title}</span>
        <VStatusPill status={status} size="sm" />
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

function buildAuthoritySection(passport: PassportData): AccordionItem {
  const { authority } = passport;

  const hasLicensure = authority.credentials.some(c => c.domain === 'LICENSURE');
  const hasBoardCert = authority.credentials.some(c => c.domain === 'BOARD_CERTIFICATION');

  return {
    id:      'authority',
    trigger: 'Authority',
    status:  resolveAuthoritySectionStatus(authority.credentials, authority.summary.missing),
    content: (
      <div className="py-1 space-y-0">

        {/* Real credential rows — authority claim code drives display */}
        {authority.credentials.map(c => (
          <AuthorityRow
            key={c.id}
            title={resolveAuthorityTitle(c)}
            status={resolveAuthorityVdsStatus(c)}
            sourceLabel={resolveAuthorityMethodLabel(c)}
            checkedAt={c.observedAt ? formatProofDate(c.observedAt) : null}
            confidence={c.claimConfidenceLabel}
            freshness={c.dataFreshnessLabel}
            note={resolveAuthorityNote(c)}
          />
        ))}

        {/* Honest placeholder: no licensure credentials at all */}
        {!hasLicensure && (
          <AuthorityRow
            title="License verification"
            status="access required"
            sourceLabel="CA State Board / FSMB"
            note="Access required. Only the CA physician licensure launch lane is production-enabled in this release."
          />
        )}

        {/* Board cert placeholder */}
        {!hasBoardCert && (
          <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
            <span className="text-xs text-white/20">Board certification</span>
            <VStatusPill status="not decision-grade" size="sm" />
          </div>
        )}

        {/* Missing blocking domains (exclude always-present ones) */}
        {authority.summary.missing
          .filter(d => !['IDENTITY', 'EXCLUSION_CHECK'].includes(d))
          .map(d => (
            <div key={d} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-xs text-white/20">{d.replace(/_/g, ' ').toLowerCase()}</span>
              <VStatusPill status="blocked" size="sm" />
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
           : 'review_required',
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

  const exclusionLabel =
    standing.exclusionStatus === 'CLEAR' ? 'Clear'
    : standing.exclusionStatus === 'POSSIBLE_MATCH' ? 'Review required'
    : standing.exclusionStatus === 'EXCLUDED' ? 'Blocked'
    : 'Unavailable';
  const licensureLabel =
    standing.licensureStatus === 'verified' ? 'Verified'
    : standing.licensureStatus === 'expired' ? 'Blocked'
    : standing.licensureStatus === 'pending' ? 'Pending'
    : 'Unavailable';
  const deaLabel =
    standing.deaStatus === 'registered' ? 'Verified'
    : standing.deaStatus === 'none' ? 'Not decision-grade'
    : 'Unavailable';

  return {
    id:      'standing',
    trigger: 'Safety',
    status:  allClear                               ? 'clear'
           : standing.exclusionStatus === 'UNCHECKED' ? 'pending'
           : safetyNegative.length > 0             ? 'review_required'
           : 'pending',
    content: (
      <div className="py-1">
        <DetailRow label="Exclusion check"   value={exclusionLabel} />
        <DetailRow label="Checked"           value={formatProofDate(standing.exclusionCheckedAt)} />
        <DetailRow label="Confidence"        value={standing.exclusionConfidenceLabel} />
        <DetailRow label="License"           value={licensureLabel} />
        <DetailRow label="DEA"               value={deaLabel} />
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
  status:       TrustStatusLabel;
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
  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs gap-2">
        <span className="flex items-center gap-1.5 text-white/65">{title}</span>
        <VStatusPill status={status} size="sm" />
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
    s === 'NOT_FOUND' ? 'review required' :
    s === 'UNKNOWN'   ? 'unavailable' :
    'unavailable';

  const sectionStatus: AccordionItem['status'] =
    rowStatus === 'enrolled'  ? 'clear' :
    rowStatus === 'review required' ? 'review_required' :
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
      ? `Medicare enrollment — as of ${quarterLabel}`
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
          freshness={standing.enrollmentFreshnessLabel ?? standing.enrollmentDataFreshness ?? 'Quarterly'}
          confidence={standing.enrollmentConfidenceLabel ?? undefined}
          note={standing.enrollmentNote ?? undefined}
        />
        {rowStatus === 'review required' && (
          <div className="py-1.5 text-white/20 text-xs pl-4 leading-relaxed">
            Not finding a provider in PECOS may indicate non-enrollment or a quarterly data lag.
            Confirm by requesting current enrollment confirmation directly or via pecos.cms.hhs.gov.
          </div>
        )}
        {rowStatus === 'unavailable' && (
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
  if (passport.standing.exclusionStatus === 'EXCLUDED')                 missingItems.push('Exclusion blocked');
  if (passport.standing.licensureStatus !== 'verified')                 missingItems.push('License unresolved');
  if (passport.standing.deaStatus === 'none')                           missingItems.push('No DEA registration');
  // MS16-B: Eligibility missing items — per canonical state
  if (pecosStatus === 'NOT_FOUND')   missingItems.push('Medicare enrollment review required');
  if (pecosStatus === 'UNCHECKED')   missingItems.push('Medicare enrollment unavailable');
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
                <span className="text-[var(--vt-warning)] text-xs w-4 text-center select-none" aria-hidden>⚠</span>
                <span className="text-white/70">Readiness blockers</span>
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

        {/* ── Source coverage — explicit live/stale/gated/mock per source ──── */}
        {(() => {
          const checks = normalizePassportSourceCoverageChecks(passport.sourceCoverage);
          if (checks.length === 0) return null;
          return (
            <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                Sources checked
              </p>
              <div className="flex flex-wrap gap-2">
                {checks.map(c => (
                  <SourceCoverageTag
                    key={c.sourceId}
                    source={c.sourceId}
                    status={c.state}
                    decisionGrade={c.state === 'live'}
                    lastChecked={c.checkedAt ?? undefined}
                  />
                ))}
              </div>
              <p className="text-white/20 text-[10px] leading-4">
                Only <span className="text-white/40 font-semibold">live</span> sources are decision-grade.
                Stale, gated, and mock sources inform context but do not constitute primary-source verification.
              </p>
            </div>
          );
        })()}

        {/* ── Details accordion ─────────────────────────────────────────────── */}
        <div>
          <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Proof — view source per section</p>
          <Accordion items={accordionItems} />
        </div>

        {/* ── Advisory Panel — clinician-facing, clearly advisory ─── */}
        <PassportAdvisoryPanel passport={passport} />

        {/* ── Share section ─────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          {!shared ? (
            <>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="w-full rounded-xl bg-[var(--vt-success)] h-14 text-sm font-medium text-white transition hover:opacity-90 active:opacity-80 disabled:opacity-50"
                aria-label="Share passport with employer"
              >
                {sharing ? 'Confirming…' : 'Share with employer'}
              </button>
              {shareError && (
                <p className="text-[var(--vt-critical)] text-xs text-center">{shareError}</p>
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
