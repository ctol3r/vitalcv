'use client';

import { useEffect } from 'react';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

/**
 * Global error boundary — adopted from the wave1505 system-states design
 * (DG-12.2). This renders its own <html>/<body> and fires when the root layout
 * itself fails, so it can rely on NO app CSS: every style here is literal
 * (paper/ink palette, literal font stacks). Fail-closed doctrine copy reused
 * from the wave1505 CHANGES.md. Preserves the pilot failure signal, reset(),
 * support-contact, and the technical digest.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-system.jsx (SysError)
 */

const paper = '#f4f2ec';
const ink = '#141414';
const rule = '#dddbd3';
const ruleStrong = '#c9c6bd';
const textSecondary = '#474540';
const textMuted = '#6b6860';
const stateP0 = '#7a1414';
const displayFont = "'Fraunces', Georgia, 'Times New Roman', serif";
const monoFont = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const bodyFont = "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
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
        <style>{`
          .wv-quiet-cta {
            font-family: ${monoFont};
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: ${ink};
            background: transparent;
            border: none;
            border-bottom: 1px solid ${ruleStrong};
            padding: 0 0 2px;
            cursor: pointer;
            white-space: nowrap;
          }
          .wv-quiet-cta:hover { border-bottom-color: ${ink}; }
        `}</style>
        <PilotFailureSignal
          title="System interruption"
          message={error.message}
          queueItem={{ source: 'route_failure' }}
          details={{ digest: error.digest ?? null }}
          dedupeKey={`global-error:${error.digest ?? error.message}`}
        />
        <div style={{ display: 'flex' }}>
          <span style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 18, letterSpacing: '-0.01em' }}>
            VitalCV
          </span>
        </div>
        <main style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '48px 0' }}>
          <div role="alert" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
            <div
              aria-label="Failure reference"
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
              <span style={{ color: stateP0, fontWeight: 600 }}>FAILED</span>
              {error.digest ? <> · ref {error.digest}</> : null}
              <br />
              reference logged — include it if you write in
            </div>
            <h1 style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, maxWidth: '15ch' }}>
              Something failed on our side.
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: textSecondary, maxWidth: '46ch' }}>
              Nothing was recorded as successful. The platform hit a temporary interruption — your data
              is untouched. Refresh to continue; if it persists, include the reference above.
            </p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <button
                onClick={reset}
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
                  border: '1px solid transparent',
                  borderRadius: 2,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Refresh view
              </button>
              <SupportActionButton
                label="Write to us"
                title="System interruption"
                messagePrefill={error.message}
                className="wv-quiet-cta"
              />
            </div>
          </div>
        </main>
        <p style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.06em', color: textMuted, margin: 0 }}>
          © 2026 VitalCV · errors are stated, never dressed up
        </p>
      </body>
    </html>
  );
}
