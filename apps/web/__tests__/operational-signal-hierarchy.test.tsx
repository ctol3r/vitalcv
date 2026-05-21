import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import {
  PrimaryOperationalSignal,
  PRIMARY_SIGNAL_LABEL,
  AttentionRequiredPanel,
  QuietStatusStrip,
  ProgressiveTechnicalDisclosure,
  InstitutionalPrimaryAction,
  PRIMARY_ACTION_LABELS,
} from '@/components/signals';
import { composeOperationalSignal } from '@/lib/signals/composeOperationalSignal';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ── Primitive render isolation ────────────────────────────────────────────

describe('PrimaryOperationalSignal · label mapping', () => {
  it.each([
    ['confirmed', 'Confirmed'],
    ['pending', 'Pending'],
    ['attention_needed', 'Attention needed'],
    ['recently_reviewed', 'Recently reviewed'],
    ['requires_followup', 'Requires follow-up'],
  ] as const)('state %s renders user-facing label "%s"', (state, label) => {
    const html = renderToStaticMarkup(
      React.createElement(PrimaryOperationalSignal, {
        state,
        headline: 'Headline',
        summary: 'Summary',
      }),
    );
    expect(html).toContain('data-slot="primary-operational-signal"');
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain(label);
    expect(html).toContain('Headline');
    expect(html).toContain('Summary');
  });

  it('every PRIMARY_SIGNAL_LABEL entry is one of the five binding labels', () => {
    const ALLOWED = new Set([
      'Confirmed',
      'Pending',
      'Attention needed',
      'Recently reviewed',
      'Requires follow-up',
    ]);
    for (const label of Object.values(PRIMARY_SIGNAL_LABEL)) {
      expect(ALLOWED.has(label), `unexpected label "${label}"`).toBe(true);
    }
  });
});

describe('AttentionRequiredPanel · render', () => {
  it('renders one row per item with what + next step', () => {
    const html = renderToStaticMarkup(
      React.createElement(AttentionRequiredPanel, {
        items: [
          { id: 'a', what: 'Source unreachable', nextStep: 'Re-fetch on operator credential' },
          { id: 'b', what: 'Stale-but-signed', nextStep: 'Disposition on next window' },
        ],
      }),
    );
    expect(html).toContain('data-slot="attention-required-panel"');
    expect(html).toContain('data-item-count="2"');
    expect(html).toContain('Source unreachable');
    expect(html).toContain('Re-fetch on operator credential');
    expect(html).toContain('Stale-but-signed');
  });

  it('renders nothing when items is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(AttentionRequiredPanel, { items: [] }),
    );
    expect(html).toBe('');
  });
});

describe('QuietStatusStrip · render', () => {
  it('renders one entry per axis with the user-facing label', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuietStatusStrip, {
        entries: [
          { id: 'identity', axis: 'Identity', state: 'confirmed' },
          { id: 'sources', axis: 'Source health', state: 'requires_followup' },
        ],
      }),
    );
    expect(html).toContain('data-slot="quiet-status-strip"');
    expect(html).toContain('Identity');
    expect(html).toContain('Confirmed');
    expect(html).toContain('Source health');
    expect(html).toContain('Requires follow-up');
  });

  it('renders nothing when entries is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(QuietStatusStrip, { entries: [] }),
    );
    expect(html).toBe('');
  });
});

describe('ProgressiveTechnicalDisclosure · render', () => {
  it('is collapsed by default and uses a plain-English summary', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ProgressiveTechnicalDisclosure,
        { summaryLabel: 'Show technical detail' },
        React.createElement('div', null, 'inner detail here'),
      ),
    );
    expect(html).toContain('data-slot="progressive-technical-disclosure"');
    expect(html).toContain('Show technical detail');
    expect(html).not.toMatch(/<details[^>]*\sopen[^>]*>/);
    expect(html).toContain('inner detail here');
  });

  it('honors defaultOpen=true', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ProgressiveTechnicalDisclosure,
        { defaultOpen: true },
        React.createElement('div', null, 'detail'),
      ),
    );
    expect(html).toMatch(/<details[^>]*\sopen[^>]*>/);
  });
});

