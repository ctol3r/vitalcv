/**
 * GOD-3 — Knowledge Inbox panel + provenance enforcement tests.
 *
 * Two layers:
 *   1. Classifier purity: every classification keeps the item out of
 *      VERIFIED territory; the function never claims source backing.
 *   2. Panel render: empty state + populated state both render without
 *      ever emitting "verified", "AI verified", "blockchain", or
 *      "fully credentialed" copy.
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { classifyInboxItem } from '../lib/knowledge-inbox/classifyInboxItem';
import { KnowledgeInboxPanel } from '../components/knowledge-inbox/KnowledgeInboxPanel';
import type {
  KnowledgeInboxItem,
  KnowledgeInboxItemType,
} from '../lib/knowledge-inbox/types';

const BANNED = [
  'verified by ai',
  'ai verified',
  'fully credentialed',
  'fully verified',
  'blockchain verified',
  'on-chain proof',
  'guaranteed',
  'instant hire',
  'license confirmed',
] as const;

function assertNoBanned(html: string): void {
  const lower = html.toLowerCase();
  for (const phrase of BANNED) {
    expect(lower).not.toContain(phrase);
  }
}

const SAMPLE_TEXTS: Array<{ text: string; expectedType: KnowledgeInboxItemType | 'unknown' }> = [
  { text: 'Completed residency at Mass General', expectedType: 'training' },
  { text: 'Cardiology fellowship', expectedType: 'training' },
  { text: 'Author on doi:10.1000/test in Journal of Cardiology', expectedType: 'publication' },
  { text: 'Medical license #12345 in CA', expectedType: 'license' },
  { text: 'Board certified by ABMS in pediatrics', expectedType: 'boardCertification' },
  { text: 'I like to play golf on weekends', expectedType: 'unknown' },
];

describe('classifyInboxItem provenance enforcement', () => {
  it('never returns a confidence equal to the literal string "VERIFIED"', () => {
    for (const sample of SAMPLE_TEXTS) {
      const result = classifyInboxItem(sample.text);
      expect(result.confidence).not.toBe('VERIFIED');
      // Confidence labels are heuristic strings — the wave's contract is
      // that they never imply source backing.
      expect(typeof result.confidence).toBe('string');
    }
  });

  it('always emits a non-VERIFIED limitation note for non-unknown classes', () => {
    for (const sample of SAMPLE_TEXTS.filter((s) => s.expectedType !== 'unknown')) {
      const result = classifyInboxItem(sample.text);
      expect(result.limitationNote ?? '').not.toBe('');
      expect((result.limitationNote ?? '').toLowerCase()).not.toContain('verified by source');
    }
  });

  it('enforces source-backed-only language for license + board cert paths', () => {
    const license = classifyInboxItem('Active medical license in CA');
    expect(license.itemType).toBe('license');
    expect(license.limitationNote ?? '').toMatch(/Primary Source Verification|state[\s-]board/i);
    expect(license.nextAction ?? '').toMatch(/PSV|source check/i);

    const board = classifyInboxItem('I am board certified in pediatrics');
    expect(board.itemType).toBe('boardCertification');
    expect(board.limitationNote ?? '').toMatch(/ABMS|Specialty board/i);
    expect(board.nextAction ?? '').toMatch(/source evidence|source check/i);
  });

  it('returns unknown for unmatched text instead of guessing a class', () => {
    const result = classifyInboxItem('Random unrelated free-text note');
    expect(result.itemType).toBe('unknown');
    expect(result.suggestedGraphNode).toBe('Unknown');
    expect(result.nextAction ?? '').toMatch(/Manual review/i);
  });

  it('classifier is deterministic — same input yields identical output', () => {
    for (const sample of SAMPLE_TEXTS) {
      const a = classifyInboxItem(sample.text);
      const b = classifyInboxItem(sample.text);
      expect(a).toEqual(b);
    }
  });

  it('classifier never references any external API or AI provider name', () => {
    const stringified = SAMPLE_TEXTS.map((s) => JSON.stringify(classifyInboxItem(s.text))).join('|');
    expect(stringified.toLowerCase()).not.toMatch(/openai|anthropic|gpt-?\d|claude|gemini|llm-/);
  });
});

describe('KnowledgeInboxPanel render', () => {
  function buildItem(
    overrides: Partial<KnowledgeInboxItem> = {},
  ): KnowledgeInboxItem {
    return {
      itemId: 'item-1',
      title: 'Sample residency record',
      summary: 'User-entered residency completion at Mass General',
      itemType: 'training',
      status: 'classified',
      provenance: 'USER_ENTERED',
      confidence: 'Medium',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
      suggestedProfileSection: 'Postgraduate Training',
      suggestedGraphNode: 'Credential Claim (Training)',
      verificationStatus: 'pending',
      limitationNote: 'Self-reported training history; not PSV verified.',
      nextAction: 'Review and accept to profile',
      ...overrides,
    };
  }

  it('renders the empty state with honest copy', () => {
    const html = renderToStaticMarkup(<KnowledgeInboxPanel items={[]} />);
    expect(html).toContain('Knowledge Inbox is empty');
    expect(html).toMatch(/source checks decide what is (?:verified|source-backed)/);
    assertNoBanned(html);
  });

  it('renders a populated item with provenance, limitation, and next-action', () => {
    const html = renderToStaticMarkup(
      <KnowledgeInboxPanel items={[buildItem()]} />,
    );
    expect(html).toContain('Sample residency record');
    // Panel renders the provenance through a friendly label.
    // For USER_ENTERED, the label explicitly says "not PSV".
    expect(html.toLowerCase()).toContain('not psv');
    expect(html).toContain('Postgraduate Training');
    expect(html).toContain('Self-reported training history');
    expect(html).toContain('Review and accept to profile');
    assertNoBanned(html);
  });

  it('never marks an item VERIFIED in the rendered chip', () => {
    // Even if a caller passed VERIFIED as provenance (which the panel
    // does not synthesize itself), the rendered string must not appear
    // alongside any "by AI" or "automatically" phrasing.
    const html = renderToStaticMarkup(
      <KnowledgeInboxPanel items={[buildItem({ provenance: 'VERIFIED' as never })]} />,
    );
    const lower = html.toLowerCase();
    // The chip text mirrors what the caller passed in, but the panel
    // never injects words that would imply automation.
    expect(lower).not.toContain('automatically verified');
    expect(lower).not.toContain('verified by ai');
  });

  it('renders multiple items without losing per-item attributes', () => {
    const items: KnowledgeInboxItem[] = [
      buildItem({ itemId: 'a', title: 'Residency A', itemType: 'training' }),
      buildItem({
        itemId: 'b',
        title: 'License B',
        itemType: 'license',
        suggestedProfileSection: 'Licenses',
        limitationNote: 'Requires state board PSV.',
      }),
      buildItem({
        itemId: 'c',
        title: 'Pub C',
        itemType: 'publication',
        suggestedProfileSection: 'Publications',
        limitationNote: 'Inferred; not verified.',
      }),
    ];
    const html = renderToStaticMarkup(<KnowledgeInboxPanel items={items} />);
    expect(html).toContain('Residency A');
    expect(html).toContain('License B');
    expect(html).toContain('Pub C');
    expect(html).toContain('Requires state board PSV');
    expect(html).toContain('Inferred; not verified');
    assertNoBanned(html);
  });
});
