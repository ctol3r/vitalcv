import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import {
  OperatorAttentionQueue,
  ContinuityAttentionCard,
  ReviewProgressPanel,
  OperationalNextStepSummary,
  InstitutionalOwnershipPanel,
  ReadinessProgressStrip,
} from '@/components/operator';
import {
  PILOT_OPERATOR_FIXTURE,
  OPERATOR_VISIBLE_STATE_LABEL,
  NEXT_STEP_OWNER_LABEL,
  getOperatorFixture,
} from '@/lib/operator/operatorFixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ── Fixture shape ─────────────────────────────────────────────────────────

describe('operator fixture', () => {
  it('returns the cedar fixture by default', () => {
    expect(getOperatorFixture()).not.toBeNull();
    expect(getOperatorFixture('cedar')).toEqual(PILOT_OPERATOR_FIXTURE);
  });

  it('returns null for unknown slugs', () => {
    expect(getOperatorFixture('not-real')).toBeNull();
  });

  it('Cedar fixture is well-formed', () => {
    expect(PILOT_OPERATOR_FIXTURE.attentionQueue.length).toBeGreaterThanOrEqual(1);
    expect(PILOT_OPERATOR_FIXTURE.continuity.length).toBeGreaterThanOrEqual(3);
    expect(PILOT_OPERATOR_FIXTURE.reviews.length).toBeGreaterThanOrEqual(2);
    expect(PILOT_OPERATOR_FIXTURE.readiness.length).toBeGreaterThanOrEqual(1);
    expect(PILOT_OPERATOR_FIXTURE.institutionalOwnership.length).toBeGreaterThanOrEqual(3);
  });

  it('OPERATOR_VISIBLE_STATE_LABEL has exactly six entries', () => {
    expect(Object.keys(OPERATOR_VISIBLE_STATE_LABEL).length).toBe(6);
    for (const label of [
      'Ready',
      'Pending review',
      'Attention needed',
      'Interrupted',
      'Continuing',
      'Complete',
    ]) {
      expect(Object.values(OPERATOR_VISIBLE_STATE_LABEL)).toContain(label);
    }
  });

  it('NEXT_STEP_OWNER_LABEL has the expected four owners', () => {
    expect(Object.keys(NEXT_STEP_OWNER_LABEL).length).toBe(4);
    for (const label of ['Operator', 'Receiving institution', 'Sending institution', 'VitalCV']) {
      expect(Object.values(NEXT_STEP_OWNER_LABEL)).toContain(label);
    }
  });
});

// ── Primitive render isolation ────────────────────────────────────────────

describe('OperatorAttentionQueue · render', () => {
  it('emits one row per attention item with next-step + owner', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperatorAttentionQueue, {
        items: PILOT_OPERATOR_FIXTURE.attentionQueue,
      }),
    );
    expect(html).toContain('data-slot="operator-attention-queue"');
    expect(html).toContain(`data-item-count="${PILOT_OPERATOR_FIXTURE.attentionQueue.length}"`);
    for (const item of PILOT_OPERATOR_FIXTURE.attentionQueue) {
      expect(html).toContain(`data-item-id="${item.id}"`);
      expect(html).toContain(item.what);
      expect(html).toContain(item.nextStepLabel);
    }
  });

  it('renders nothing when items is empty (calm == empty)', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperatorAttentionQueue, { items: [] }),
    );
    expect(html).toBe('');
  });
});

describe('ContinuityAttentionCard · state mapping', () => {
  it.each([
    ['ready', 'Ready'],
    ['pending_review', 'Pending review'],
    ['attention_needed', 'Attention needed'],
    ['interrupted', 'Interrupted'],
    ['continuing', 'Continuing'],
    ['complete', 'Complete'],
  ] as const)('state %s renders user-facing label "%s"', (state, label) => {
    const html = renderToStaticMarkup(
      React.createElement(ContinuityAttentionCard, {
        lane: {
          id: 'x',
          laneLabel: 'Test Lane',
          state,
          operatorNote: 'note',
        },
      }),
    );
    expect(html).toContain('data-slot="continuity-attention-card"');
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain(label);
    expect(html).toContain('Test Lane');
  });
});

