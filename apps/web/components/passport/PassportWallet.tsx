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
import { SectionReveal } from '@/components/motion/ScrollMotion';
import { Accordion } from '@/components/ui/accordion';
import type { AccordionItem } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { PassportData, ReadinessStatus } from '@/lib/trust/passport-contract';
import { PassportAdvisoryPanel } from '@/components/advisory/AdvisoryPanel';
import { PassportTrustPosture } from '@/components/passport/PassportTrustPosture';
import { EvidenceDisclosureCard } from '@/components/trust/EvidenceDisclosureCard';
import { PassportSourceCoveragePanel } from '@/components/trust/PassportSourceCoveragePanel';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { formatProofDate } from '@/lib/trust/proof-language';
import {
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
  resolveAuthoritySectionStatus,
  resolveAuthorityTitle,
  resolveAuthorityVdsStatus,
} from '@/lib/trust/passport-truth';
import {
  normalizePassportSourceCoverageChecks,
  type PassportSourceCoverageCheck,
} from '@/lib/trust/source-coverage';
import type { VdsTrustStatus } from '@/lib/trust/status-language';

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

const SOURCE_COVERAGE_ORDER: Record<string, number> = {
  checked: 0,
  stale: 1,
  reviewRequired: 2,
  accessRequired: 3,
  gated: 3,
  notDecisionGrade: 4,
  pending: 4,
  unavailable: 4,
  previewOnly: 4,
};

function sortPassportSourceCoverageChecks(
  checks: PassportSourceCoverageCheck[],
): PassportSourceCoverageCheck[] {
  return [...checks].sort((left, right) => (
    (SOURCE_COVERAGE_ORDER[left.state] ?? 5) - (SOURCE_COVERAGE_ORDER[right.state] ?? 5)
    || left.sourceId.localeCompare(right.sourceId)
  ));
}