describe('InstitutionalPrimaryAction · render', () => {
  it('renders the action label + context', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalPrimaryAction, {
        label: 'Review readiness',
        href: '/holder/readiness',
        context: 'Open your readiness surface',
      }),
    );
    expect(html).toContain('data-slot="institutional-primary-action"');
    expect(html).toContain('data-action-label="Review readiness"');
    expect(html).toContain('href="/holder/readiness"');
    expect(html).toContain('Open your readiness surface');
  });

  it('PRIMARY_ACTION_LABELS contains exactly five binding labels', () => {
    expect(PRIMARY_ACTION_LABELS.length).toBe(5);
    for (const label of [
      'Review readiness',
      'Share continuity',
      'Continue onboarding',
      'Acknowledge review',
      'Open operator detail',
    ]) {
      expect(PRIMARY_ACTION_LABELS).toContain(label);
    }
  });
});

// ── Compositor ────────────────────────────────────────────────────────────

describe('composeOperationalSignal', () => {
  it('healthy substrate emits "confirmed"', () => {
    const result = composeOperationalSignal({
      criticalAlerts: 0,
      warningAlerts: 0,
      doctrineHonestyScore: 7,
      doctrineHonestyTotal: 7,
      degradedTotal: 0,
      verifierContinuityOperational: true,
      issuanceComplete: true,
      identityResolves: true,
    });
    expect(result.state).toBe('confirmed');
    expect(result.attentionItems.length).toBe(0);
    expect(result.stripEntries.length).toBe(6);
  });

  it('any critical alert escalates to "attention_needed"', () => {
    const result = composeOperationalSignal({
      criticalAlerts: 1,
      warningAlerts: 0,
      doctrineHonestyScore: 7,
      doctrineHonestyTotal: 7,
      degradedTotal: 0,
      verifierContinuityOperational: true,
      issuanceComplete: true,
      identityResolves: true,
    });
    expect(result.state).toBe('attention_needed');
    expect(result.attentionItems.length).toBe(1);
  });

  it('warnings without criticals -> "requires_followup"', () => {
    const result = composeOperationalSignal({
      criticalAlerts: 0,
      warningAlerts: 2,
      doctrineHonestyScore: 7,
      doctrineHonestyTotal: 7,
      degradedTotal: 0,
      verifierContinuityOperational: true,
      issuanceComplete: true,
      identityResolves: true,
    });
    expect(result.state).toBe('requires_followup');
  });

  it('degraded sources -> "requires_followup"', () => {
    const result = composeOperationalSignal({
      criticalAlerts: 0,
      warningAlerts: 0,
      doctrineHonestyScore: 7,
      doctrineHonestyTotal: 7,
      degradedTotal: 3,
      verifierContinuityOperational: true,
      issuanceComplete: true,
      identityResolves: true,
    });
    expect(result.state).toBe('requires_followup');
  });

  it('honesty < total -> "requires_followup"', () => {
    const result = composeOperationalSignal({
      criticalAlerts: 0,
      warningAlerts: 0,
      doctrineHonestyScore: 5,
      doctrineHonestyTotal: 7,
      degradedTotal: 0,
      verifierContinuityOperational: true,
      issuanceComplete: true,
      identityResolves: true,
    });
    expect(result.state).toBe('requires_followup');
  });

  it('unresolved identity -> "pending"', () => {
    const result = composeOperationalSignal({
      criticalAlerts: 0,
      warningAlerts: 0,
      doctrineHonestyScore: 7,
      doctrineHonestyTotal: 7,
      degradedTotal: 0,
      verifierContinuityOperational: true,
      issuanceComplete: true,
      identityResolves: false,
    });
    expect(result.state).toBe('pending');
  });
});

// ── Signal-integrity invariants on the modified routes ──────────────────