describe('ReviewProgressPanel · render', () => {
  it('renders one row per review with stage + state + owner', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReviewProgressPanel, {
        reviews: PILOT_OPERATOR_FIXTURE.reviews,
      }),
    );
    expect(html).toContain('data-slot="review-progress-panel"');
    for (const review of PILOT_OPERATOR_FIXTURE.reviews) {
      expect(html).toContain(`data-review-id="${review.id}"`);
      expect(html).toContain(`data-stage="${review.reviewStage}"`);
      expect(html).toContain(review.clinicianDisplayName);
      expect(html).toContain(review.reviewStageLabel);
    }
  });

  it('uses only the six normalized visible state labels', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReviewProgressPanel, {
        reviews: PILOT_OPERATOR_FIXTURE.reviews,
      }),
    );
    const allowed = new Set(Object.values(OPERATOR_VISIBLE_STATE_LABEL));
    for (const review of PILOT_OPERATOR_FIXTURE.reviews) {
      expect(allowed.has(OPERATOR_VISIBLE_STATE_LABEL[review.visibleState])).toBe(true);
    }
    expect(html).toContain(OPERATOR_VISIBLE_STATE_LABEL[PILOT_OPERATOR_FIXTURE.reviews[0]!.visibleState]);
  });
});

describe('OperationalNextStepSummary · five-question shape', () => {
  it('renders all five questions with their canonical text', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalNextStepSummary, {
        whatNeedsAttention: 'a',
        whatIsProgressing: 'b',
        whatIsBlocked: 'c',
        whatHappensNext: 'd',
        whoOwnsTheNextStep: 'e',
      }),
    );
    expect(html).toContain('What needs attention?');
    expect(html).toContain('What is progressing?');
    expect(html).toContain('What is blocked?');
    expect(html).toContain('What happens next?');
    expect(html).toContain('Who owns the next step?');
    expect(html).toMatch(/data-step-index="5"/);
  });
});

describe('InstitutionalOwnershipPanel · render', () => {
  it('renders one row per institution-owned item', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalOwnershipPanel, {
        items: PILOT_OPERATOR_FIXTURE.institutionalOwnership,
      }),
    );
    // React's renderToStaticMarkup HTML-encodes apostrophes (-> &#x27;)
    // so we compare against the encoded form.
    const normalized = html.replace(/&#x27;/g, "'");
    expect(html).toContain('data-slot="institutional-ownership-panel"');
    expect(html).toContain(
      `data-item-count="${PILOT_OPERATOR_FIXTURE.institutionalOwnership.length}"`,
    );
    for (const item of PILOT_OPERATOR_FIXTURE.institutionalOwnership) {
      expect(html).toContain(`data-item-id="${item.id}"`);
      expect(normalized).toContain(item.what);
    }
  });

  it('declares the institution-owned boundary explicitly', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalOwnershipPanel, {
        items: PILOT_OPERATOR_FIXTURE.institutionalOwnership,
      }),
    );
    expect(html).toMatch(/institution-owned/i);
    expect(html).toMatch(/operator does NOT change/i);
  });
});

describe('ReadinessProgressStrip · render', () => {
  it('renders one cohort row per readiness item with three buckets', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReadinessProgressStrip, {
        items: PILOT_OPERATOR_FIXTURE.readiness,
      }),
    );
    expect(html).toContain('data-slot="readiness-progress-strip"');
    for (const item of PILOT_OPERATOR_FIXTURE.readiness) {
      expect(html).toContain(`data-cohort-id="${item.id}"`);
      expect(html).toContain(item.cohortTag);
    }
    expect(html).toContain('data-bucket="ready"');
    expect(html).toContain('data-bucket="pending_review"');
    expect(html).toContain('data-bucket="interrupted"');
  });
});

// ── Route invariants ─────────────────────────────────────────────────────

