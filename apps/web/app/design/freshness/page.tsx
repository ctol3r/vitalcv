/**
 * /design/freshness — Regulator-anchored freshness system (design reference, W3)
 *
 * Evidence freshness measured against the real NCQA 2025 / CMS windows, with
 * cadence rows (last checked · next due), a 90/60/30-day expiry horizon, and
 * consequence-naming stale states. Composes with the W1 ProvenanceChip.
 *
 * Design Handoff References:
 *   docs/design/ui-ux-inspiration-repository-2026-07-17.md  (R3 R4 R5, E7)
 *   docs/design/evidence-surface-fieldguide.html            (freshness spec)
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  FreshnessMeter,
  ExpiryHorizon,
  ProvenanceChip,
} from '@/design-system/components';
import { REGULATORY_WINDOWS } from '@/lib/freshness/regulatoryWindows';

export const metadata: Metadata = {
  title: 'Regulator-anchored freshness — design reference',
  description:
    'Evidence freshness measured against real NCQA and CMS refresh windows: cadence rows, a 90/60/30-day expiry horizon, and consequence-naming stale states.',
  robots: { index: false, follow: false },
};

// Fixed clock so the reference renders deterministically.
const NOW = '2026-07-18T00:00:00Z';

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid var(--vt-border)', paddingTop: 28, marginTop: 40 }}>
      <div
        style={{
          fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'var(--vt-text-muted, var(--vt-text-secondary))',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function FreshnessDesignReferencePage() {
  return (
    <main
      style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '56px 24px 96px',
        color: 'var(--vt-text-primary)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: 'var(--vt-accent, var(--vt-text-secondary))',
          margin: '0 0 16px',
        }}
      >
        Design system · W3
      </p>
      <h1 style={{ margin: '0 0 14px', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        Freshness has a regulator
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '60ch', margin: 0 }}>
        Trust has a half-life, and the deadline is not abstract — it is the{' '}
        <strong style={{ color: 'var(--vt-text-primary)' }}>NCQA 2025 window</strong> the whole industry just
        adopted. Every lane is measured against its real refresh SLA, and a stale state names exactly what it
        blocks.
      </p>

      <Section eyebrow="R3 · R4" title="Regulator-anchored cadence">
        <div style={{ display: 'grid', gap: 12 }}>
          <FreshnessMeter
            source="OIG LEIE exclusions"
            checkedAt="2026-07-16T00:00:00Z"
            window={REGULATORY_WINDOWS.sanctionScreening}
            now={NOW}
          />
          <FreshnessMeter
            source="Primary-source verification"
            checkedAt="2026-04-25T00:00:00Z"
            window={REGULATORY_WINDOWS.primarySourceVerification}
            now={NOW}
          />
          <FreshnessMeter
            source="State license monitoring"
            checkedAt="2026-06-10T00:00:00Z"
            window={REGULATORY_WINDOWS.licenseMonitoring}
            now={NOW}
          />
          {/* Was "NPDB continuous query" — a meter for a source VitalCV has no
              adapter for, which reads as a monitored lane that simply has not
              run yet. Named for the window it is paired with instead; the
              never-checked state it demonstrates is unchanged. */}
          <FreshnessMeter
            source="Primary source verification"
            checkedAt={null}
            window={REGULATORY_WINDOWS.primarySourceVerification}
            now={NOW}
          />
        </div>
      </Section>

      <Section eyebrow="R5 · E7" title="The 90/60/30 expiry horizon">
        <div
          style={{
            border: '1px solid var(--vt-border)',
            borderRadius: 12,
            padding: 20,
            background: 'var(--vt-surface, transparent)',
          }}
        >
          <ExpiryHorizon
            now={NOW}
            items={[
              { label: 'State medical license · TX', expiresAt: '2026-08-10' },
              { label: 'DEA registration', expiresAt: '2026-09-01' },
              { label: 'Malpractice coverage', expiresAt: '2026-10-15' },
              { label: 'Board certification · Cardiology', expiresAt: '2027-02-01' },
            ]}
          />
        </div>
      </Section>

      <Section eyebrow="composition" title="Composes with the provenance chip">
        <p
          style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '56ch', margin: '0 0 16px' }}
        >
          The two axes stack: the W1 provenance chip states <em>what</em> the source said and when; the freshness
          meter states <em>how long</em> that observation stays authoritative.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            border: '1px solid var(--vt-border)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <ProvenanceChip
            state="stale"
            attribution={{
              legend: true,
              source: 'State board',
              asOf: '2026-06-10T00:00:00Z',
              detail: '38d ago',
            }}
          />
          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
            <FreshnessMeter
              source="State license monitoring"
              checkedAt="2026-06-10T00:00:00Z"
              window={REGULATORY_WINDOWS.licenseMonitoring}
              now={NOW}
            />
          </div>
        </div>
      </Section>
    </main>
  );
}