function PassportFreshnessCard({
  freshness,
}: {
  freshness: PassportData['trustPosture']['freshness'];
}) {
  const summaryBadge =
    freshness.state === 'current'
      ? { status: 'verified' as const, label: 'Current' }
      : freshness.state === 'stale'
        ? { status: 'stale' as const, label: 'Stale' }
        : { status: 'pending' as const, label: 'Partial' };

  return (
    <Card className="gap-3 rounded-2xl border-white/8 bg-white/3 px-5 py-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-widest">Freshness</p>
          <p className="mt-1 text-sm text-white/65">{freshness.label}</p>
        </div>
        <TrustStatusBadge status={summaryBadge.status} label={summaryBadge.label} size="sm" />
      </div>
      <div className="space-y-2 border-t border-white/6 pt-3">
        {freshness.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white/70">{item.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/42">{item.note}</p>
              </div>
              <TrustStatusBadge
                status={item.state === 'current' ? 'verified' : item.state === 'stale' ? 'stale' : 'pending'}
                label={item.state}
                size="sm"
                className="shrink-0"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-white/24">
              <span>{item.source}</span>
              <span>{item.checkedAt ? `Checked ${formatProofDate(item.checkedAt)}` : 'Not yet checked'}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Row primitives ─────────────────────────────────────────────────────────────

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
    // NPPES ACTIVE = NPI is valid and active — not a credential verification.
    // 'checked' is the honest status: we confirmed the NPI exists, nothing more.
    status:  identity.status === 'ACTIVE' ? 'checked' : 'pending',
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
  status:      VdsTrustStatus;
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
        <TrustStatusBadge status={status} size="sm" />
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

        {/* Gap: no licensure credentials attached — show access-required state */}
        {!hasLicensure && (
          <AuthorityRow
            title="License verification"
            status="access required"
            sourceLabel="CA State Board / FSMB"
            note="Access required. Only the CA physician licensure launch lane is production-enabled in this release."
          />
        )}

        {/* Gap: no board certification attached — show not-decision-grade state */}
        {!hasBoardCert && (
          <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
            <span className="text-xs text-white/20">Board certification</span>
            <TrustStatusBadge status="not decision-grade" size="sm" />
          </div>
        )}

        {/* Missing blocking domains (exclude always-present ones) */}
        {authority.summary.missing
          .filter(d => !['IDENTITY', 'EXCLUSION_CHECK'].includes(d))
          .map(d => (
            <div key={d} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-xs text-white/20">{d.replace(/_/g, ' ').toLowerCase()}</span>
              <TrustStatusBadge status="blocked" size="sm" />
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
  status:       VdsTrustStatus;
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
        <TrustStatusBadge status={status} size="sm" />
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

  const { identity, readiness, trustPosture } = passport;
  const cfg = STATUS_CONFIG[readiness.status];
  const sourceCoverageChecks = sortPassportSourceCoverageChecks(
    normalizePassportSourceCoverageChecks(passport.sourceCoverage),
  );

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
          organizationContextId: 'direct-share', // org context wired when employer workspace is connected
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
        <Card className={`gap-0 rounded-2xl border ${cfg.cardBorder} ${cfg.cardBg} px-5 py-5 shadow-none`}>
          {/* Identity */}
          <h1 className="text-white text-2xl font-semibold tracking-tight leading-tight">
            {identity.displayName}
          </h1>
          {identity.specialty && (
            <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
          )}

          {/* Status pill removed to match spec, keeping just Name and Specialty locally here */}
        </Card>

        {/* ── Trust Posture ─────────────────────────────────────────────────── */}
        <SectionReveal delay={0}>
          <PassportTrustPosture posture={trustPosture} />
        </SectionReveal>

        {/* ── NPI disclaimer — identity anchor clarification ─────────────── */}
        {passport.npi && (
          <SectionReveal delay={0.05}>
            <p className="text-white/20 text-xs text-center leading-relaxed border border-white/6 rounded-xl px-4 py-2.5">
              NPI {passport.npi} confirms identity only — does not confirm licensure, enrollment, or credential status.
            </p>
          </SectionReveal>
        )}

        {/* ── Freshness ─────────────────────────────────────────────────────── */}
        <SectionReveal delay={0.1}>
          <PassportFreshnessCard freshness={trustPosture.freshness} />
        </SectionReveal>

        {/* ── Source coverage — explicit checked/stale/gated/preview-only per source ──── */}
        <SectionReveal delay={0.15}>
          <PassportSourceCoveragePanel checks={sourceCoverageChecks} />
        </SectionReveal>

        {/* ── Details accordion ─────────────────────────────────────────────── */}
        <SectionReveal delay={0.2}>
          <EvidenceDisclosureCard
            eyebrow="Proof"
            title="View source-backed evidence by section"
            description="Each disclosure keeps trust-core proof, contextual notes, and gaps explicit."
            className="rounded-2xl border-white/8 bg-white/[0.03]"
            contentClassName="px-5 py-1"
          >
            <Accordion items={accordionItems} />
          </EvidenceDisclosureCard>
        </SectionReveal>

        {/* ── Next actions (from readiness engine) ──────────────────────────── */}
        {readiness.nextActions.length > 0 && (
          <SectionReveal delay={0.25}>
            <Card className="gap-3 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-4 shadow-none">
              <p className="text-white/50 text-sm font-medium">What should happen next</p>
              {readiness.nextActions.slice(0, 4).map((action) => (
                <div key={action.id} className="flex items-start gap-3">
                  <span className="text-white/25 mt-1 select-none text-xs">—</span>
                  <div>
                    <p className="text-white/70 text-sm">{action.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">{action.detail}</p>
                  </div>
                </div>
              ))}
            </Card>
          </SectionReveal>
        )}

        {/* ── Advisory Panel — clinician-facing, clearly advisory ─── */}
        <PassportAdvisoryPanel passport={passport} />

        {/* ── Share section ─────────────────────────────────────────────────── */}
        <SectionReveal delay={0.3}>
          <div className="space-y-3 pt-2">
            {!shared ? (
              <>
                <Button
                  onClick={handleShare}
                  disabled={sharing}
                  variant="success"
                  className="h-14 w-full rounded-xl text-sm font-medium"
                  aria-label="Share passport with employer"
                >
                  {sharing ? 'Confirming…' : 'Share with employer'}
                </Button>
                {shareError && (
                  <p className="text-[var(--vt-critical)] text-xs text-center">{shareError}</p>
                )}
                <p className="text-center text-white/20 text-xs leading-relaxed">
                  Sharing records the current passport proof surface shown above. Biometric confirmation is used when available.
                </p>
              </>
            ) : (
              <TrustStateCard
                title="Share recorded"
                description="A share event was persisted for this passport. Employer access depends on your organization context."
                tone="success"
                centered
              />
            )}
          </div>
        </SectionReveal>

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
