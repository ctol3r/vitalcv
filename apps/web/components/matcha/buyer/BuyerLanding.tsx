/**
 * BuyerLanding — shared, honest layout for the MATCHA buyer pages (Waves 6–8).
 *
 * Presentational and data-driven so recruiter / hospital / investor pages stay consistent.
 * Copy discipline: benefits are directional (based on the VitalCV model), NOT customer-reported
 * results, and every page carries an explicit disclaimer to that effect. No banned strings.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

export interface ComparisonRow {
  label: string;
  traditional: string;
  vital: string;
}

export interface BenefitItem {
  title: string;
  body: string;
}

export interface BuyerLandingProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Honest framing line rendered near the top and above the comparison. */
  disclaimer: string;
  comparison: {
    traditionalLabel: string;
    vitalLabel: string;
    rows: ComparisonRow[];
  };
  benefits: BenefitItem[];
  /** One line on how MATCHA explains its recommendations — the trust hook. */
  matchaLine: string;
  cta: { label: string; href: string };
  /** Optional extra section (e.g. the investor ecosystem map). */
  children?: ReactNode;
}

export function BuyerLanding({
  eyebrow,
  title,
  subtitle,
  disclaimer,
  comparison,
  benefits,
  matchaLine,
  cta,
  children,
}: BuyerLandingProps) {
  return (
    <main className="mz mz-paper" style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 20px 96px', color: 'var(--vt-text-primary)', minHeight: '100vh' }}>
      {/* Hero */}
      <header style={{ maxWidth: 760 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT }}>
          {eyebrow}
        </p>
        <h1 style={{ margin: '12px 0 0', fontSize: 44, lineHeight: 1.08, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.55, color: 'var(--vt-text-secondary)' }}>
          {subtitle}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          <Link
            href={cta.href}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              background: ACCENT,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {cta.label}
          </Link>
          <Link
            href="/holder/matcha"
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            See matching for clinicians
          </Link>
        </div>
      </header>

      {/* Comparison: Traditional → VitalCV */}
      <section style={{ marginTop: 56 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--vt-text-secondary)', textTransform: 'uppercase' }}>
          {comparison.traditionalLabel} <span style={{ color: ACCENT }}>→</span> {comparison.vitalLabel}
        </h2>
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={thStyle} />
                <th style={{ ...thStyle, color: 'var(--vt-text-muted)' }}>{comparison.traditionalLabel}</th>
                <th style={{ ...thStyle, color: ACCENT }}>{comparison.vitalLabel}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{row.label}</td>
                  <td style={{ ...tdStyle, color: 'var(--vt-text-muted)' }}>{row.traditional}</td>
                  <td style={{ ...tdStyle, color: 'var(--vt-text-primary)', background: `color-mix(in srgb, ${ACCENT} 5%, transparent)` }}>
                    {row.vital}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--vt-text-muted)', lineHeight: 1.5, maxWidth: 720 }}>
          {disclaimer}
        </p>
      </section>

      {/* Benefits */}
      <section style={{ marginTop: 56 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {benefits.map((b) => (
            <div key={b.title} style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{b.title}</h3>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--vt-text-secondary)' }}>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MATCHA trust hook */}
      <section
        style={{
          marginTop: 40,
          background: `color-mix(in srgb, ${ACCENT} 7%, var(--vt-surface, #fff))`,
          border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)`,
          borderRadius: 20,
          padding: 24,
        }}
      >
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT }}>
          Explained, not asserted
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 18, lineHeight: 1.5, fontWeight: 500, maxWidth: 760 }}>
          {matchaLine}
        </p>
      </section>

      {children}

      {/* Closing CTA */}
      <section style={{ marginTop: 56, textAlign: 'center' }}>
        <Link
          href={cta.href}
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            borderRadius: 12,
            background: ACCENT,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {cta.label}
        </Link>
      </section>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--vt-border, #E2E8E6)',
};

const tdStyle: React.CSSProperties = {
  padding: '14px',
  fontSize: 14,
  lineHeight: 1.5,
  borderBottom: '1px solid var(--vt-border, #EEF2F0)',
  verticalAlign: 'top',
};
