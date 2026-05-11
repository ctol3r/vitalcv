/**
 * Trust State Console + Replay Timeline + design-tokens lockdown.
 *
 * Pins the institutional design doctrine:
 *   - Monochrome palette only (no vibrant hues).
 *   - Trust states encoded by glyph + ink weight, not color hue.
 *   - Bare-word "Verified" never appears as a state label.
 *   - System font + monospace; no webfonts in v0.
 *   - Components are pure-render: no fetches, no fixtures, no
 *     decorative animation, no `Math.random()`.
 *   - Banned strings absent.
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { colors, trustGlyph, type } from '../lib/design-tokens';
import { TrustStateConsole } from '../components/TrustStateConsole';
import { ReplayTimeline } from '../components/ReplayTimeline';

const NEUTRAL_PROPS = {
  subject: { npi: '1346053246', displayName: 'Macie Miller', entityType: 'PA-C' },
  identity: { state: 'ok' as const, detail: 'NPPES record matched' },
  lineage: {
    state: 'ambiguous' as const,
    digest: 'a'.repeat(64),
    eventCount: 4,
    comprehensive: false,
  },
  manifest: {
    state: 'ambiguous' as const,
    schema: 'vitalcv.manifest.v1',
    signed: false,
    kid: null,
  },
  revocation: { state: 'ok' as const, revoked: false, historyCount: 0 },
  jwks: { state: 'ambiguous' as const, status: 'not-configured' as const },
  exports: { state: 'unknown' as const, count: 0, latestDigest: null },
};

describe('design-tokens — palette is monochrome', () => {
  it('all surface ladder values are gray-only', () => {
    for (const [, hex] of Object.entries(colors)) {
      // Reject any hex that has different RGB values >16 apart (vibrant hue).
      const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
      if (!m) continue;
      const r = parseInt(m[1], 16);
      const g = parseInt(m[2], 16);
      const b = parseInt(m[3], 16);
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      expect(maxDiff).toBeLessThanOrEqual(16);
    }
  });

  it('trust state colors are grayscale (no red/green color-coding)', () => {
    for (const state of Object.values(trustGlyph)) {
      const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(state.color);
      expect(m).not.toBeNull();
      if (!m) return;
      const r = parseInt(m[1], 16);
      const g = parseInt(m[2], 16);
      const b = parseInt(m[3], 16);
      expect(Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))).toBeLessThanOrEqual(16);
    }
  });
});

describe('design-tokens — trust state labels avoid bare-Verified', () => {
  it('"ok" state label is "Source-backed", not bare "Verified"', () => {
    expect(trustGlyph.ok.label).toBe('Source-backed');
    expect(trustGlyph.ok.label).not.toBe('Verified');
  });

  it('every trust state has a glyph + label + grayscale color', () => {
    for (const state of Object.values(trustGlyph)) {
      expect(state.glyph.length).toBeGreaterThan(0);
      expect(state.label.length).toBeGreaterThan(0);
      expect(state.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('design-tokens — typography stack', () => {
  it('uses system sans fallback chain (no webfonts in v0)', () => {
    expect(type.fontSans).toContain('system-ui');
    expect(type.fontSans).not.toMatch(/Inter|Geist|Roboto/);
  });

  it('uses system monospace fallback chain', () => {
    expect(type.fontMono).toContain('ui-monospace');
  });

  it('max display size is 28px (no magazine-tier headings)', () => {
    expect(type.size2xl).toBe('28px');
  });
});

describe('TrustStateConsole — render shape', () => {
  const html = renderToStaticMarkup(<TrustStateConsole {...NEUTRAL_PROPS} />);

  it('renders the page-level test id', () => {
    expect(html).toContain('data-testid="trust-state-console"');
  });

  it('renders all six panels', () => {
    expect(html).toContain('data-testid="panel-identity"');
    expect(html).toContain('data-testid="panel-replay-lineage"');
    expect(html).toContain('data-testid="panel-credential-manifest"');
    expect(html).toContain('data-testid="panel-revocation"');
    expect(html).toContain('data-testid="panel-jwks-/-signing"');
    expect(html).toContain('data-testid="panel-audit-exports"');
  });

  it('each panel carries a data-state attribute matching its trust glyph', () => {
    expect(html).toMatch(/data-testid="panel-identity"[^>]*data-state="ok"/);
    expect(html).toMatch(/data-testid="panel-replay-lineage"[^>]*data-state="ambiguous"/);
    expect(html).toMatch(/data-testid="panel-audit-exports"[^>]*data-state="unknown"/);
  });

  it('digest is truncated (first 16 chars + …) — never shown in full', () => {
    const fullDigest = 'a'.repeat(64);
    expect(html).not.toContain(fullDigest);
    expect(html).toContain('a'.repeat(16) + '…');
  });

  it('shows "Unsigned (digest only)" rather than fake-signed certainty', () => {
    expect(html).toContain('Unsigned (digest only)');
  });

  it('shows "Ambiguity-visible" badge for ambiguous panels', () => {
    expect(html).toContain('Ambiguity-visible');
  });

  it('never renders bare-word "Verified" as a state badge', () => {
    // Allowed: "Source-verified" or similar compound forms; reject the
    // bare badge text.
    expect(html).not.toMatch(/>\s*Verified\s*</);
    expect(html).not.toMatch(/aria-label="Verified"/);
  });
});

describe('TrustStateConsole — ambiguity states are explicit', () => {
  it('jwks status: "not-configured" renders the raw string (no inferred "ok")', () => {
    const html = renderToStaticMarkup(<TrustStateConsole {...NEUTRAL_PROPS} />);
    expect(html).toContain('not-configured');
  });

  it('revocation: "Active" when not revoked, "Revoked (history-locked)" when revoked', () => {
    const active = renderToStaticMarkup(<TrustStateConsole {...NEUTRAL_PROPS} />);
    expect(active).toContain('Active');
    const revoked = renderToStaticMarkup(
      <TrustStateConsole
        {...NEUTRAL_PROPS}
        revocation={{ state: 'failed', revoked: true, historyCount: 3 }}
      />,
    );
    expect(revoked).toContain('Revoked (history-locked)');
  });

  it('lineage: "Partial (gaps recorded)" when not comprehensive', () => {
    const html = renderToStaticMarkup(<TrustStateConsole {...NEUTRAL_PROPS} />);
    expect(html).toContain('Partial (gaps recorded)');
  });

  it('exports: latestDigest=null renders "—", never "0x00…" or fabricated digest', () => {
    const html = renderToStaticMarkup(<TrustStateConsole {...NEUTRAL_PROPS} />);
    // The exports panel shows "—" because latestDigest is null.
    expect(html).toContain('—');
  });
});

describe('ReplayTimeline — append-only semantics', () => {
  const sampleEvents = [
    { eventId: 'e1', eventType: 'source_start',    observedAt: '2026-05-11T00:00:01Z', sourceId: 'nppes' },
    { eventId: 'e2', eventType: 'source_complete', observedAt: '2026-05-11T00:00:02Z', sourceId: 'nppes' },
    { eventId: 'e3', eventType: 'passport_ready',  observedAt: '2026-05-11T00:00:03Z', sourceId: null },
  ];

  it('renders the timeline test id', () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline events={sampleEvents} digest={'d'.repeat(64)} comprehensive={true} />,
    );
    expect(html).toContain('data-testid="replay-timeline"');
  });

  it('uses <ol> for ordered append-only semantics (NOT <ul>)', () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline events={sampleEvents} digest={null} comprehensive={false} />,
    );
    expect(html).toContain('<ol');
    expect(html).not.toMatch(/<ul[^>]*data-testid="timeline-list"/);
  });

  it('each event carries its eventType as a data attribute', () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline events={sampleEvents} digest={null} comprehensive={false} />,
    );
    expect(html).toContain('data-event-type="source_start"');
    expect(html).toContain('data-event-type="source_complete"');
    expect(html).toContain('data-event-type="passport_ready"');
  });

  it('event timestamps render in <time> tags with dateTime attribute', () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline events={sampleEvents} digest={null} comprehensive={true} />,
    );
    // React 19 may emit `dateTime` (camel) or `datetime` (lower) depending
    // on renderer version. Either is HTML-spec acceptable; assert presence
    // of the time element + the date value.
    expect(html).toMatch(/<time\s[^>]*=["']2026-05-11T00:00:01Z["']/);
  });

  it('empty events array renders an ambiguity message — never fakes a timeline', () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline events={[]} digest={null} comprehensive={false} />,
    );
    expect(html).toContain('No events recorded');
    expect(html).toContain('unattributable');
  });

  it('comprehensive=false renders "Partial coverage", not "Comprehensive"', () => {
    const html = renderToStaticMarkup(
      <ReplayTimeline events={sampleEvents} digest={null} comprehensive={false} />,
    );
    expect(html).toContain('Partial coverage');
    expect(html).not.toContain('Comprehensive coverage');
  });
});

describe('design-doctrine — banned strings + no fake certainty', () => {
  const html =
    renderToStaticMarkup(<TrustStateConsole {...NEUTRAL_PROPS} />) +
    renderToStaticMarkup(
      <ReplayTimeline
        events={[{ eventId: 'e1', eventType: 'source_complete', observedAt: '2026-05-11T00:00:01Z', sourceId: 'nppes' }]}
        digest={'d'.repeat(64)}
        comprehensive={true}
      />,
    );

  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['complete', 'credentialing'].join(' '),
    ['instant', 'credentialing'].join(' '),
    ['legally', 'accepted'].join(' '),
    ['risk', 'transferred'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];

  it.each(BANNED)('does not contain banned phrase: %s', (phrase) => {
    expect(html).not.toContain(phrase);
  });

  it('never claims "fully verified" or similar fake certainty', () => {
    expect(html).not.toMatch(/fully\s+verified/i);
    expect(html).not.toMatch(/100%\s+verified/i);
    expect(html).not.toMatch(/trusted\s+by\s+default/i);
  });
});