describe('signal-integrity · /ops route', () => {
  const src = read('apps/web/app/ops/page.tsx');

  it('imports PrimaryOperationalSignal and InstitutionalPrimaryAction', () => {
    expect(src).toMatch(/PrimaryOperationalSignal/);
    expect(src).toMatch(/InstitutionalPrimaryAction/);
    expect(src).toMatch(/ProgressiveTechnicalDisclosure/);
  });

  it('renders exactly one PrimaryOperationalSignal', () => {
    const matches = src.match(/<PrimaryOperationalSignal[\s>]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('renders at most one InstitutionalPrimaryAction', () => {
    const matches = src.match(/<InstitutionalPrimaryAction[\s>]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('uses a binding primary-action label', () => {
    const m = src.match(/label="(Review readiness|Share continuity|Continue onboarding|Acknowledge review|Open operator detail)"/);
    expect(m).not.toBeNull();
  });
});

describe('signal-integrity · /holder route', () => {
  const src = read('apps/web/app/holder/page.tsx');

  it('imports PrimaryOperationalSignal and InstitutionalPrimaryAction', () => {
    expect(src).toMatch(/PrimaryOperationalSignal/);
    expect(src).toMatch(/InstitutionalPrimaryAction/);
    expect(src).toMatch(/ProgressiveTechnicalDisclosure/);
  });

  it('renders exactly one InstitutionalPrimaryAction in the has_npi branch', () => {
    const matches = src.match(/<InstitutionalPrimaryAction[\s>]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('uses Review readiness as the primary action label', () => {
    expect(src).toMatch(/label="Review readiness"/);
  });

  it('wraps detail surfaces inside a ProgressiveTechnicalDisclosure', () => {
    expect(src).toMatch(/<ProgressiveTechnicalDisclosure/);
  });
});

// ── Truth contract · infrastructure-native jargon containment ─────────────

describe('truth contract · signals primitives and routes', () => {
  function stripCommentsAndDataAttrs(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  // Files where infrastructure-native jargon is forbidden on the primary surface.
  const TOUCHED_PRIMARY_SURFACE_FILES = [
    'apps/web/components/signals/PrimaryOperationalSignal.tsx',
    'apps/web/components/signals/AttentionRequiredPanel.tsx',
    'apps/web/components/signals/QuietStatusStrip.tsx',
    'apps/web/components/signals/InstitutionalPrimaryAction.tsx',
  ];

  // Forbidden on the PRIMARY surface only. Allowed inside the
  // ProgressiveTechnicalDisclosure (which is in /ops/page.tsx as a
  // server-side wrapper, where the substrate jargon IS allowed).
  const FORBIDDEN_PRIMARY_TOKENS = [
    'survivabilityScore',
    'survivability score',
    'degradationOwnership',
    'lineageKey',
    'replay chronology',
    'issuer continuity',
    'dedupeKey',
    'jwks',
    'kid:',
    'did:web',
    'actor_id',
    'σ ok',
    'σ defer',
  ];

  it.each(TOUCHED_PRIMARY_SURFACE_FILES)(
    '%s carries no infrastructure-native jargon outside comments',
    (rel) => {
      const src = read(rel);
      const lower = stripCommentsAndDataAttrs(src).toLowerCase();
      for (const token of FORBIDDEN_PRIMARY_TOKENS) {
        expect(
          lower.includes(token.toLowerCase()),
          `should not contain "${token}"`,
        ).toBe(false);
      }
    },
  );

  it('design audit doc enumerates the five user-facing labels', () => {
    const md = read('docs/design/operational-signal-hierarchy.md');
    for (const label of [
      'Confirmed',
      'Pending',
      'Attention needed',
      'Recently reviewed',
      'Requires follow-up',
    ]) {
      expect(md).toContain(label);
    }
  });

  it('design audit doc enumerates the five binding primary-action labels', () => {
    const md = read('docs/design/operational-signal-hierarchy.md');
    for (const label of [
      'Review readiness',
      'Share continuity',
      'Continue onboarding',
      'Acknowledge review',
      'Open operator detail',
    ]) {
      expect(md).toContain(label);
    }
  });

  it('design audit doc declares the no-equal-weight-grid rule', () => {
    const md = read('docs/design/operational-signal-hierarchy.md');
    expect(md).toMatch(/equal-weight panel grids/i);
    expect(md).toMatch(/forbidden as the primary visual element/i);
  });

  it('design audit doc declares the technical-disclosure-only rule for substrate jargon', () => {
    const md = read('docs/design/operational-signal-hierarchy.md');
    expect(md).toMatch(/ProgressiveTechnicalDisclosure/i);
    expect(md).toMatch(/only allowed home/i);
  });
});
