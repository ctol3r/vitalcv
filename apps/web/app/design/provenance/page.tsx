/**
 * /design/provenance — Provenance Chip System v2 (design reference)
 *
 * The living reference for the canonical provenance-carrying status atom
 * (design-system/components/ProvenanceChip). Every status = dot + operator-
 * honest word + a visible mono `source · timestamp` line; `revoked` owns the
 * only red (fail-closed) register; `selfAttested` renders in a dashed band so
 * it can never read as source-checked.
 *
 * Anchored to the canonical source-coverage vocabulary
 * (`@vitalcv/trust-state`). This is the W1 foundation the readiness, verify,
 * proof-packet, and employer-review surfaces render.
 *
 * Design Handoff References:
 *   docs/design/ui-ux-inspiration-repository-2026-07-17.md  (patterns T1–T3, T6)
 *   docs/design/evidence-surface-fieldguide.html            (visual spec)
 *   docs/design/p0-wave-plan-2026-07-18.md                  (W1 scope)
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ProvenanceChip,
  ProvenanceChipLegend,
} from '@/design-system/components';

export const metadata: Metadata = {
  title: 'Provenance Chip System v2 — design reference',
  description:
    'The canonical provenance-carrying status atom: dot, operator-honest word, and a visible mono source and timestamp line. Six visual registers plus a fail-closed revoked state and a dashed self-attested band.',
  robots: { index: false, follow: false },
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        borderTop: '1px solid var(--vt-border)',
        paddingTop: 28,
        marginTop: 40,
      }}
    >
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
      <h2
        style={{
          margin: '0 0 20px',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--vt-text-primary)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ProvenanceDesignReferencePage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '56px 24px 96px',
        color: 'var(--vt-text-primary)',
        background: 'var(--vt-surface, transparent)',
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
        Design system · W1 foundation
      </p>
      <h1
        style={{
          margin: '0 0 14px',
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        The Provenance Chip
      </h1>
      <p
        style={{
          fontSize: 15.5,
          lineHeight: 1.6,
          color: 'var(--vt-text-secondary)',
          maxWidth: '60ch',
          margin: 0,
        }}
      >
        One canonical status atom, reused across wallet, readiness, verify, and
        review. Each status is a dot, an operator-honest word, and a{' '}
        <strong style={{ color: 'var(--vt-text-primary)' }}>
          visible mono source and timestamp line
        </strong>
        . Color is never the only signal — the dot shape and the word carry it
        too. Only <code>checked</code> earns the word &ldquo;Checked&rdquo;.
      </p>

      <Section eyebrow="T1 · T2 · T6" title="The six-register set">
        <ProvenanceChipLegend heading="Most surfaces show these six" />
      </Section>

      <Section eyebrow="fail-closed" title="Red belongs to revoked, and nothing else">
        <div
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <ProvenanceChip
            state="revoked"
            attribution={{
              legend: true,
              source: 'Issuer',
              asOf: '2026-06-30T00:00:00Z',
              detail: 'fails closed',
            }}
          />
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--vt-text-secondary)',
              maxWidth: '48ch',
              margin: 0,
            }}
          >
            A withdrawn credential renders as a full stop — the content blocks,
            but the custody history stays visible. It is the single fail-closed
            register (a rotated diamond dot), distinct from{' '}
            <code>unavailable</code> (a system condition) and{' '}
            <code>reviewRequired</code> (routed, not decided). No other state is
            painted with the reserved critical red.
          </p>
        </div>
      </Section>

      <Section
        eyebrow="self-attested"
        title="Holder-entered evidence stays visibly apart"
      >
        <div
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <ProvenanceChip
            state="selfAttested"
            attribution={{ legend: true, detail: 'entered by holder' }}
          />
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--vt-text-secondary)',
              maxWidth: '48ch',
              margin: 0,
            }}
          >
            A dashed band and a hollow dot — so a self-reported field can never
            visually blend into a source-checked one.
          </p>
        </div>
      </Section>

      <Section eyebrow="reference" title="Every state">
        <ProvenanceChipLegend rows="all" heading="Full vocabulary" />
      </Section>
    </main>
  );
}
