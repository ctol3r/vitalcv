import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  LINEAGE_SLOT_ORDER,
  composeLineage,
  READING_ORDER_CAPTION,
  type LineageSlots,
} from '@/lib/trust/replay-grammar';
import {
  describeFailureMode,
  describeDegradation,
  visualForDegradation,
  allFailureModes,
  type DegradationState,
  type FailureMode,
} from '@/lib/trust/degradation';
import {
  BANNED_INSTITUTIONAL_PHRASES,
  INSTITUTIONAL_PHRASES,
  OWNERSHIP_LABELS,
  TIER_LABELS,
  findBannedInstitutionalPhrases,
  READING_ORDER_LABELS,
} from '@/lib/trust/institutional-language';
import {
  LineageHeader,
  LineageRow,
  ReplayTimeline,
  DegradedStatePanel,
  FailureTaxonomyBadge,
  OwnershipStateBadge,
  TierBadge,
  CheckedAtStamp,
  HumanReviewLane,
  RevocationStateBanner,
} from '@/components/trust/primitives';

function buildSampleLineage(): LineageSlots {
  return composeLineage({
    object: { label: 'Object', value: 'Provider passport · NPI 1356428912' },
    ownership: { label: 'Ownership', value: 'Subject' },
    checkedAt: {
      label: 'checked_at',
      value: '2026-05-12T14:31:58Z',
      subLabel: '10 s ago',
    },
    channel: { label: 'Channel', value: 'verify.vitalcv.health' },
    replay: { label: 'Replay', value: 'anchored' },
    runId: { label: 'run_id', value: '7a2c…b8d3', subLabel: 'batch · committed' },
  });
}

describe('replay grammar · reading-order contract', () => {
  it('binds OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID', () => {
    expect(LINEAGE_SLOT_ORDER).toEqual([
      'object',
      'ownership',
      'checkedAt',
      'channel',
      'replay',
      'runId',
    ]);
  });

  it('composes a lineage in canonical order regardless of input order', () => {
    const slots = composeLineage({
      runId: { label: 'run_id', value: 'r' },
      replay: { label: 'Replay', value: 'r' },
      channel: { label: 'Channel', value: 'c' },
      checkedAt: { label: 'checked_at', value: 't' },
      ownership: { label: 'Ownership', value: 'o' },
      object: { label: 'Object', value: 'x' },
    });
    expect(slots.map((s) => s.key)).toEqual([
      'object',
      'ownership',
      'checkedAt',
      'channel',
      'replay',
      'runId',
    ]);
  });

  it('caption rail uses the binding string', () => {
    expect(READING_ORDER_CAPTION).toBe(
      'object → ownership → checked_at → channel → replay → run_id',
    );
  });
});

describe('failure taxonomy · five non-confusable modes', () => {
  it.each<FailureMode>(['A', 'B', 'C', 'D', 'E'])(
    'mode %s has owner + cause + action + plane + severity',
    (mode) => {
      const d = describeFailureMode(mode);
      expect(d.mode).toBe(mode);
      expect(d.owner.length).toBeGreaterThan(0);
      expect(d.cause.length).toBeGreaterThan(0);
      expect(d.action.length).toBeGreaterThan(0);
      expect(d.plane).toMatch(/^(upstream|policy|verifier|subject|issuer)$/);
      expect(d.severity).toMatch(/^S[0-4]$/);
    },
  );

  it('mode D is the only success', () => {
    expect(describeFailureMode('D').isSuccess).toBe(true);
    expect(describeFailureMode('A').isSuccess).toBe(false);
    expect(describeFailureMode('B').isSuccess).toBe(false);
    expect(describeFailureMode('C').isSuccess).toBe(false);
    expect(describeFailureMode('E').isSuccess).toBe(false);
  });

  it('mode D copy is "no adverse findings", never bare "no findings"', () => {
    const d = describeFailureMode('D');
    expect(d.title.toLowerCase()).toBe('no adverse findings');
  });

  it('every plane is owned by exactly one mode for S1–S4 distinctness', () => {
    const planes = allFailureModes().map((d) => d.plane);
    expect(new Set(planes).size).toBe(planes.length);
  });
});

describe('degradation grammar · visual non-alarmist semantics', () => {
  const states: DegradationState[] = [
    'fresh',
    'degraded',
    'stale',
    'revoked',
    'interrupted',
    'pending_human_review',
    'unverifiable',
    'continuity_mismatch',
  ];

  it.each(states)('state %s renders non-alarmist copy', (state) => {
    const copy = describeDegradation(state);
    expect(copy.alarmist).toBe(false);
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(copy.detail.length).toBeGreaterThan(0);
  });

  it('maps each state to a visual-grammar token', () => {
    expect(visualForDegradation('fresh')).toBe('continuous');
    expect(visualForDegradation('degraded')).toBe('dashed');
    expect(visualForDegradation('stale')).toBe('dashed');
    expect(visualForDegradation('revoked')).toBe('hard_interruption');
    expect(visualForDegradation('interrupted')).toBe('hard_interruption');
    expect(visualForDegradation('pending_human_review')).toBe('manual_lane');
    expect(visualForDegradation('unverifiable')).toBe('dashed');
    expect(visualForDegradation('continuity_mismatch')).toBe(
      'hard_interruption',
    );
  });
});

