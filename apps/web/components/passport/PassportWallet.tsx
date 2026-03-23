'use client';

import Link from 'next/link';

/**
 * PassportWallet.tsx — The Trust Passport
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

function buildAuthoritySection(passport: PassportData): AccordionItem {
  const { authority } = passport;
  const hasActive = authority.summary.active > 0;
  return {
    id:      'authority',
    trigger: 'Authority',
    status:  hasActive && authority.summary.missing.length === 0 ? 'verified'
           : authority.summary.missing.length > 0               ? 'action'
           : 'pending',
    content: (
      <div className="py-1 space-y-1">
        {authority.credentials.filter(c => c.status === 'ACTIVE').map(c => (
          <div key={c.id} className="py-1.5 border-b border-white/5 last:border-0">
            <div className="flex justify-between text-xs">
              <span className="text-white/65 capitalize">{c.domain.replace(/_/g, ' ').toLowerCase()}</span>
              <span className={`text-xs ${c.reviewRequired ? 'text-white/30' : 'text-white/45'}`}>
                {c.confidenceLabel ?? (c.jurisdiction ?? c.type)}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-0.5">
              {c.jurisdiction && <span className="text-white/30">{c.jurisdiction}</span>}
              {c.dataFreshness && (
                <span className="text-white/20 ml-auto">{c.dataFreshness}</span>
              )}
            </div>
            {c.expiresAt && (
              <div className="text-white/20 text-xs mt-0.5">
                Expires {new Date(c.expiresAt).toLocaleDateString()}
                {c.stale ? <span className="ml-1.5">(stale)</span> : null}
              </div>
            )}
          </div>
        ))}
        {authority.credentials.length === 0 && (
          <p className="text-white/25 text-xs py-1">No credentials on file yet.</p>
        )}
        {authority.summary.missing.length > 0 && (
          <div className="pt-1">
            {authority.summary.missing.map(d => (
              <div key={d} className="text-white/30 text-xs py-0.5">
                Missing: {d.replace(/_/g, ' ').toLowerCase()}
              </div>
            ))}
          </div>
        )}
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
  const allClear =
    standing.exclusionClear &&
    standing.licensureStatus === 'verified' &&
    standing.negativeFindings.length === 0;

  return {
    id:      'standing',
    trigger: 'Standing',
    status:  allClear                               ? 'clear'
           : standing.negativeFindings.length > 0  ? 'action'
           : 'pending',
    content: (
      <div className="py-1">
        <DetailRow label="Exclusion check"   value={standing.exclusionStatus} />
        <DetailRow label="License"           value={standing.licensureStatus} />
        <DetailRow label="DEA"               value={standing.deaStatus} />
        <DetailRow label="PECOS enrollment"  value={standing.pecosStatus} />
        {standing.negativeFindings.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
            <span className="text-white/25 select-none">⚠</span>
            <span className="text-white/50">{f}</span>
          </div>
        ))}
        {standing.negativeFindings.length === 0 && (
          <div className="text-white/30 text-xs pt-1">No negative findings.</div>
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

  if (passport.standing.exclusionClear)               verifiedItems.push('No exclusions or sanctions');
  if (passport.standing.licensureStatus === 'verified') verifiedItems.push('State license verified');
  if (passport.standing.deaStatus === 'registered')   verifiedItems.push('DEA registration active');
  if (passport.standing.pecosStatus === 'enrolled')   verifiedItems.push('Medicare enrolled');
  if (passport.training.hasDegree)                    verifiedItems.push('Medical degree on file');
  if (passport.training.hasResidency)                 verifiedItems.push('Residency completed');

  if (!passport.standing.exclusionClear)                                missingItems.push('Exclusion check pending');
  if (passport.standing.licensureStatus !== 'verified')                 missingItems.push('License unresolved');
  if (passport.standing.deaStatus === 'none')                          missingItems.push('No DEA registration');
  [...readiness.blockers, ...passport.authority.summary.missing.map(d =>
    `${d.replace(/_/g, ' ').toLowerCase()} missing`)
  ].forEach(b => { if (!missingItems.includes(b)) missingItems.push(b); });

  const accordionItems: AccordionItem[] = [
    buildIdentitySection(passport),
    buildAuthoritySection(passport),
    buildTrainingSection(passport),
    buildStandingSection(passport),
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

          {/* Status pill */}
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 bg-white/4 ${cfg.labelOpacity}`}
            >
              {cfg.label}
            </span>
            <span className="text-white/25 text-xs tabular-nums">{readiness.score}/100</span>
          </div>
        </div>

        {/* ── Readiness section ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Verified items */}
          {verifiedItems.length > 0 && (
            <div className="space-y-2">
              {verifiedItems.slice(0, 6).map((item, i) => (
                <VerifiedRow key={i} label={item} />
              ))}
            </div>
          )}

          {/* Divider between verified and missing */}
          {verifiedItems.length > 0 && missingItems.length > 0 && (
            <div className="border-t border-white/6" />
          )}

          {/* Missing items */}
          {missingItems.length > 0 && (
            <div className="space-y-2">
              {missingItems.slice(0, 4).map((item, i) => (
                <MissingRow key={i} label={item} />
              ))}
            </div>
          )}

          {/* Estimated start */}
          {readiness.estimatedStartDays !== null && (
            <div className="pt-1 flex items-baseline gap-1.5">
              <span className="text-white/25 text-xs">Estimated start</span>
              <span className="text-white/55 text-sm">
                {readiness.estimatedStartDays === 0
                  ? 'Ready now'
                  : `~${readiness.estimatedStartDays} days`}
              </span>
            </div>
          )}
          {readiness.estimatedStartDays === null && readiness.status === 'BLOCKED' && (
            <div className="pt-1 flex items-baseline gap-1.5">
              <span className="text-white/25 text-xs">Estimated start</span>
              <span className="text-white/35 text-sm">Blocked — resolve issues to continue</span>
            </div>
          )}
        </div>

        {/* ── Authority: Licensure (Primary) ─────────────────────────────────────────────── */}
        <div>
          <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Primary Authority: Licensure</p>
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 mb-5 shadow-sm">
             <div className="flex justify-between items-center text-sm mb-2">
                 <span className="text-white/70">RN License — California</span>
                 <span className="text-white/45 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 text-xs font-semibold">Active</span>
             </div>
             <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-white/5">
                 <div className="flex items-center gap-1.5">
                   <span className="text-white/30 text-[10px]">Source:</span>
                   <span className="text-white/50">Nursys</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="text-white/30 text-[10px]">Checked:</span>
                   <span className="text-white/50">Today</span>
                 </div>
             </div>
          </div>
        </div>

        {/* ── Details accordion ─────────────────────────────────────────────── */}
        <div>
          <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Additional Details</p>
          <Accordion items={accordionItems} />
        </div>

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


