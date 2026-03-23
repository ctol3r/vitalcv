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
import { TrustLabel, type TrustStatus } from '@/components/ui/trust-label';
import type { PassportData } from '@/app/passport/[id]/page';
import MirofishPanel from '@/components/review/MirofishPanel';

function formatProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

function formatQuarter(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const q = Math.floor(parsed.getMonth() / 3) + 1;
  return `Q${q} ${parsed.getFullYear()}`;
}

function joinNoteParts(parts: Array<string | null | undefined>): string | undefined {
  const values = parts.filter((part): part is string => Boolean(part && part.trim()));
  return values.length > 0 ? values.join(' · ') : undefined;
}

function formatAsOfDate(value?: string | null): string | null {
  const date = formatProofDate(value);
  return date ? `as of ${date}` : null;
}

function formatAsOfQuarter(
  observedAt?: string | null,
  dataVersion?: string | null,
): string | null {
  const quarter = dataVersion ?? formatQuarter(observedAt);
  return quarter ? `as of ${quarter}` : null;
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

function buildSafetyRow(standing: PassportData['standing']): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  // MS16-E: note contract — checkedAt · dataFreshness · confidenceLabel (· action-flag)
  const checkedNote = formatAsOfDate(standing.exclusionCheckedAt);
  const confidence  = standing.exclusionConfidenceLabel ?? null;

  switch (standing.exclusionStatus) {
    case 'CLEAR':
      return {
        status: 'confirmed',
        label: 'Not excluded',
        note: joinNoteParts([checkedNote, confidence]),
        explanation: 'No exclusion entry was found in the current OIG LEIE check.',
      };
    case 'POSSIBLE_MATCH':
      return {
        status: 'review',
        label: 'Possible exclusion match — review required',
        note: joinNoteParts([checkedNote, confidence, 'requires verification']),
        explanation: 'A potential OIG match needs manual adjudication before the employer can rely on this safety layer.',
      };
    case 'EXCLUDED':
      return {
        status: 'blocked',
        label: 'Excluded — do not proceed',
        note: joinNoteParts([checkedNote, confidence, 'requires verification']),
        explanation: 'An exclusion record is attached to this provider. Employment should not proceed until it is resolved.',
      };
    case 'UNKNOWN':
      return {
        status: 'review',
        label: 'Safety status unavailable — review required',
        note: joinNoteParts([confidence, 'requires verification']),
        explanation: 'The exclusion result could not be resolved from the current OIG check.',
      };
    case 'UNCHECKED':
    default:
      return {
        status: 'unchecked',
        label: 'Not yet checked',
        note: 'requires verification',
        explanation: 'No current OIG exclusion check is attached to this review.',
      };
  }
}