describe('canonical operational language', () => {
  it('exposes phrase constants', () => {
    expect(INSTITUTIONAL_PHRASES.institutionOwned).toBe(
      'Institution-owned workflow',
    );
    expect(INSTITUTIONAL_PHRASES.affirmativeNegative).toBe(
      'No adverse findings',
    );
  });

  it('reading-order labels match the canonical primitives §00 spec', () => {
    expect(READING_ORDER_LABELS).toEqual({
      object: 'Object',
      ownership: 'Ownership',
      checkedAt: 'checked_at',
      channel: 'Channel',
      replay: 'Replay',
      runId: 'run_id',
    });
  });

  it('ownership labels are the three fixed values; "anonymous" and "guest" are absent', () => {
    expect(Object.keys(OWNERSHIP_LABELS).sort()).toEqual([
      'delegated',
      'subject',
      'unbound',
    ]);
    expect(Object.values(OWNERSHIP_LABELS).join(' ').toLowerCase()).not.toMatch(
      /anonymous|guest/,
    );
  });

  it('tier labels are the four fixed values; T5 is absent', () => {
    expect(Object.keys(TIER_LABELS).sort()).toEqual(['T1', 'T2', 'T3', 'T4']);
  });

  it('clean copy passes the banned-phrase guard', () => {
    expect(
      findBannedInstitutionalPhrases('Source-confirmed at checked_at.'),
    ).toEqual([]);
  });

  it('banned phrase guard flags every banned token', () => {
    for (const token of BANNED_INSTITUTIONAL_PHRASES) {
      const hits = findBannedInstitutionalPhrases(
        `prefix ${token} suffix · institutional`,
      );
      expect(hits).toContain(token);
    }
  });
});

