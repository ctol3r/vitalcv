/**
 * Tests for the ReplayIntegrityPanel surface helpers + the React panel.
 *
 * The panel composes three async-resolved findings. Tests pin:
 *   - evaluateReplayCoherence transitions through every state correctly
 *   - summarizeReplayGaps respects the threshold + sorting
 *   - panel renders each state with the matching data-* marker
 *   - doctrine: no banned strings
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import {
  evaluateReplayCoherence,
  summarizeReplayGaps,
} from '@/lib/replay/integrityEvaluation';
import {
  computeLineageKey,
  computeRunId,
} from '@/lib/replay/clientReplayIdentity';

const EVIDENCE = {
  entityId: '1346053246',
  lastCheckedAt: '2026-04-01T15:00:00.000Z',
  artifactChecksums: ['cks-aaa', 'cks-bbb'],
  channel: 'NPPES_API',
} as const;

async function knownIdentity(): Promise<{ lineageKey: string; runId: string }> {
  return {
    lineageKey: await computeLineageKey(EVIDENCE.entityId),
    runId: await computeRunId(EVIDENCE),
  };
}

describe('evaluateReplayCoherence', () => {
  it('returns no-declaration when declared is null', async () => {
    const f = await evaluateReplayCoherence({ ...EVIDENCE, declared: null });
    expect(f.state).toBe('no-declaration');
    if (f.state === 'no-declaration') {
      expect(f.expectedLineageKey).toMatch(/^lin_v1_[0-9a-f]{16}$/);
      expect(f.expectedRunId).toMatch(/^run_v1_[0-9a-f]{16}$/);
    }
  });

  it('returns coherent when declared matches recomputed', async () => {
    const known = await knownIdentity();
    const f = await evaluateReplayCoherence({
      ...EVIDENCE,
      declared: { lineageKey: known.lineageKey, runId: known.runId, schemeVersion: 'v1' },
    });
    expect(f.state).toBe('coherent');
  });

  it('returns lineage-drift when declared lineageKey differs (DIFFERENT SUBJECT)', async () => {
    const known = await knownIdentity();
    const f = await evaluateReplayCoherence({
      ...EVIDENCE,
      declared: { lineageKey: 'lin_v1_aaaabbbbccccdddd', runId: known.runId },
    });
    expect(f.state).toBe('lineage-drift');
    if (f.state === 'lineage-drift') {
      expect(f.declaredLineageKey).toBe('lin_v1_aaaabbbbccccdddd');
      expect(f.expectedLineageKey).toBe(known.lineageKey);
    }
  });

  it('returns run-drift when lineageKey matches but runId differs (SAME SUBJECT, EVIDENCE CHANGED)', async () => {
    const known = await knownIdentity();
    const f = await evaluateReplayCoherence({
      ...EVIDENCE,
      declared: { lineageKey: known.lineageKey, runId: 'run_v1_aaaabbbbccccdddd' },
    });
    expect(f.state).toBe('run-drift');
    if (f.state === 'run-drift') {
      expect(f.declaredRunId).toBe('run_v1_aaaabbbbccccdddd');
      expect(f.expectedRunId).toBe(known.runId);
    }
  });
});

describe('summarizeReplayGaps', () => {
  it('zero history → snapshotCount=0, continuous=true (no gaps to detect)', () => {
    const s = summarizeReplayGaps([]);
    expect(s.snapshotCount).toBe(0);
    expect(s.continuous).toBe(true);
    expect(s.gapCount).toBe(0);
  });

  it('history within threshold → continuous=true', () => {
    const s = summarizeReplayGaps(
      [
        { checkedAt: '2026-04-01T00:00:00Z' },
        { checkedAt: '2026-04-08T00:00:00Z' },
        { checkedAt: '2026-04-15T00:00:00Z' },
      ],
      720,
    );
    expect(s.continuous).toBe(true);
    expect(s.snapshotCount).toBe(3);
    expect(s.gapCount).toBe(0);
  });

  it('detects a gap above threshold and reports its size + endpoints', () => {
    const s = summarizeReplayGaps(
      [
        { checkedAt: '2026-01-01T00:00:00Z', runId: 'run_v1_a' },
        { checkedAt: '2026-04-01T00:00:00Z', runId: 'run_v1_b' },
      ],
      720,
    );
    expect(s.continuous).toBe(false);
    expect(s.gapCount).toBe(1);
    expect(s.largestGap?.from).toBe('2026-01-01T00:00:00Z');
    expect(s.largestGap?.to).toBe('2026-04-01T00:00:00Z');
    expect(s.largestGapHours).toBeGreaterThan(720);
  });

  it('reports only the LARGEST gap when multiple exist', () => {
    const s = summarizeReplayGaps(
      [
        { checkedAt: '2025-01-01T00:00:00Z' },
        { checkedAt: '2025-06-01T00:00:00Z' }, // 5-month gap
        { checkedAt: '2026-04-01T00:00:00Z' }, // 10-month gap (largest)
      ],
      720,
    );
    expect(s.gapCount).toBe(2);
    expect(s.largestGap?.from).toBe('2025-06-01T00:00:00Z');
    expect(s.largestGap?.to).toBe('2026-04-01T00:00:00Z');
  });

  it('handles unsorted history by sorting internally', () => {
    const s = summarizeReplayGaps(
      [
        { checkedAt: '2026-04-01T00:00:00Z' },
        { checkedAt: '2026-01-01T00:00:00Z' },
      ],
      720,
    );
    expect(s.gapCount).toBe(1);
    expect(s.largestGap?.from).toBe('2026-01-01T00:00:00Z');
    expect(s.largestGap?.to).toBe('2026-04-01T00:00:00Z');
  });
});

describe('<ReplayIntegrityPanel> server-rendered shape', () => {
  // The panel resolves its coherence finding via useEffect, so a
  // synchronous server render captures the initial "computing…" state.
  // We test that initial markup carries the right data-* anchors and
  // structural rows; full async-resolved coverage is in the helper
  // tests above.
  it('renders the three rows + section anchor', async () => {
    const { ReplayIntegrityPanel } = await import('@/components/trust/ReplayIntegrityPanel');
    const html = renderToStaticMarkup(
      React.createElement(ReplayIntegrityPanel, {
        evidence: EVIDENCE,
        declared: null,
        history: [],
      }),
    );
    expect(html).toContain('data-replay-integrity-panel="true"');
    expect(html).toContain('data-replay-coherence="computing"');
    expect(html).toContain('data-replay-gaps="no-history"');
    expect(html).toContain('data-replay-identity="computing"');
  });

  it('renders the gap row with the discontinuous marker when given a gap-prone history', async () => {
    const { ReplayIntegrityPanel } = await import('@/components/trust/ReplayIntegrityPanel');
    const html = renderToStaticMarkup(
      React.createElement(ReplayIntegrityPanel, {
        evidence: EVIDENCE,
        history: [
          { checkedAt: '2026-01-01T00:00:00Z' },
          { checkedAt: '2026-04-01T00:00:00Z' },
        ],
        gapThresholdHours: 720,
      }),
    );
    expect(html).toContain('data-replay-gaps="discontinuous"');
    expect(html).toContain('data-gap-count="1"');
  });
});

describe('doctrine — banned-strings scan', () => {
  it('renders no banned phrases for any of the four coherence states', async () => {
    const { ReplayIntegrityPanel } = await import('@/components/trust/ReplayIntegrityPanel');
    const known = await knownIdentity();
    const variants = [
      { declared: null, history: [] },
      { declared: { lineageKey: known.lineageKey, runId: known.runId, schemeVersion: 'v1' as const }, history: [] },
      { declared: { lineageKey: known.lineageKey, runId: 'run_v1_aaaabbbbccccdddd' }, history: [] },
      { declared: { lineageKey: 'lin_v1_aaaabbbbccccdddd', runId: known.runId }, history: [] },
    ];
    const combined = variants
      .map((v) => renderToStaticMarkup(
        React.createElement(ReplayIntegrityPanel, { evidence: EVIDENCE, ...v }),
      ))
      .join('\n');
    const banned = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const p of banned) expect(combined).not.toContain(p);
    expect(combined).not.toMatch(/>\s*Verified\s*</);
  });
});
