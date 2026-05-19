import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  BINDING_RATIONALES,
  BINDING_RATIONALE_COPY,
  MAX_PANE_DEPTH,
  NAVIGATION_OWNERSHIP,
  PROVENANCE_PANE_CATEGORIES,
  PROVENANCE_PANE_DESCRIPTIONS,
  deterministicallyOrderPanes,
  enforcePaneDepth,
  paneKey,
  safePush,
  wouldCycle,
} from '@/lib/trust/navigation-contract';
import type { PaneRef } from '@/lib/trust/panes';
import { PANE_KINDS } from '@/lib/trust/panes';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/trust/panes/rec-test',
  useSearchParams: () => ({
    get: () => null,
    toString: () => '',
  }),
}));

import {
  ProvenancePaneHeader,
  ProvenancePaneMeta,
  ProvenanceChronology,
  ProvenanceTrail,
  ReplayRunStamp,
  EntityBindingSummary,
} from '@/components/trust/navigation';

describe('navigation contract · closed categories', () => {
  it('exposes the same five categories as the URL contract', () => {
    expect([...PROVENANCE_PANE_CATEGORIES]).toEqual([...PANE_KINDS]);
  });

  it('every category has a binding description', () => {
    for (const cat of PROVENANCE_PANE_CATEGORIES) {
      expect(PROVENANCE_PANE_DESCRIPTIONS[cat]).toBeTruthy();
    }
  });

  it('NAVIGATION_OWNERSHIP names the canonical owner and embed lists', () => {
    expect(NAVIGATION_OWNERSHIP.canonical).toBe('/trust/panes/[receiptId]');
    expect(NAVIGATION_OWNERSHIP.mustNotEmbed).toContain('/signup');
    expect(NAVIGATION_OWNERSHIP.mustNotEmbed).toContain(
      'app shell / navigation chrome',
    );
  });
});

describe('paneKey · cycle detection identity', () => {
  it('builds <kind>:<id>', () => {
    expect(paneKey({ kind: 'receipt', id: 'r1' })).toBe('receipt:r1');
  });
});

describe('wouldCycle', () => {
  const stack: PaneRef[] = [
    { kind: 'receipt', id: 'r1' },
    { kind: 'claim', id: 'c1' },
    { kind: 'audit', id: 'a1' },
  ];

  it('detects an exact duplicate (same kind + id)', () => {
    expect(wouldCycle(stack, { kind: 'claim', id: 'c1' })).toBe(true);
  });

  it('returns false for same id under a different kind', () => {
    expect(wouldCycle(stack, { kind: 'audit', id: 'c1' })).toBe(false);
  });

  it('returns false for a brand-new pane', () => {
    expect(wouldCycle(stack, { kind: 'lineage', id: 'lk1' })).toBe(false);
  });
});

describe('safePush · cycle protection + depth governance', () => {
  it('refuses to push a pane already in the stack', () => {
    const stack: PaneRef[] = [{ kind: 'receipt', id: 'r1' }];
    const result = safePush(stack, 0, { kind: 'receipt', id: 'r1' });
    expect(result.cycled).toBe(true);
    expect(result.panes).toBe(stack);
    expect(result.truncated).toBe(0);
  });

  it('pushes a new pane and reports no truncation when under MAX_PANE_DEPTH', () => {
    const stack: PaneRef[] = [{ kind: 'receipt', id: 'r1' }];
    const result = safePush(stack, 0, { kind: 'claim', id: 'c1' });
    expect(result.cycled).toBe(false);
    expect(result.panes).toEqual([
      { kind: 'receipt', id: 'r1' },
      { kind: 'claim', id: 'c1' },
    ]);
    expect(result.truncated).toBe(0);
  });

  it('truncates oldest panes when MAX_PANE_DEPTH is exceeded', () => {
    const stack: PaneRef[] = Array.from({ length: MAX_PANE_DEPTH }, (_, i) => ({
      kind: 'claim' as const,
      id: `c${i}`,
    }));
    const result = safePush(stack, stack.length - 1, {
      kind: 'lineage',
      id: 'lk1',
    });
    expect(result.cycled).toBe(false);
    expect(result.truncated).toBe(1);
    expect(result.panes).toHaveLength(MAX_PANE_DEPTH);
    // Active rightmost preserved
    expect(result.panes[result.panes.length - 1]).toEqual({
      kind: 'lineage',
      id: 'lk1',
    });
    // Oldest dropped
    expect(result.panes[0]).toEqual({ kind: 'claim', id: 'c1' });
  });
});

describe('enforcePaneDepth', () => {
  it('is a no-op when under the limit', () => {
    const stack: PaneRef[] = [{ kind: 'receipt', id: 'r1' }];
    expect(enforcePaneDepth(stack)).toEqual({ panes: stack, truncated: 0 });
  });

  it('drops oldest panes to reach the limit', () => {
    const stack: PaneRef[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'claim' as const,
      id: `c${i}`,
    }));
    const { panes, truncated } = enforcePaneDepth(stack, 4);
    expect(truncated).toBe(6);
    expect(panes).toHaveLength(4);
    expect(panes[0]).toEqual({ kind: 'claim', id: 'c6' });
    expect(panes[3]).toEqual({ kind: 'claim', id: 'c9' });
  });
});

