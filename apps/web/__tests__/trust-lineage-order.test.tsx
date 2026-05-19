/**
 * trust-lineage-order.test.tsx
 *
 * Asserts the binding reading order from the design canon:
 *
 *   Object → Ownership → checked_at → Channel → Replay → run_id
 *
 * Two layers of guarantee:
 *   1. The exported LINEAGE_READING_ORDER constant matches the
 *      expected literal — so renderers that iterate it can't drift.
 *   2. The LineageHeader renders cells in that exact DOM order —
 *      verified via the `data-cell` attribute the component emits.
 *
 * Also confirms OwnershipBadge renders subject / delegated / unbound
 * distinctly.
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { LineageHeader } from '@/components/trust/LineageHeader';
import { OwnershipBadge } from '@/components/trust/primitives';
import {
  LINEAGE_READING_ORDER,
  type Lineage,
} from '@/lib/trust/types';

const FIXTURE: Lineage = {
  state: 'snapshot',
  object: 'Demo · trust-lineage-order test (DEMO)',
  objectSub: 'fixture only',
  ownership: 'delegated',
  checkedAtIso: '2026-05-18T13:59:30.000Z',
  checkedAgo: '30 seconds ago',
  channel: 'test.local.demo',
  replay: 'anchored',
  runId: 'run_v1_test-abc123',
};

describe('LINEAGE_READING_ORDER constant', () => {
  it('is the canonical reading order', () => {
    expect([...LINEAGE_READING_ORDER]).toEqual([
      'object',
      'ownership',
      'checkedAt',
      'channel',
      'replay',
      'runId',
    ]);
  });
});

describe('LineageHeader DOM order', () => {
  it('renders lineage cells in Object → Ownership → checked_at → Channel → Replay → run_id', () => {
    const html = renderToStaticMarkup(<LineageHeader lineage={FIXTURE} />);

    // Extract every data-cell value in the order they appear in markup.
    const re = /data-cell="([a-zA-Z]+)"/g;
    const seen: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      seen.push(match[1]);
    }

    expect(seen).toEqual([
      'object',
      'ownership',
      'checkedAt',
      'channel',
      'replay',
      'runId',
    ]);
  });

  it('emits per-cell data-testid for each lineage cell', () => {
    const html = renderToStaticMarkup(<LineageHeader lineage={FIXTURE} />);
    for (const id of LINEAGE_READING_ORDER) {
      expect(html).toContain(`data-testid="trust-lineage-cell-${id}"`);
    }
  });
});

describe('OwnershipBadge distinct rendering', () => {
  it('renders subject / delegated / unbound with distinct data-ownership values', () => {
    const subject = renderToStaticMarkup(<OwnershipBadge state="subject" />);
    const delegated = renderToStaticMarkup(<OwnershipBadge state="delegated" />);
    const unbound = renderToStaticMarkup(<OwnershipBadge state="unbound" />);

    expect(subject).toContain('data-ownership="subject"');
    expect(delegated).toContain('data-ownership="delegated"');
    expect(unbound).toContain('data-ownership="unbound"');

    // The three renderings must be distinct strings.
    expect(new Set([subject, delegated, unbound]).size).toBe(3);
  });

  it('never renders the bare word "Verified" — not in this scope', () => {
    const subject = renderToStaticMarkup(<OwnershipBadge state="subject" />);
    expect(subject).not.toMatch(/['"`]Verified['"`]/);
    expect(subject).not.toMatch(/>\s*Verified\s*</);
  });
});
