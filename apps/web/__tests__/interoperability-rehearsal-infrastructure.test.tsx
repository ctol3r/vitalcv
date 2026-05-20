import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import {
  REPLAY_ENVELOPE_ID_PREFIX,
  summarizeReplayBundle,
} from '@/lib/interoperability/replayBundleEnvelope';
import {
  describeExchangeReadiness,
  listExchangeReadinessStates,
  visualForExchangeReadiness,
} from '@/lib/interoperability/exchangeReadiness';
import {
  getDemoExchange,
  listDemoExchangeIds,
} from '@/lib/interoperability/demoExchanges';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/interoperability/exchange/demo',
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
}));

import { IndependentCrossCheckPanel } from '@/components/interoperability/IndependentCrossCheckPanel';
import { TrustExchangeTimeline } from '@/components/interoperability/TrustExchangeTimeline';
import { EvidenceReusePanel } from '@/components/interoperability/EvidenceReusePanel';

// ── Replay Bundle Envelope ────────────────────────────────────────────────

describe('replay bundle envelope', () => {
  it('declares the stable envelope id prefix', () => {
    expect(REPLAY_ENVELOPE_ID_PREFIX).toBe('env_replay_');
  });

  it('summarizeReplayBundle counts each evidence kind correctly', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    expect(cedar).not.toBeNull();
    if (!cedar) return;
    const summary = summarizeReplayBundle(cedar.envelope);
    expect(summary.evidenceCount).toBe(cedar.envelope.evidenceReferences.length);
    expect(summary.receiptCount).toBe(1);
    expect(summary.lineageCount).toBe(2);
    expect(summary.auditCount).toBe(1);
    expect(summary.claimCount).toBe(1);
  });
});

// ── Exchange Readiness Taxonomy ────────────────────────────────────────────

describe('exchange readiness taxonomy', () => {
  it('exposes exactly the 7 canonical states', () => {
    expect([...listExchangeReadinessStates()].sort()).toEqual(
      [
        'awaiting_review',
        'continuity_gap',
        'cross_check_available',
        'exchange_interrupted',
        'institution_confirmed',
        'operator_followup_required',
        'replay_generated',
      ].sort(),
    );
  });

  it('every state has a descriptor with headline + detail + degradation + owner', () => {
    for (const state of listExchangeReadinessStates()) {
      const d = describeExchangeReadiness(state);
      expect(d.headline.length).toBeGreaterThan(0);
      expect(d.detail.length).toBeGreaterThan(0);
      expect(d.degradation).toBeTruthy();
      expect(d.ownedBy).toMatch(
        /^(originating_institution|receiving_institution|vitalcv|shared)$/,
      );
      expect(typeof d.terminal).toBe('boolean');
    }
  });

  it('terminal states are institution_confirmed and exchange_interrupted', () => {
    const terminals = listExchangeReadinessStates().filter(
      (s) => describeExchangeReadiness(s).terminal,
    );
    expect(terminals.sort()).toEqual(
      ['exchange_interrupted', 'institution_confirmed'].sort(),
    );
  });

  it('reuses canonical degradation visuals (no new visual tokens)', () => {
    const allowed = new Set([
      'continuous',
      'dashed',
      'hard_interruption',
      'manual_lane',
      'pending_anchor',
    ]);
    for (const state of listExchangeReadinessStates()) {
      expect(allowed.has(visualForExchangeReadiness(state))).toBe(true);
    }
  });

  it('exchange_interrupted maps to hard_interruption visual', () => {
    expect(visualForExchangeReadiness('exchange_interrupted')).toBe(
      'hard_interruption',
    );
  });

  it('institution_confirmed never claims VitalCV-side acceptance in detail copy', () => {
    const d = describeExchangeReadiness('institution_confirmed');
    expect(d.detail.toLowerCase()).toContain('institution');
    expect(d.detail.toLowerCase()).toContain('not imply');
  });
});

// ── Demo Exchange Fixture ──────────────────────────────────────────────────

describe('demo exchange fixture', () => {
  it('exposes the Cedar Q2-2026 cohort by default', () => {
    expect(listDemoExchangeIds()).toContain('exch_cedar_q2_26_01');
  });

  it('returns null for unknown ids', () => {
    expect(getDemoExchange('does-not-exist')).toBeNull();
  });

  it('Cedar envelope is institutionally well-formed', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    expect(cedar).not.toBeNull();
    if (!cedar) return;
    expect(cedar.envelope.envelopeId).toMatch(/^env_replay_/);
    expect(cedar.envelope.originatingInstitution.role).toBe('cvo');
    expect(cedar.envelope.receivingInstitution.role).toBe('verifier');
    expect(cedar.envelope.scope.subjectNpi).toMatch(/^\d{10}$/);
    expect(cedar.envelope.crossCheckEligibility).toBe('eligible');
  });

  it('Cedar timeline contains continuity_interruption AND continuity_restored', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    if (!cedar) throw new Error('fixture missing');
    const kinds = cedar.timeline.map((e) => e.kind);
    expect(kinds).toContain('continuity_interruption');
    expect(kinds).toContain('continuity_restored');
  });

  it('Cedar cross-check lanes include one degraded (PECOS stale-but-signed)', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    if (!cedar) throw new Error('fixture missing');
    const pecos = cedar.crossCheckLanes.find((l) => l.laneId === 'pecos_enrollment');
    expect(pecos?.continuityStatus).toBe('degraded');
    expect(pecos?.gapNote).toBeTruthy();
  });
});

