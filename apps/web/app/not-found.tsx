import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundTracker } from '@/lib/analytics/not-found-tracker';

/**
 * 404 — adopted from the wave1505 system-states design (DG-12.2).
 * Paper/ink, fail-closed doctrine copy recorded in the wave1505 CHANGES.md
 * ("This page isn't part of the record." — reused verbatim). Self-contained
 * inline styles keyed to the wave1505 palette with --font-* fallbacks, so the
 * page needs no global stylesheet and picks up real Fraunces/Geist when present.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-system.jsx (Sys404)
 */

export const metadata: Metadata = {
  title: { absolute: 'Page Not Found — VitalCV' },
};

const paper = '#f4f2ec';
const ink = '#141414';
const rule = '#dddbd3';
const textSecondary = '#474540';
const textMuted = '#6b6860';
const stateP0 = '#7a1414';
const displayFont = "var(--font-display, 'Fraunces', Georgia, serif)";
const monoFont = "var(--font-mono, 'Geist Mono', ui-monospace, monospace)";
const bodyFont = "var(--font-body, 'Geist', ui-sans-serif, system-ui, sans-serif)";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        padding: '32px 24px 72px',
        background: paper,
        color: ink,
        fontFamily: bodyFont,
      }}
    >
      <NotFoundTracker />
      <div style={{ display: 'flex' }}>
        <span style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 18, letterSpacing: '-0.01em' }}>
          VitalCV
        </span>
      </div>
      <main style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '48px 0' }}>
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
          <div
            aria-label="Request status"
            style={{
              alignSelf: 'stretch',
              fontFamily: monoFont,
              fontSize: 11,
              letterSpacing: '0.05em',
              lineHeight: 1.8,
              color: textSecondary,
              border: `1px solid ${rule}`,
              background: '#ffffff',
              borderRadius: 2,
              padding: '10px 14px',
              overflowWrap: 'anywhere',
            }}
          >
            <span style={{ color: stateP0, fontWeight: 600 }}>404 · NOT FOUND</span> · nothing at this address
          </div>
          <h1 style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, maxWidth: '15ch' }}>
            This page isn&rsquo;t part of the record.
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: textSecondary, maxWidth: '46ch' }}>
            The address may have changed, or it never existed. Nothing was deleted silently — if a share
            link stopped working, its holder revoked it, and that revocation is logged.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 46,
                padding: '0 22px',
                fontFamily: bodyFont,
                fontSize: 13.5,
                fontWeight: 500,
                color: paper,
                background: ink,
                borderRadius: 2,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Back to vitalcv.com
            </Link>
            <Link
              href="/status"
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: ink,
                textDecoration: 'none',
                borderBottom: `1px solid ${rule}`,
                paddingBottom: 2,
                whiteSpace: 'nowrap',
              }}
            >
              Check system status
            </Link>
          </div>
        </div>
      </main>
      <p style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.06em', color: textMuted, margin: 0 }}>
        © 2026 VitalCV · a partial proof stays partial
      </p>
    </div>
  );
}
