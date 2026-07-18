/**
 * source-check-narration.test.tsx — W2 shared narration primitive.
 *
 * Guards the consolidated "watched it work" resolving view:
 *   - the "Reading primary sources" eyebrow (also an e2e contract) + every step,
 *   - no looping spinner (W0 motion doctrine: reveal, don't perform),
 *   - the running check renders as an honest `pending` ProvenanceChip — never a
 *     `checked` result claimed before the data lands,
 *   - full completion marks every row read.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  SourceCheckNarration,
  CHECK_SEQUENCE,
} from '@/components/readiness/sourceCheckNarration';

describe('SourceCheckNarration', () => {
  it('renders the "Reading primary sources" eyebrow and every step', () => {
    const html = renderToStaticMarkup(<SourceCheckNarration step={0} />);
    expect(html).toContain('Reading primary sources');
    for (const label of CHECK_SEQUENCE) expect(html).toContain(label);
  });

  it('never uses a looping spinner (motion doctrine)', () => {
    for (const step of [0, 1, 2, CHECK_SEQUENCE.length]) {
      const html = renderToStaticMarkup(<SourceCheckNarration step={step} />);
      expect(html).not.toContain('animate-spin');
    }
  });

  it('shows the running row as a pending ProvenanceChip, later rows queued', () => {
    const html = renderToStaticMarkup(<SourceCheckNarration step={0} />);
    expect(html).toContain('data-check-row="running"');
    expect(html).toContain('data-provenance-state="pending"');
    expect(html).toContain('data-check-row="queued"');
  });

  it('never claims a checked result during resolving', () => {
    const html = renderToStaticMarkup(<SourceCheckNarration step={2} />);
    expect(html).not.toContain('data-provenance-state="checked"');
  });

  it('marks every row read once the sequence completes', () => {
    const html = renderToStaticMarkup(
      <SourceCheckNarration step={CHECK_SEQUENCE.length} />,
    );
    const readCount = (html.match(/data-check-row="read"/g) ?? []).length;
    expect(readCount).toBe(CHECK_SEQUENCE.length);
    expect(html).not.toContain('data-check-row="running"');
  });

  it('renders trailing content (e.g. the skeleton preview)', () => {
    const html = renderToStaticMarkup(
      <SourceCheckNarration step={0} trailing={<div>SKELETON_MARKER</div>} />,
    );
    expect(html).toContain('SKELETON_MARKER');
  });
});