describe('operator route · structural invariants', () => {
  const src = read('apps/web/app/operator/page.tsx');

  it('imports all six operator primitives', () => {
    for (const name of [
      'OperatorAttentionQueue',
      'ContinuityAttentionCard',
      'ReviewProgressPanel',
      'OperationalNextStepSummary',
      'InstitutionalOwnershipPanel',
      'ReadinessProgressStrip',
    ]) {
      expect(src).toContain(name);
    }
  });

  it('renders exactly one OperationalNextStepSummary', () => {
    const matches = src.match(/<OperationalNextStepSummary[\s>]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('renders exactly one InstitutionalOwnershipPanel (binding)', () => {
    const matches = src.match(/<InstitutionalOwnershipPanel[\s>]/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('contains a progressive disclosure that links to /ops', () => {
    expect(src).toMatch(/data-slot="operator-progressive-disclosure"/);
    expect(src).toMatch(/href="\/ops"/);
  });

  it('does not write to any backend (no fetch/POST)', () => {
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
  });
});

// ── Truth contract · jargon + theater containment ────────────────────────

describe('truth contract · operator surface', () => {
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  const TOUCHED_FILES = [
    'apps/web/lib/operator/operatorFixtures.ts',
    'apps/web/components/operator/OperatorAttentionQueue.tsx',
    'apps/web/components/operator/ContinuityAttentionCard.tsx',
    'apps/web/components/operator/ReviewProgressPanel.tsx',
    'apps/web/components/operator/OperationalNextStepSummary.tsx',
    'apps/web/components/operator/InstitutionalOwnershipPanel.tsx',
    'apps/web/components/operator/ReadinessProgressStrip.tsx',
    'apps/web/app/operator/page.tsx',
  ];

  const BANNED = [
    'fully automated',
    'auto-approves',
    'automatic acceptance',
    'instant verification',
    'instantly verified',
    'ai-powered',
    'ai-driven',
    'magical onboarding',
    'enterprise-grade',
    'startup-grade',
    'revolutionary',
    'disrupting credentialing',
    // Substrate jargon
    'survivabilityscore',
    'degradationownership',
    'lineagekey',
    'replay chronology',
    'dedupekey',
  ];

  it.each(TOUCHED_FILES)('%s avoids banned jargon and theater language', (rel) => {
    const src = read(rel);
    const lower = stripComments(src).toLowerCase();
    for (const phrase of BANNED) {
      expect(
        lower.includes(phrase),
        `should not contain "${phrase}"`,
      ).toBe(false);
    }
  });

  it('boundaries doc enumerates the five-state taxonomy', () => {
    const md = read('docs/product/pilot-operator-boundaries.md');
    for (const state of [
      '`executable`',
      '`simulated`',
      '`institution-owned`',
      '`intentionally-incomplete`',
      '`future-state`',
    ]) {
      expect(md).toContain(state);
    }
  });

  it('boundaries doc enumerates the six normalized visible states', () => {
    const md = read('docs/product/pilot-operator-boundaries.md');
    for (const state of [
      'Ready',
      'Pending review',
      'Attention needed',
      'Interrupted',
      'Continuing',
      'Complete',
    ]) {
      expect(md).toMatch(new RegExp(`\`${state}\``));
    }
  });

  it('boundaries doc declares the banned-phrase posture', () => {
    const md = read('docs/product/pilot-operator-boundaries.md');
    expect(md).toMatch(/enterprise-grade/i);
    expect(md).toMatch(/instant verification/i);
    expect(md).toMatch(/AI-powered/i);
    expect(md).toMatch(/magical onboarding/i);
    expect(md).toMatch(/substrate jargon/i);
  });

  it('boundaries doc names institution-owned items explicitly', () => {
    const md = read('docs/product/pilot-operator-boundaries.md');
    expect(md).toMatch(/State medical board PSV/i);
    expect(md).toMatch(/Credentialing committee/i);
    expect(md).toMatch(/Privileging decisions/i);
  });
});
