'use client';

/**
 * VerifierOnboardingGuide
 *
 * Hospital credentialing reviewer onboarding — 30-second reading guide.
 * 4 sections: reading guide, tier legend, replay explanation, degraded state table.
 *
 * collapsible=true (default): accordion, collapsed on load
 * compact=true: single-line summary + expand trigger
 */

import { useState } from 'react';

export interface VerifierOnboardingGuideProps {
  /** Collapsible accordion mode. Default: true */
  collapsible?: boolean;
  /** Compact single-line summary with expand. Default: false */
  compact?: boolean;
}

// ─── Tier inline badge ────────────────────────────────────────────────────────

function TierInline({
  tier,
  className,
}: {
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  className: string;
}) {
  const labels: Record<string, string> = {
    T1: 'T1 · Self-Asserted',
    T2: 'T2 · Inferred',
    T3: 'T3 · Source Checked',
    T4: 'T4 · Issuer Signed',
  };
  return (
    <span
      className={[
        'inline-flex items-center rounded border px-1.5 py-0.5',
        'text-[9px] font-bold uppercase tracking-widest shrink-0',
        className,
      ].join(' ')}
    >
      {labels[tier]}
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
      {children}
    </h3>
  );
}

// ─── Degraded state row ───────────────────────────────────────────────────────

function DegradedRow({
  icon,
  label,
  iconClass,
  description,
}: {
  icon: string;
  label: string;
  iconClass: string;
  description: string;
}) {
  return (
    <div className="flex gap-2 items-start">
      <span className={['text-xs font-bold w-4 shrink-0 mt-0.5', iconClass].join(' ')}>
        {icon}
      </span>
      <div className="min-w-0">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-500"> — {description}</span>
      </div>
    </div>
  );
}

// ─── Section content ──────────────────────────────────────────────────────────

