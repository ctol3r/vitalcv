import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PANE_KINDS,
  PANE_STACK_OFFSET_PX,
  closePaneAt,
  parsePanes,
  paneToken,
  pushPane,
  serializePanes,
  type PaneRef,
} from '@/lib/trust/panes';

// `LineageBacklinks` and `StackedPaneLayout` consume next/navigation
// hooks via `usePaneStack`. In a static-render harness we mock them so
// component output is rendered without an app-router context. The
// mocks emulate a stable, empty search-param snapshot.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/trust/panes/rec-test',
  useSearchParams: () => ({
    get: () => null,
    toString: () => '',
  }),
}));

import {
  LineageBacklinks,
  type LineageBacklinkEntry,
} from '@/components/trust/LineageBacklinks';

// `StackedPaneLayout` uses `useSearchParams` and `useRouter`, which
// require a Next.js navigation context. We test it indirectly via the
// pure URL helpers and via static markup of the backlinks component
// (which only mounts a `useStackedPanes()` hook for its onClick).

describe('panes URL contract', () => {
  it('exposes the five canonical pane kinds', () => {
    expect([...PANE_KINDS]).toEqual([
      'receipt',
      'audit',
      'claim',
      'lineage',
      'entity',
    ]);
  });

  it('parses a well-formed panes string', () => {
    const panes = parsePanes('receipt-7a2cb8d3,audit-evt_8821,lineage-nppes');
    expect(panes).toEqual([
      { kind: 'receipt', id: '7a2cb8d3' },
      { kind: 'audit', id: 'evt_8821' },
      { kind: 'lineage', id: 'nppes' },
    ]);
  });

  it('round-trips through serialize/parse', () => {
    const original: PaneRef[] = [
      { kind: 'receipt', id: 'r1' },
      { kind: 'claim', id: 'c1' },
      { kind: 'entity', id: 'npi_1356428912' },
    ];
    expect(parsePanes(serializePanes(original))).toEqual(original);
  });

  it('drops unknown pane kinds silently', () => {
    expect(parsePanes('receipt-r1,bogus-x,audit-a1')).toEqual([
      { kind: 'receipt', id: 'r1' },
      { kind: 'audit', id: 'a1' },
    ]);
  });

  it('drops malformed pane ids', () => {
    expect(parsePanes('receipt-,receipt-r1,receipt-with space')).toEqual([
      { kind: 'receipt', id: 'r1' },
    ]);
  });

  it('drops tokens with no kind separator', () => {
    expect(parsePanes('receipt7a2c,audit-evt')).toEqual([
      { kind: 'audit', id: 'evt' },
    ]);
  });

  it('serializes a pane token canonically', () => {
    expect(paneToken({ kind: 'receipt', id: '7a2c' })).toBe('receipt-7a2c');
  });

  it('handles empty / nullish input as empty stack', () => {
    expect(parsePanes(null)).toEqual([]);
    expect(parsePanes(undefined)).toEqual([]);
    expect(parsePanes('')).toEqual([]);
    expect(serializePanes([])).toBe('');
  });
});

describe('pushPane · Matuschak tree-path behavior', () => {
  const stack: PaneRef[] = [
    { kind: 'receipt', id: 'r1' },
    { kind: 'claim', id: 'c1' },
    { kind: 'audit', id: 'a1' },
  ];

  it('opening a child from the rightmost pane appends', () => {
    expect(pushPane(stack, 2, { kind: 'lineage', id: 'lk1' })).toEqual([
      ...stack,
      { kind: 'lineage', id: 'lk1' },
    ]);
  });

  it('opening a child from a middle pane truncates panes to the right and appends', () => {
    expect(pushPane(stack, 0, { kind: 'audit', id: 'a2' })).toEqual([
      { kind: 'receipt', id: 'r1' },
      { kind: 'audit', id: 'a2' },
    ]);
  });

  it('re-clicking the same destination is a no-op (idempotent)', () => {
    expect(pushPane(stack, 2, { kind: 'audit', id: 'a1' })).toEqual(stack);
  });
});

describe('closePaneAt', () => {
  const stack: PaneRef[] = [
    { kind: 'receipt', id: 'r1' },
    { kind: 'claim', id: 'c1' },
    { kind: 'audit', id: 'a1' },
  ];

  it('removes the pane at index and every pane to its right', () => {
    expect(closePaneAt(stack, 1)).toEqual([{ kind: 'receipt', id: 'r1' }]);
  });

  it('closing at index 0 empties the stack', () => {
    expect(closePaneAt(stack, 0)).toEqual([]);
  });

  it('out-of-range close returns the stack unchanged', () => {
    expect(closePaneAt(stack, 9)).toBe(stack);
    expect(closePaneAt(stack, -1)).toBe(stack);
  });
});

describe('visual constants', () => {
  it('pane stack offset is the binding 40px from the design archive', () => {
    expect(PANE_STACK_OFFSET_PX).toBe(40);
  });
});

describe('LineageBacklinks · static render', () => {
  it('renders an empty-state hint when no backlinks resolve', () => {
    const html = renderToStaticMarkup(
      React.createElement(LineageBacklinks, { links: [] }),
    );
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('No artifacts bind to this pane.');
  });

  it('renders each backlink with kind chip + label + rationale', () => {
    const links: LineageBacklinkEntry[] = [
      {
        ref: { kind: 'receipt', id: 'rcpt_7a2c' },
        label: 'rcpt_7a2c',
        rationale: 'signed this claim',
      },
      {
        ref: { kind: 'entity', id: 'npi_1356428912' },
        label: 'entity · npi_1356428912',
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(LineageBacklinks, { links }),
    );
    expect(html).toContain('data-target-kind="receipt"');
    expect(html).toContain('data-target-id="rcpt_7a2c"');
    expect(html).toContain('signed this claim');
    expect(html).toContain('data-target-kind="entity"');
    expect(html).toContain('npi_1356428912');
  });
});