describe('deterministicallyOrderPanes', () => {
  it('sorts by category first, then id', () => {
    const input: PaneRef[] = [
      { kind: 'lineage', id: 'b' },
      { kind: 'receipt', id: 'r2' },
      { kind: 'receipt', id: 'r1' },
      { kind: 'audit', id: 'a1' },
      { kind: 'lineage', id: 'a' },
    ];
    expect(deterministicallyOrderPanes(input)).toEqual([
      { kind: 'receipt', id: 'r1' },
      { kind: 'receipt', id: 'r2' },
      { kind: 'audit', id: 'a1' },
      { kind: 'lineage', id: 'a' },
      { kind: 'lineage', id: 'b' },
    ]);
  });

  it('is stable on equal inputs', () => {
    const a: PaneRef = { kind: 'audit', id: 'x' };
    const b: PaneRef = { kind: 'audit', id: 'x' };
    expect(deterministicallyOrderPanes([a, b])).toEqual([a, b]);
  });
});

describe('binding rationales · closed taxonomy', () => {
  it('lists six canonical rationales', () => {
    expect([...BINDING_RATIONALES]).toEqual([
      'signed_this_claim',
      'audit_row_consumed',
      'lineage_key_feed',
      'bound_subject',
      'continuity_witness',
      'rotation_co_sign',
    ]);
  });

  it('every rationale has copy', () => {
    for (const r of BINDING_RATIONALES) {
      expect(BINDING_RATIONALE_COPY[r]).toBeTruthy();
    }
  });
});

describe('ProvenancePaneHeader render', () => {
  it('renders category + title + close', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProvenancePaneHeader, {
        category: 'audit',
        title: 'evt_8821',
        captionSuffix: 'active',
        onClose: () => {},
      }),
    );
    expect(html).toContain('data-slot="provenance-pane-header"');
    expect(html).toContain('data-category="audit"');
    expect(html).toContain('evt_8821');
    expect(html).toContain('audit · active');
    expect(html).toContain('aria-label="Close pane"');
  });

  it('hides the close affordance when onClose is omitted', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProvenancePaneHeader, {
        category: 'receipt',
        title: 'rcpt_7a2c',
      }),
    );
    expect(html).not.toContain('aria-label="Close pane"');
  });
});

describe('ProvenancePaneMeta render', () => {
  it('renders the 2-col grid of entries', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProvenancePaneMeta, {
        entries: [
          { label: 'Run id', value: 'run_7a2c' },
          { label: 'checked_at', value: '2026-05-12T14:31:58Z' },
        ],
      }),
    );
    expect(html).toContain('data-slot="provenance-pane-meta"');
    expect(html).toContain('Run id');
    expect(html).toContain('run_7a2c');
    expect(html).toContain('checked_at');
  });
});

describe('ProvenanceChronology · reuses canonical LineageHeader', () => {
  it('renders the binding six-cell reading order', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProvenanceChronology, {
        state: 'signed',
        chronology: {
          object: { value: 'Receipt · 7a2c' },
          ownership: { value: 'Subject' },
          checkedAt: { value: '2026-05-12T14:31:58Z' },
          channel: { value: 'verify.vitalcv.health' },
          replay: { value: 'anchored' },
          runId: { value: 'run_7a2c' },
        },
      }),
    );
    expect(html).toContain('data-slot="lineage-header"');
    expect(html).toContain('data-state="signed"');
    // All six binding labels rendered
    expect(html).toContain('Object');
    expect(html).toContain('Ownership');
    expect(html).toContain('checked_at');
    expect(html).toContain('Channel');
    expect(html).toContain('Replay');
    expect(html).toContain('run_id');
  });
});

describe('ReplayRunStamp render', () => {
  it('renders run id + checked-at stamp (canonical CheckedAtStamp underneath)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReplayRunStamp, {
        runId: 'run_7a2c',
        checkedAtIso: '2026-05-12T14:31:58Z',
        checkedAtRelative: '10 s ago',
      }),
    );
    expect(html).toContain('data-slot="replay-run-stamp"');
    expect(html).toContain('run_7a2c');
    expect(html).toContain('2026-05-12T14:31:58Z');
    expect(html).toContain('10 s ago');
  });

  it('degraded variant adds dashed left border via CheckedAtStamp', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReplayRunStamp, {
        runId: 'run_7a2c',
        checkedAtIso: '2026-05-12T14:29:14Z',
        checkedAtRelative: '2 m 54 s ago · upstream degraded',
        degraded: true,
      }),
    );
    expect(html).toContain('data-degraded="true"');
    expect(html).toContain('border-dashed');
  });
});

describe('EntityBindingSummary render', () => {
  it('renders display name + tier + ownership + summary', () => {
    const html = renderToStaticMarkup(
      React.createElement(EntityBindingSummary, {
        displayName: 'Mira Chen, MD',
        subjectId: 'NPI 1356428912',
        ownership: 'subject',
        highestTier: 'T3',
        sourceSummary: '4 of 4 sources fresh',
      }),
    );
    expect(html).toContain('data-slot="entity-binding-summary"');
    expect(html).toContain('Mira Chen, MD');
    expect(html).toContain('NPI 1356428912');
    expect(html).toContain('data-tier="T3"');
    expect(html).toContain('data-ownership="subject"');
    expect(html).toContain('4 of 4 sources fresh');
  });
});

describe('ProvenanceTrail render (mocked navigation)', () => {
  it('renders the depth attributes + max-depth metadata', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProvenanceTrail, {
        rootPane: { kind: 'receipt', id: 'r1' },
        truncatedCount: 2,
      }),
    );
    expect(html).toContain('data-slot="provenance-trail"');
    expect(html).toContain(`data-max-depth="${MAX_PANE_DEPTH}"`);
    expect(html).toContain('data-slot="provenance-trail-truncation"');
    expect(html).toContain('… +2');
  });
});