describe('primitive render isolation · server-renderable, no globals', () => {
  it('LineageHeader renders the six-cell reading order', () => {
    const html = renderToStaticMarkup(
      React.createElement(LineageHeader, {
        slots: buildSampleLineage(),
        state: 'signed',
      }),
    );
    expect(html).toContain('data-slot="lineage-header"');
    expect(html).toContain('data-state="signed"');
    for (const slotKey of LINEAGE_SLOT_ORDER) {
      expect(html).toContain(READING_ORDER_LABELS[slotKey]);
    }
  });

  it('LineageRow encodes all six row primitives + tier + signed', () => {
    const html = renderToStaticMarkup(
      React.createElement(LineageRow, {
        claim: 'CA medical license',
        subject: 'subj · npi 1356428912',
        source: 'CA Medical Board',
        sourceState: 'live · ca-pa registry',
        checkedAtIso: '2026-05-12T14:31:58Z',
        checkedAtRelative: '10 s ago',
        ownership: 'subject',
        replay: 'Anchored',
        tier: 'T3',
        signed: true,
        runId: '7a2c…b8d3',
        rowState: 'signed',
      }),
    );
    expect(html).toContain('CA medical license');
    expect(html).toContain('data-slot="lineage-row"');
    expect(html).toContain('data-slot="ownership-badge"');
    expect(html).toContain('data-slot="tier-badge"');
    expect(html).toContain('data-tier="T3"');
    expect(html).toContain('Signed · ed25519');
  });

  it('DegradedStatePanel renders mode + plane + owner + action', () => {
    const html = renderToStaticMarkup(
      React.createElement(DegradedStatePanel, {
        mode: 'A',
        incidentId: 'pecos-p95-5.8s',
      }),
    );
    expect(html).toContain('data-slot="degraded-state-panel"');
    expect(html).toContain('data-mode="A"');
    expect(html).toContain('Source unreachable');
    expect(html).toContain('Upstream registry');
  });

  it('Mode D panel marks itself as success', () => {
    const html = renderToStaticMarkup(
      React.createElement(DegradedStatePanel, { mode: 'D' }),
    );
    expect(html).toContain('data-success="true"');
    expect(html).toContain('No adverse findings');
  });

  it('FailureTaxonomyBadge renders Mode + plane', () => {
    const html = renderToStaticMarkup(
      React.createElement(FailureTaxonomyBadge, { mode: 'C' }),
    );
    expect(html).toContain('Mode C');
    expect(html).toContain('verifier');
  });

  it('OwnershipStateBadge renders only the three fixed values', () => {
    for (const state of ['subject', 'delegated', 'unbound'] as const) {
      const html = renderToStaticMarkup(
        React.createElement(OwnershipStateBadge, { state }),
      );
      expect(html).toContain(`data-ownership="${state}"`);
    }
  });

  it('TierBadge renders T1–T4', () => {
    for (const tier of ['T1', 'T2', 'T3', 'T4'] as const) {
      const html = renderToStaticMarkup(
        React.createElement(TierBadge, { tier }),
      );
      expect(html).toContain(`data-tier="${tier}"`);
      expect(html).toContain(tier);
    }
  });

  it('CheckedAtStamp renders ISO + relative; degraded adds dashed border', () => {
    const fresh = renderToStaticMarkup(
      React.createElement(CheckedAtStamp, {
        iso: '2026-05-12T14:31:58Z',
        relative: '10 s ago',
      }),
    );
    expect(fresh).toContain('2026-05-12T14:31:58Z');
    expect(fresh).toContain('10 s ago');
    expect(fresh).not.toContain('data-degraded');
    const degraded = renderToStaticMarkup(
      React.createElement(CheckedAtStamp, {
        iso: '2026-05-12T14:29:14Z',
        relative: '2 m 54 s ago · upstream degraded',
        degraded: true,
      }),
    );
    expect(degraded).toContain('data-degraded="true"');
    expect(degraded).toContain('border-dashed');
  });

  it('ReplayTimeline renders nodes head-first with arrows', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReplayTimeline, {
        nodes: [
          { hash: '7a2c…b8d3', caption: 'head' },
          { hash: '9d11…3e4a' },
          { gap: true, hash: '' },
          { hash: '4b00…f1c2' },
        ],
        tone: 'inverted',
      }),
    );
    expect(html).toContain('data-slot="replay-timeline"');
    expect(html).toContain('data-tone="inverted"');
    expect(html).toContain('— gap —');
    expect(html).toContain('7a2c…b8d3');
  });

  it('HumanReviewLane labels operator + reviewedAt', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        HumanReviewLane,
        {
          operator: 'VitalCV CVO desk · M. Patel',
          reviewedAtIso: '2026-05-12T14:31:58Z',
          caseRef: 'case-481',
        },
        React.createElement('p', null, 'body'),
      ),
    );
    expect(html).toContain('Human-reviewed');
    expect(html).toContain('M. Patel');
    expect(html).toContain('case-481');
    expect(html).toContain('body');
  });

  it('RevocationStateBanner is a hard interruption, not soft stale', () => {
    const html = renderToStaticMarkup(
      React.createElement(RevocationStateBanner, {
        statusListIndex: 481,
        revokedAtIso: '2026-05-12T14:31:58Z',
        reason: 'issuer rotation · key 4f2a retired',
      }),
    );
    expect(html).toContain('Credential revoked');
    expect(html).toContain('StatusList2021');
    expect(html).toContain('idx 481');
    expect(html).toContain('issuer rotation · key 4f2a retired');
    expect(html).toContain('role="alert"');
  });
});

describe('truth-contract · touched files do not introduce banned phrases', () => {
  const TOUCHED_FILES = [
    'apps/web/lib/trust/replay-grammar.ts',
    'apps/web/lib/trust/degradation.ts',
    'apps/web/lib/trust/institutional-language.ts',
    'apps/web/components/trust/primitives/LineageHeader.tsx',
    'apps/web/components/trust/primitives/LineageRow.tsx',
    'apps/web/components/trust/primitives/TrustReceipt.tsx',
    'apps/web/components/trust/primitives/ReplayTimeline.tsx',
    'apps/web/components/trust/primitives/DegradedStatePanel.tsx',
    'apps/web/components/trust/primitives/FailureTaxonomyBadge.tsx',
    'apps/web/components/trust/primitives/OwnershipStateBadge.tsx',
    'apps/web/components/trust/primitives/TierBadge.tsx',
    'apps/web/components/trust/primitives/CheckedAtStamp.tsx',
    'apps/web/components/trust/primitives/HumanReviewLane.tsx',
    'apps/web/components/trust/primitives/RevocationStateBanner.tsx',
    'apps/web/components/trust/primitives/index.ts',
  ];

  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  // Strip block comments, line comments, and the canonical banned-list
  // declaration before scanning. References to banned phrases inside
  // JSDoc or rule-documentation comments are not usage sites — they are
  // the canon declaring what is banned.
  function stripDeclarativeMatter(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(
        /BANNED_INSTITUTIONAL_PHRASES[\s\S]*?\] as const;/,
        'BANNED_INSTITUTIONAL_PHRASES_REDACTED_FOR_TEST',
      );
  }

  it.each(TOUCHED_FILES)('%s contains no banned institutional phrases', (rel) => {
    const abs = path.join(repoRoot, rel);
    const src = fs.readFileSync(abs, 'utf8');
    const hits = findBannedInstitutionalPhrases(stripDeclarativeMatter(src));
    expect(hits).toEqual([]);
  });
});