function Section30s() {
  return (
    <div>
      <SectionHeader>⏱ How to read this in 30 seconds</SectionHeader>
      <ol className="space-y-1.5 list-none">
        {[
          [
            '1.',
            'Check the ',
            'LINEAGE HEADER',
            ' — it tells you WHAT was checked, WHEN, and by WHO.',
          ],
          [
            '2.',
            'Look for the ',
            'DEGRADATION BAR',
            ' — green means clean. Amber/dashed means a system gap (not the clinician\'s fault).',
          ],
          [
            '3.',
            'Read the ',
            'TIER BADGE',
            ' — T3 or T4 means the claim was verified against an authoritative source.',
          ],
          [
            '4.',
            'Check ',
            'REPLAY CONTINUITY',
            ' — a chain link (↳) means this is not the first check.',
          ],
          [
            '5.',
            'Check ',
            'SIGNER',
            ' — the signing key ID links to the public JWKS. You can verify offline.',
          ],
        ].map(([num, pre, bold, post], i) => (
          <li key={i} className="flex gap-2 text-xs text-gray-700">
            <span className="font-bold text-blue-600 w-4 shrink-0">{num}</span>
            <span>
              {pre}
              <strong>{bold}</strong>
              {post}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SectionTiers() {
  return (
    <div>
      <SectionHeader>🏷 Trust Tiers</SectionHeader>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <TierInline tier="T1" className="bg-gray-50 text-gray-500 border-gray-200" />
          <span className="text-xs text-gray-600">Clinician-provided. Not verified. Use for context only.</span>
        </div>
        <div className="flex items-start gap-2">
          <TierInline tier="T2" className="bg-amber-50 text-amber-700 border-amber-200" />
          <span className="text-xs text-gray-600">Derived from verified data. Not directly checked.</span>
        </div>
        <div className="flex items-start gap-2">
          <TierInline tier="T3" className="bg-blue-50 text-blue-700 border-blue-200" />
          <span className="text-xs text-gray-600">Verified against an authoritative public source (NPPES, OIG, State Board).</span>
        </div>
        <div className="flex items-start gap-2">
          <TierInline tier="T4" className="bg-green-50 text-green-700 border-green-200" />
          <span className="text-xs text-gray-600">
            Cryptographically signed by{' '}
            <code className="font-mono text-[10px] bg-green-50 px-0.5">did:web:vitalcv.com</code>.
            Independently verifiable.
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionReplay() {
  return (
    <div>
      <SectionHeader>↳ What is replay continuity?</SectionHeader>
      <div className="space-y-1.5 text-xs text-gray-700">
        <p>Replay continuity means this verification has a history.</p>
        <p>
          Each check produces a <strong>run ID</strong>. If this run links to a prior run (↳),
          the credential has been verified before.
        </p>
        <p>
          Two linked runs mean: the credential was checked at T1, then rechecked at T2.
          Both checks are preserved.
        </p>
        <p>
          A <strong>"genesis" run</strong> means this is the first check. That is normal.
        </p>
        <p>
          Replay is evidence — it shows the credential's verification history, not just its
          current state.
        </p>
      </div>
    </div>
  );
}

function SectionDegraded() {
  return (
    <div>
      <SectionHeader>⚠ What do degraded states mean?</SectionHeader>
      <div className="space-y-2">
        <DegradedRow
          icon="✓"
          iconClass="text-green-600"
          label="No Adverse Findings"
          description="The source was checked. Nothing adverse was found. This is the expected state."
        />
        <DegradedRow
          icon="⚠"
          iconClass="text-amber-500"
          label="Source Unreachable"
          description="The external source (NPPES, OIG) was temporarily unreachable. Not the clinician's fault."
        />
        <DegradedRow
          icon="⚠"
          iconClass="text-amber-600"
          label="Infrastructure Outage"
          description="VitalCV infrastructure was degraded. VitalCV owns this. Not the clinician's fault."
        />
        <DegradedRow
          icon="○"
          iconClass="text-gray-400"
          label="Anonymous"
          description="No authenticated actor is bound. This is an exploratory view only."
        />
        <DegradedRow
          icon="✕"
          iconClass="text-red-500"
          label="Issuer Unavailable"
          description="The issuing authority was unresponsive. Different from infrastructure outage — the issuer, not VitalCV, is unavailable."
        />
      </div>
    </div>
  );
}

// ─── Sections config ──────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'guide', component: Section30s },
  { id: 'tiers', component: SectionTiers },
  { id: 'replay', component: SectionReplay },
  { id: 'degraded', component: SectionDegraded },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function VerifierOnboardingGuide({
  collapsible = true,
  compact = false,
}: VerifierOnboardingGuideProps) {
  const [expanded, setExpanded] = useState(!collapsible);

  if (compact && collapsible) {
    return (
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-blue-700 font-medium">
          New to VitalCV? Read the 30-second verifier guide.
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 ml-4 shrink-0"
        >
          {expanded ? 'Close' : 'Open guide'}
        </button>
        {expanded && (
          <div className="absolute z-10 mt-2 top-full left-0 right-0">
            {/* compact expand falls through to full render below */}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50">
      {/* Header */}
      <button
        onClick={() => collapsible && setExpanded((v) => !v)}
        className={[
          'w-full flex items-center justify-between px-4 py-3',
          collapsible ? 'cursor-pointer hover:bg-blue-100/50 transition-colors' : 'cursor-default',
          'rounded-lg',
        ].join(' ')}
        aria-expanded={expanded}
        disabled={!collapsible}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-800">
            Verifier Guide — Hospital Credentialing Quick Reference
          </span>
          <span className="hidden sm:inline text-[10px] font-medium text-blue-500 border border-blue-200 rounded px-1.5 py-0.5">
            30 SEC READ
          </span>
        </div>
        {collapsible && (
          <span className="text-blue-500 text-sm select-none" aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-blue-100 pt-4">
          {SECTIONS.map(({ id, component: Component }) => (
            <div key={id} className="min-w-0">
              <Component />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VerifierOnboardingGuide;
