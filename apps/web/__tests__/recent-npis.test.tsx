/**
 * Pins the recent-NPI replay-memory primitive on three load-bearing
 * properties:
 *
 *   1. The pure `applyRecentNpiUpdate()` reducer enforces dedupe +
 *      move-to-head + replayCount-increment + cap=10.
 *   2. The `<RecentNpis>` primitive renders identifiers as visible
 *      monospace text (not aria-only), surfaces the "replayed Nx"
 *      indicator on re-touched entries, and renders an empty state
 *      that reads as institutional absence-of-history.
 *   3. Doctrine: no banned strings; no bare `Verified` label.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  applyRecentNpiUpdate,
  RECENT_NPIS_CAP,
  type RecentNpiEntry,
} from '@/lib/hooks/useRecentNpis';
import { RecentNpis } from '@/components/trust';

const FIXED_NOW = new Date('2026-05-12T12:00:00.000Z');

function entry(npi: string, overrides: Partial<RecentNpiEntry> = {}): RecentNpiEntry {
  return {
    npi,
    displayName: 'Test Clinician',
    lineageKey: `lin_v1_${npi}`,
    runId: `run_v1_${npi}aaaa`,
    lastCheckedAt: '2026-04-01T15:00:00.000Z',
    viewedAt: '2026-05-01T10:00:00.000Z',
    replayCount: 1,
    ...overrides,
  };
}

describe('applyRecentNpiUpdate — reducer contract', () => {
  it('inserts a new NPI at the head with replayCount=1', () => {
    const out = applyRecentNpiUpdate([], { npi: '1346053246' }, FIXED_NOW);
    expect(out).toHaveLength(1);
    expect(out[0].npi).toBe('1346053246');
    expect(out[0].replayCount).toBe(1);
    expect(out[0].viewedAt).toBe(FIXED_NOW.toISOString());
  });

  it('moves an existing NPI to the head and increments replayCount', () => {
    const prior = [entry('1111111111'), entry('1346053246'), entry('2222222222')];
    const out = applyRecentNpiUpdate(prior, { npi: '2222222222' }, FIXED_NOW);
    expect(out.map((e) => e.npi)).toEqual(['2222222222', '1111111111', '1346053246']);
    expect(out[0].replayCount).toBe(2);
    expect(out[0].viewedAt).toBe(FIXED_NOW.toISOString());
  });

  it('does not duplicate when re-touching the same NPI multiple times', () => {
    let state: RecentNpiEntry[] = [];
    state = applyRecentNpiUpdate(state, { npi: '1346053246' }, FIXED_NOW);
    state = applyRecentNpiUpdate(state, { npi: '1346053246' }, FIXED_NOW);
    state = applyRecentNpiUpdate(state, { npi: '1346053246' }, FIXED_NOW);
    expect(state).toHaveLength(1);
    expect(state[0].replayCount).toBe(3);
  });

  it('rejects an invalid NPI and returns the prior state unchanged', () => {
    const prior = [entry('1111111111')];
    const out = applyRecentNpiUpdate(prior, { npi: 'not-a-npi' });
    expect(out).toEqual(prior);
  });

  it(`caps the list at ${RECENT_NPIS_CAP}`, () => {
    let state: RecentNpiEntry[] = [];
    for (let i = 0; i < 15; i += 1) {
      // Generate 10-digit NPIs by left-padding the index.
      const npi = `${1000000000 + i}`;
      state = applyRecentNpiUpdate(state, { npi }, FIXED_NOW);
    }
    expect(state).toHaveLength(RECENT_NPIS_CAP);
    // Newest first → highest-indexed should be at the head.
    expect(state[0].npi).toBe('1000000014');
  });

  it('preserves prior metadata when re-touching with absent fields', () => {
    const prior = [entry('1346053246', { displayName: 'Macie Miller', runId: 'run_v1_AAAA' })];
    const out = applyRecentNpiUpdate(prior, { npi: '1346053246' }, FIXED_NOW);
    expect(out[0].displayName).toBe('Macie Miller');
    expect(out[0].runId).toBe('run_v1_AAAA');
  });

  it('overrides prior metadata when re-touching with present fields', () => {
    const prior = [entry('1346053246', { runId: 'run_v1_OLD_' })];
    const out = applyRecentNpiUpdate(
      prior,
      { npi: '1346053246', runId: 'run_v1_NEW_' },
      FIXED_NOW,
    );
    expect(out[0].runId).toBe('run_v1_NEW_');
  });
});

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe('<RecentNpis> — visibility + replay rendering', () => {
  it('empty state renders explicit no-history line (not a placeholder card)', () => {
    const html = render(<RecentNpis items={[]} />);
    expect(html).toContain('No recent inspections on this client.');
    expect(html).toContain('data-recent-npis-count="0"');
  });

  it('renders the NPI as visible monospace text + clickable link', () => {
    const html = render(<RecentNpis items={[entry('1346053246')]} />);
    expect(html).toMatch(/>1346053246</);
    expect(html).toContain('href="/passport/1346053246"');
    expect(html).toContain('data-npi="1346053246"');
  });

  it('surfaces the "replayed Nx" indicator when replayCount > 1', () => {
    const html = render(
      <RecentNpis items={[entry('1346053246', { replayCount: 3 })]} />,
    );
    expect(html).toContain('replayed 3x');
    expect(html).toContain('data-replay-count="3"');
  });

  it('does not render the replay indicator on first-time entries', () => {
    const html = render(
      <RecentNpis items={[entry('1346053246', { replayCount: 1 })]} />,
    );
    expect(html).not.toContain('replayed');
  });

  it('highlights the currentNpi entry', () => {
    const html = render(
      <RecentNpis
        items={[entry('1346053246'), entry('1111111111')]}
        currentNpi="1346053246"
      />,
    );
    // The current entry carries data-current="true" and a visible "current" label
    expect(html).toMatch(/data-npi="1346053246"[^>]*data-replay-count="\d+"[^>]*data-current="true"/);
    expect(html).toContain('>current</span>');
  });

  it('respects the max prop', () => {
    const items = Array.from({ length: 8 }, (_, i) => entry(`${1000000000 + i}`));
    const html = render(<RecentNpis items={items} max={3} />);
    expect(html).toContain('data-recent-npis-count="3"');
  });
});

describe('doctrine — banned-strings scan', () => {
  it('renders no banned phrases', () => {
    const items = [
      entry('1346053246', { replayCount: 3 }),
      entry('1111111111'),
    ];
    const html = render(<RecentNpis items={items} currentNpi="1346053246" />);
    const banned = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of banned) {
      expect(html).not.toContain(phrase);
    }
    // No bare "Verified" label
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});