// ── Component render isolation ────────────────────────────────────────────

describe('IndependentCrossCheckPanel · render', () => {
  it('renders one row per lane with all canonical fields', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    if (!cedar) throw new Error('fixture missing');
    const html = renderToStaticMarkup(
      React.createElement(IndependentCrossCheckPanel, {
        lanes: cedar.crossCheckLanes,
      }),
    );
    expect(html).toContain('data-slot="independent-cross-check-panel"');
    for (const lane of cedar.crossCheckLanes) {
      expect(html).toContain(`data-lane-id="${lane.laneId}"`);
      expect(html).toContain(`data-continuity-status="${lane.continuityStatus}"`);
      expect(html).toContain(`data-institution-status="${lane.institutionStatus}"`);
    }
  });

  it('degraded lanes carry the dashed left border affordance', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    if (!cedar) throw new Error('fixture missing');
    const html = renderToStaticMarkup(
      React.createElement(IndependentCrossCheckPanel, {
        lanes: cedar.crossCheckLanes.filter(
          (l) => l.continuityStatus === 'degraded',
        ),
      }),
    );
    expect(html).toContain('border-l-amber-400');
  });
});

describe('TrustExchangeTimeline · render', () => {
  it('renders one row per timeline entry with the canonical kind label', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    if (!cedar) throw new Error('fixture missing');
    const html = renderToStaticMarkup(
      React.createElement(TrustExchangeTimeline, { entries: cedar.timeline }),
    );
    expect(html).toContain('data-slot="trust-exchange-timeline"');
    for (const entry of cedar.timeline) {
      expect(html).toContain(`data-kind="${entry.kind}"`);
      expect(html).toContain(entry.actor);
    }
  });

  it('continuity_interruption entries get the dashed amber border', () => {
    const entries = [
      {
        occurredAt: '2026-05-19T13:00:00Z',
        kind: 'continuity_interruption' as const,
        actor: 'Upstream',
        summary: 'Stale-but-signed.',
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(TrustExchangeTimeline, { entries }),
    );
    expect(html).toMatch(/border-dashed/);
    expect(html).toMatch(/amber-500/);
  });
});

describe('EvidenceReusePanel · render', () => {
  it('renders every reuse row with duplicate-avoided + basis + framing', () => {
    const cedar = getDemoExchange('exch_cedar_q2_26_01');
    if (!cedar) throw new Error('fixture missing');
    const html = renderToStaticMarkup(
      React.createElement(EvidenceReusePanel, { rows: cedar.evidenceReuse }),
    );
    expect(html).toContain('data-slot="evidence-reuse-panel"');
    for (const row of cedar.evidenceReuse) {
      expect(html).toContain(row.duplicateActivityAvoided);
      expect(html).toContain(row.basisReference);
    }
  });

  it('disclosure copy names institution ownership and rejects automation claims', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceReusePanel, { rows: [] }),
    );
    expect(html).toContain('not constitute automatic acceptance');
  });
});

// ── Truth-contract grep ────────────────────────────────────────────────────

describe('truth contract · interoperability surfaces', () => {
  const TOUCHED_FILES = [
    'apps/web/lib/interoperability/replayBundleEnvelope.ts',
    'apps/web/lib/interoperability/exchangeReadiness.ts',
    'apps/web/lib/interoperability/demoExchanges.ts',
    'apps/web/components/interoperability/IndependentCrossCheckPanel.tsx',
    'apps/web/components/interoperability/TrustExchangeTimeline.tsx',
    'apps/web/components/interoperability/EvidenceReusePanel.tsx',
    'apps/web/components/interoperability/ExportVerificationExchangeButton.tsx',
    'apps/web/app/interoperability/exchange/[exchangeId]/page.tsx',
  ];

  const BANNED = [
    'automatically verified',
    'guaranteed acceptance',
    'universally accepted',
    'fully verified',
    'instant verification',
    'automatic trust transfer',
    'federated by default',
    'production-ready federation',
    'trust transferred',
    'credential issued via vitalcv',
    'magical onboarding',
  ];

  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  it.each(TOUCHED_FILES)('%s contains no banned interoperability phrases', (rel) => {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    const lower = stripComments(src).toLowerCase();
    for (const banned of BANNED) {
      expect(lower.includes(banned), `should not contain "${banned}"`).toBe(false);
    }
  });

  it('boundaries doc declares the banned-phrase list verbatim', () => {
    const doc = fs.readFileSync(
      path.join(
        repoRoot,
        'docs/protocol/interoperability-rehearsal-boundaries.md',
      ),
      'utf8',
    );
    expect(doc).toMatch(/automatically verified/);
    expect(doc).toMatch(/guaranteed acceptance/);
    expect(doc).toMatch(/universally accepted/);
  });
});