function buildAuthorityRow(credential: PassportData['authority']['credentials'][0]): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation?: string;
} {
  const code = credential.authorityClaimCode;
  const isUnavailable =
    code === 'AUTHORITY_UNAVAILABLE'
    || credential.connectorState === 'unavailable'
    || credential.connectorState === 'unresolved';
  const isBoardOrder = code === 'BOARD_ORDER_PRESENT';
  const isDisciplined =
    code === 'RN_LICENSE_DISCIPLINED'
    || (credential.reviewRequired && credential.domain === 'LICENSURE');
  const isExpired = code === 'RN_LICENSE_EXPIRED' || credential.status === 'EXPIRED';
  const isActive =
    (code === 'PHYSICIAN_LICENSE_ACTIVE' || code === 'RN_LICENSE_ACTIVE')
    && !isDisciplined
    && !isBoardOrder;

  const label =
    isBoardOrder ? `Board order${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    isDisciplined ? `License disciplinary action${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    isExpired ? `License expired${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    isUnavailable ? (
      credential.participationStatus === 'non_participating_state'
        ? `License source unavailable${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`
        : 'License source not configured'
    ) :
    isActive ? `License active${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    `License${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`;

  const status: TrustStatus =
    isBoardOrder || isDisciplined ? 'review' :
    isExpired ? 'blocked' :
    isUnavailable ? 'unchecked' :
    isActive ? 'confirmed' :
    'unchecked';

  // MS16-E: note carries dataFreshness + confidenceLabel (row contract)
  const note = joinNoteParts([
    formatAsOfDate(credential.observedAt ?? credential.verifiedAt),
    credential.dataFreshnessLabel ?? null,
    credential.claimConfidenceLabel ?? null,
    isBoardOrder || isDisciplined || isExpired || isUnavailable ? 'requires verification' : null,
  ]);

  return {
    status,
    label,
    note,
    explanation: claimCodeToNote(credential) ?? undefined,
  };
}

function buildEligibilityRow(standing: PassportData['standing'], status: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED'): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  const quarterNote  = formatAsOfQuarter(standing.enrollmentObservedAt, standing.enrollmentDataVersion);
  // MS16-E: note contract — dataFreshness · confidenceLabel · checkedAt (· action-flag)
  const freshness    = standing.enrollmentDataFreshness ?? standing.enrollmentFreshnessLabel ?? null;
  const confidence   = standing.enrollmentConfidenceLabel ?? null;

  switch (status) {
    case 'ENROLLED':
      return {
        status: 'confirmed',
        label: quarterNote ? `Medicare enrolled — as of ${quarterNote}` : 'Medicare enrolled',
        // MS16-A explicit label: "Medicare enrolled — as of Q4 2025"
        note: joinNoteParts([freshness, confidence, quarterNote]),
        explanation: standing.enrollmentNote ?? 'CMS PECOS confirms an enrolled provider record in the current quarterly release.',
      };
    case 'NOT_FOUND':
      return {
        status: 'review',
        label: 'Not found in CMS enrollment data — review required',
        // MS16-A explicit label: "Not found in CMS enrollment data — may indicate not enrolled or data lag"
        note: joinNoteParts([freshness, confidence, quarterNote, 'estimated quarterly publication lag possible', 'requires verification']),
        explanation:
          standing.enrollmentNote
          ?? 'Not finding a record may indicate non-enrollment or a quarterly CMS publication lag. Verify at pecos.cms.hhs.gov before relying on this layer.',
      };
    case 'UNKNOWN':
      return {
        status: 'review',
        label: 'Enrollment status unconfirmed — review required',
        note: joinNoteParts([freshness, confidence, quarterNote, 'requires verification']),
        explanation:
          standing.enrollmentNote
          ?? 'The CMS PECOS result could not be resolved from the current quarterly release. Manual verification required.',
      };
    case 'UNCHECKED':
    default:
      return {
        status: 'unchecked',
        label: 'Enrollment not checked',
        note: joinNoteParts([freshness ?? 'Quarterly', 'Source: CMS PECOS', 'requires verification']),
        explanation: 'No CMS PECOS lookup has been performed yet. Enrollment eligibility is unknown.',
      };
  }
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
  const pecosEnrollmentStatus: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' =
    standing.pecosEnrollmentStatus ?? (
      standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
      standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
    );

  const missingDomains    = authority.summary.missing;
  const blocked = Array.from(new Set([
    ...readiness.blockers,
    ...missingDomains.map((domain) => domain.replace(/_/g, ' ').toLowerCase()),
  ]));
  const proofItems = buildProofSections(passport);
  const safetyRow = buildSafetyRow(standing);
  const eligibilityRow = buildEligibilityRow(standing, pecosEnrollmentStatus);

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

        {/* ── Decision card — Exact Layout ──────────────────────────────── */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-6 mb-6">
          {/* Identity */}
          <div>
            <h1 className="text-white text-xl font-semibold leading-tight">
              {identity.displayName}
            </h1>
            {identity.specialty && (
              <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
            )}
          </div>

          {/* MS16-F: Employer 6-question flow — strict order */}
          <div className="pt-2 mt-4 space-y-6">
            {/* Q1: Who is this? */}
            <div className="space-y-2">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Identity</h2>
              <TrustLabel
                status={identity.npi ? 'confirmed' : 'unchecked'}
                label={identity.npi ? 'Identity confirmed' : 'Identity missing'}
                source={identity.npi ? 'CMS NPPES' : undefined}
                note={identity.npi ? formatAsOfDate(passport.lastCheckedAt) ?? undefined : 'requires verification'}
                explanation={
                  identity.npi
                    ? 'Identity confirmed against the national provider registry.'
                    : 'Identity must resolve to CMS NPPES before the rest of the trust stack can be relied on.'
                }
              />
            </div>

            <div className="border-t border-white/10 pt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold">Trust stack</h2>
                <span className="text-white/18 text-[11px] uppercase tracking-[0.18em]">Safety · Authority · Eligibility</span>
              </div>

              {/* Q2: Safe? */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Safety</h3>
                <TrustLabel
                  status={safetyRow.status}
                  label={safetyRow.label}
                  source="OIG LEIE"
                  timestamp={standing.exclusionCheckedAt ? `checked ${formatProofDate(standing.exclusionCheckedAt)}` : undefined}
                  note={safetyRow.note}
                  explanation={safetyRow.explanation}
                />
              </div>

              {/* Q3: Licensed? */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Authority</h3>
                {(() => {
                  const licCreds = authority.credentials.filter((credential) => credential.domain === 'LICENSURE');
                  const certCreds = authority.credentials.filter((credential) => credential.domain === 'BOARD_CERTIFICATION');
                  const hasAny = licCreds.length > 0 || certCreds.length > 0;

                  return (
                    <div className="space-y-2">
                      {licCreds.map((credential) => {
                        const row = buildAuthorityRow(credential);
                        return (
                          <TrustLabel
                            key={credential.id}
                            status={row.status}
                            label={row.label}
                            source={credential.issuerName ?? credential.sourceId ?? 'Authority source'}
                            timestamp={credential.observedAt || credential.verifiedAt ? `checked ${formatProofDate(credential.observedAt ?? credential.verifiedAt)}` : undefined}
                            note={row.note}
                            explanation={row.explanation}
                          />
                        );
                      })}

                      {certCreds.map((credential) => (
                        <TrustLabel
                          key={credential.id}
                          status="confirmed"
                          label={`Board certified${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`}
                          source={credential.issuerName ?? credential.sourceId ?? 'ABMS'}
                          timestamp={credential.observedAt || credential.verifiedAt ? `checked ${formatProofDate(credential.observedAt ?? credential.verifiedAt)}` : undefined}
                          note={formatAsOfDate(credential.observedAt ?? credential.verifiedAt) ?? undefined}
                          explanation="Board certification is on file from the issuing authority."
                        />
                      ))}

                      {!hasAny && (
                        <TrustLabel
                          status="unchecked"
                          label="Authority not yet verified"
                          source="FSMB / Nursys"
                          note="requires verification"
                          explanation="No source-backed authority record is attached yet. Institutional access or manual verification is still required."
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Q4: Eligible? — MS16-B: 4-state canonical rendering */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Eligibility</h3>
                <TrustLabel
                  status={eligibilityRow.status}
                  label={eligibilityRow.label}
                  source={standing.enrollmentSourceLabel ?? 'CMS PECOS'}
                  timestamp={standing.enrollmentObservedAt ? `checked ${formatProofDate(standing.enrollmentObservedAt)}` : undefined}
                  note={eligibilityRow.note}
                  explanation={eligibilityRow.explanation}
                />
              </div>
            </div>

            {/* Q5: What blocks start? + Q6: What do I do? */}
            <div className="border-t border-white/10 pt-4 space-y-1 text-sm">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Readiness</h2>
              <p className="text-white/90 font-medium pb-1">{readiness.score}% ready</p>

              {/* Q5: Blockers */}
              {blocked.length > 0 && (
                <div className="space-y-1 pb-1">
                  {blocked.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-white/20 text-xs w-3 shrink-0 mt-0.5" aria-hidden>·</span>
                      <span className="text-white/50 text-xs">{b.charAt(0).toUpperCase() + b.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-white/50 pt-1">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? 'Ready now' : `~${readiness.estimatedStartDays} days`}
              </p>

              {/* Q6: What do I do? — sourced from readiness.nextActions[] */}
              {readiness.nextActions.length > 0 && (
                <div className="pt-3 mt-1 border-t border-white/8 space-y-2">
                  <p className="text-white/25 text-[10px] uppercase tracking-widest">Next actions</p>
                  {readiness.nextActions.slice(0, 4).map(action => (
                    <div key={action.id} className="flex items-start gap-2">
                      <span className="text-white/15 text-xs w-3 shrink-0 mt-0.5">·</span>
                      <div>
                        <p className="text-white/55 text-xs font-medium">{action.title}</p>
                        <p className="text-white/30 text-xs mt-0.5 leading-relaxed">{action.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── MiroFish advisory — gated, clearly labeled, below readiness ── */}
        <MirofishPanel passport={passport} />

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
                Full profile
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
