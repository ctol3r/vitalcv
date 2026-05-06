import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SourceHealthPublicPanel } from '../components/status/SourceHealthPublicPanel';
import type { SourceHealthSnapshot } from '../lib/source-health/sourceHealthTypes';

function snap(over: Partial<SourceHealthSnapshot> & Pick<SourceHealthSnapshot, 'sourceId' | 'state'>): SourceHealthSnapshot {
  return {
    sourceId: over.sourceId,
    state: over.state,
    reason: over.reason ?? `state=${over.state}`,
    lastSuccessAt: over.lastSuccessAt ?? null,
    lastErrorAt: over.lastErrorAt ?? null,
    lastLatencyMs: over.lastLatencyMs ?? null,
    observedAt: over.observedAt ?? '2026-05-06T12:00:00.000Z',
  };
}

const BANNED_PHRASES = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

describe('SourceHealthPublicPanel — empty snapshot store', () => {
  it('renders the empty-state message and does not invent state', () => {
    const html = renderToStaticMarkup(<SourceHealthPublicPanel snapshots={[]} />);
    expect(html).toContain('data-testid="source-health-public-panel"');
    expect(html).toContain('data-snapshot-count="0"');
    expect(html).toContain('data-testid="source-health-empty-state"');
    expect(html).toContain('data-testid="source-health-as-of-empty"');
    // No source rows when empty
    expect(html).not.toContain('data-testid="source-health-list"');
  });
});

describe('SourceHealthPublicPanel — populated snapshots', () => {
  it('renders all four canonical sources in canonical order', () => {
    const html = renderToStaticMarkup(
      <SourceHealthPublicPanel
        snapshots={[
          snap({ sourceId: 'STATE_BOARD', state: 'LIVE' }),
          snap({ sourceId: 'OIG_LEIE', state: 'DEGRADED' }),
          snap({ sourceId: 'NPPES', state: 'LIVE' }),
          snap({ sourceId: 'PECOS', state: 'UNAVAILABLE' }),
        ]}
      />,
    );
    expect(html).toContain('data-snapshot-count="4"');
    // Canonical order: NPPES, OIG_LEIE, PECOS, STATE_BOARD
    const nppesIdx = html.indexOf('data-source-id="NPPES"');
    const oigIdx = html.indexOf('data-source-id="OIG_LEIE"');
    const pecosIdx = html.indexOf('data-source-id="PECOS"');
    const stateBoardIdx = html.indexOf('data-source-id="STATE_BOARD"');
    expect(nppesIdx).toBeGreaterThan(0);
    expect(oigIdx).toBeGreaterThan(nppesIdx);
    expect(pecosIdx).toBeGreaterThan(oigIdx);
    expect(stateBoardIdx).toBeGreaterThan(pecosIdx);
  });

  it('renders the state badge for each row using the snapshot state', () => {
    const html = renderToStaticMarkup(
      <SourceHealthPublicPanel
        snapshots={[
          snap({ sourceId: 'NPPES', state: 'LIVE' }),
          snap({ sourceId: 'OIG_LEIE', state: 'DEGRADED' }),
          snap({ sourceId: 'PECOS', state: 'RATE_LIMITED' }),
          snap({ sourceId: 'STATE_BOARD', state: 'UNAVAILABLE' }),
        ]}
      />,
    );
    expect(html).toContain('data-state="LIVE"');
    expect(html).toContain('data-state="DEGRADED"');
    expect(html).toContain('data-state="RATE_LIMITED"');
    expect(html).toContain('data-state="UNAVAILABLE"');
    expect(html).toContain('Live');
    expect(html).toContain('Degraded');
    expect(html).toContain('Rate limited');
    expect(html).toContain('Unavailable');
  });

  it('marks sources with no snapshot as MISSING when only some are recorded', () => {
    const html = renderToStaticMarkup(
      <SourceHealthPublicPanel
        snapshots={[snap({ sourceId: 'NPPES', state: 'LIVE' })]}
      />,
    );
    expect(html).toContain('data-source-id="NPPES"');
    expect(html).toContain('data-state="LIVE"');
    expect(html).toContain('data-state="MISSING"');
    expect(html).toContain('No snapshot recorded.');
  });

  it('renders newestObservedAt as the as-of timestamp', () => {
    const html = renderToStaticMarkup(
      <SourceHealthPublicPanel
        snapshots={[
          snap({ sourceId: 'NPPES', state: 'LIVE', observedAt: '2026-05-06T11:00:00.000Z' }),
          snap({ sourceId: 'OIG_LEIE', state: 'LIVE', observedAt: '2026-05-06T13:00:00.000Z' }),
          snap({ sourceId: 'PECOS', state: 'LIVE', observedAt: '2026-05-06T12:00:00.000Z' }),
        ]}
      />,
    );
    expect(html).toContain('As of 2026-05-06T13:00:00.000Z');
  });

  it('renders lastSuccessAt and lastErrorAt as plain text data attrs without raw payload', () => {
    const html = renderToStaticMarkup(
      <SourceHealthPublicPanel
        snapshots={[
          snap({
            sourceId: 'NPPES',
            state: 'LIVE',
            lastSuccessAt: '2026-05-06T12:00:00.000Z',
            lastErrorAt: '2026-05-04T09:00:00.000Z',
            lastLatencyMs: 234,
          }),
        ]}
      />,
    );
    expect(html).toContain('data-last-success-at="2026-05-06T12:00:00.000Z"');
    expect(html).toContain('data-last-error-at="2026-05-04T09:00:00.000Z"');
    expect(html).toContain('234 ms');
  });
});

describe('SourceHealthPublicPanel — banned strings', () => {
  it('renders no banned overclaim copy in any state', () => {
    const allStates = ['LIVE', 'DEGRADED', 'UNAVAILABLE', 'RATE_LIMITED', 'UNKNOWN'] as const;
    for (const state of allStates) {
      const html = renderToStaticMarkup(
        <SourceHealthPublicPanel
          snapshots={[snap({ sourceId: 'NPPES', state })]}
        />,
      );
      const lower = html.toLowerCase();
      for (const phrase of BANNED_PHRASES) {
        expect(lower).not.toContain(phrase.toLowerCase());
      }
      // No bare "Verified" status label; we use "Live" instead.
      expect(html).not.toMatch(/>Verified</);
    }
  });
});
