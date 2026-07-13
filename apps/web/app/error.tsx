'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

/**
 * Route error boundary — adopted from the wave1505 system-states design
 * (DG-12.2). Fail-closed doctrine copy recorded in the wave1505 CHANGES.md
 * ("Nothing was recorded as successful." — reused verbatim). Paper/ink,
 * self-contained inline styles; preserves the pilot failure signal, telemetry,
 * reset(), and support-contact behavior.
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
const displayFont = "var(--font-display, 'Fraunces', Georgia, serif)";
const monoFont = "var(--font-mono, 'Geist Mono', ui-monospace, monospace)";
const bodyFont = "var(--font-body, 'Geist', ui-sans-serif, system-ui, sans-serif)";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void trackPilotEvent({ eventType: 'dead_end_reached', oncePerSession: false, details: { page: 'error', digest: error.digest ?? null } });
  }, [error]);

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
      <PilotFailureSignal
        title="Page could not load"
        message={error.digest ?? 'runtime_error'}
        queueItem={{ source: 'route_failure' }}
        details={{ digest: error.digest ?? null }}
        dedupeKey={`app-error:${error.digest ?? 'unknown'}`}
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
            Nothing was recorded as successful. If you were mid-request, it did not complete — no partial
            result was saved, and no source was marked checked. Retry when ready.
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
              Try again
            </button>
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
            <SupportActionButton
              label="Write to us"
              title="Page could not load"
              messagePrefill={error.digest ?? 'An error occurred'}
              className="wv-quiet-cta"
            />
          </div>
        </div>
      </main>
      <p style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.06em', color: textMuted, margin: 0 }}>
        © 2026 VitalCV · errors are stated, never dressed up
      </p>
    </div>
  );
}
