import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import {
  CEDAR_PILOT_DEMO,
  getDemoFixture,
  listDemoFixtureSlugs,
} from '@/lib/demo/demoFixtures';
import { DemoSequenceHeader } from '@/components/demo/DemoSequenceHeader';
import { DeploymentReadinessNarrative } from '@/components/demo/DeploymentReadinessNarrative';
import { OperationalContinuityCard } from '@/components/demo/OperationalContinuityCard';
import { CrossCheckNarrative } from '@/components/demo/CrossCheckNarrative';
import { ReplayImpactNarrative } from '@/components/demo/ReplayImpactNarrative';
import { OperationalAccelerationPanel } from '@/components/demo/OperationalAccelerationPanel';
import { InstitutionalWalkthrough } from '@/components/demo/InstitutionalWalkthrough';
import { EvidenceReuseNarrative } from '@/components/demo/EvidenceReuseNarrative';

// ── Fixture shape ─────────────────────────────────────────────────────────

describe('demo fixtures', () => {
  it('exposes the Cedar pilot by default', () => {
    expect(listDemoFixtureSlugs()).toContain('cedar');
  });

  it('returns null for unknown slugs', () => {
    expect(getDemoFixture('not-real')).toBeNull();
  });

  it('Cedar fixture is well-formed', () => {
    expect(CEDAR_PILOT_DEMO.clinicians.length).toBeGreaterThanOrEqual(3);
    expect(CEDAR_PILOT_DEMO.evidenceContinuity.length).toBeGreaterThanOrEqual(3);
    expect(CEDAR_PILOT_DEMO.crossCheckLanes.length).toBeGreaterThanOrEqual(3);
    expect(CEDAR_PILOT_DEMO.deploymentReadiness.length).toBeGreaterThanOrEqual(3);
    expect(CEDAR_PILOT_DEMO.interruptions.length).toBeGreaterThanOrEqual(1);
  });

  it('every clinician has a 10-digit NPI', () => {
    for (const c of CEDAR_PILOT_DEMO.clinicians) {
      expect(c.npi).toMatch(/^\d{10}$/);
    }
  });
});

// ── Primitive render isolation ────────────────────────────────────────────

describe('DemoSequenceHeader · render', () => {
  it('emits cohort label + window + framing', () => {
    const html = renderToStaticMarkup(
      React.createElement(DemoSequenceHeader, {
        cohortLabel: 'Cedar · Q2-26',
        pilotWindow: '2026-04-19 → 2026-05-19',
        framing: 'A receiver-side view.',
      }),
    );
    expect(html).toContain('data-slot="demo-sequence-header"');
    expect(html).toContain('Cedar · Q2-26');
    expect(html).toContain('2026-04-19');
    expect(html).toContain('A receiver-side view.');
  });
});

describe('OperationalContinuityCard · status mapping', () => {
  it.each([
    ['source_confirmed', 'Source-confirmed'],
    ['evidence_pending', 'Evidence pending'],
    ['continuity_restored', 'Continuity restored'],
    ['continuity_interrupted', 'Continuity interrupted'],
  ] as const)('status %s renders user-facing label "%s"', (status, label) => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalContinuityCard, {
        lane: {
          laneId: 'x',
          source: 'src',
          status,
          observedAt: '2026-05-19T13:00:00Z',
          operatorNote: 'note',
        },
      }),
    );
    expect(html).toContain(label);
    expect(html).toContain(`data-status="${status}"`);
  });
});

describe('DeploymentReadinessNarrative · render', () => {
  it('renders one row per clinician with NPI + credential + specialty', () => {
    const html = renderToStaticMarkup(
      React.createElement(DeploymentReadinessNarrative, {
        clinicians: CEDAR_PILOT_DEMO.clinicians,
      }),
    );
    expect(html).toContain('data-slot="deployment-readiness-narrative"');
    for (const c of CEDAR_PILOT_DEMO.clinicians) {
      expect(html).toContain(c.displayName);
      expect(html).toContain(c.npi);
      expect(html).toContain(c.specialty);
    }
  });
});

describe('CrossCheckNarrative · action mapping', () => {
  it('maps every institutionAction to its user-facing label', () => {
    const html = renderToStaticMarkup(
      React.createElement(CrossCheckNarrative, {
        lanes: CEDAR_PILOT_DEMO.crossCheckLanes,
      }),
    );
    expect(html).toContain('Pending review');
    expect(html).toContain('In review');
    expect(html).toContain('Not eligible (institution-owned)');
  });

  it('never claims automatic acceptance', () => {
    const html = renderToStaticMarkup(
      React.createElement(CrossCheckNarrative, {
        lanes: CEDAR_PILOT_DEMO.crossCheckLanes,
      }),
    ).toLowerCase();
    expect(html).not.toContain('automatic acceptance');
    expect(html).not.toContain('instant verification');
  });
});

describe('ReplayImpactNarrative · render', () => {
  it('renders cause + resolution + institution-owned step per interruption', () => {
    const html = renderToStaticMarkup(
      React.createElement(ReplayImpactNarrative, {
        interruptions: CEDAR_PILOT_DEMO.interruptions,
      }),
    );
    for (const i of CEDAR_PILOT_DEMO.interruptions) {
      expect(html).toContain(i.cause);
      expect(html).toContain(i.resolutionPath);
      expect(html).toContain(i.institutionOwnedStep);
    }
  });
});

describe('OperationalAccelerationPanel · render', () => {
  it('every benefit row pairs a "what changes" with an "institutional caveat"', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalAccelerationPanel, {
        cohortMetrics: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    expect(html).toContain('Reduced duplicate primary-source queries');
    expect(html).toContain('Fewer redundant operator phone confirmations');
    expect(html).toContain('Continuity preserved across upstream blips');
    expect(html).toContain('Acceleration on the federal-source axis only');
    expect(html).toContain('Institutional caveat');
  });

  it('renders cohort metrics when provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalAccelerationPanel, {
        cohortMetrics: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    for (const m of CEDAR_PILOT_DEMO.deploymentReadiness) {
      expect(html).toContain(m.metric);
    }
  });
});

describe('EvidenceReuseNarrative · render', () => {
  it('renders one row per deployment-readiness metric', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceReuseNarrative, {
        rows: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    expect(html).toContain('data-slot="evidence-reuse-narrative"');
    for (const r of CEDAR_PILOT_DEMO.deploymentReadiness) {
      expect(html).toContain(r.metric);
    }
  });
});

describe('InstitutionalWalkthrough · 6 question shape', () => {
  it('renders all six steps with their canonical question text', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalWalkthrough, {
        whatHappened: 'happened',
        whoReviewed: 'reviewed',
        whatWasReused: 'reused',
        whatStillRequiresHumans: 'humans',
        whatAccelerated: 'accelerated',
        whatRemainsInstitutionOwned: 'institution-owned',
      }),
    );
    expect(html).toContain('What happened?');
    expect(html).toContain('Who reviewed?');
    expect(html).toContain('What was reused?');
    expect(html).toContain('What still requires humans?');
    expect(html).toContain('What accelerated?');
    expect(html).toContain('What remains institution-owned?');
    expect(html).toMatch(/data-step-index="6"/);
  });
});

// ── Truth contract · banned-jargon leakage ────────────────────────────────

describe('truth contract · demo surface', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  const TOUCHED_FILES = [
    'apps/web/lib/demo/demoFixtures.ts',
    'apps/web/components/demo/DemoSequenceHeader.tsx',
    'apps/web/components/demo/OperationalContinuityCard.tsx',
    'apps/web/components/demo/EvidenceReuseNarrative.tsx',
    'apps/web/components/demo/CrossCheckNarrative.tsx',
    'apps/web/components/demo/DeploymentReadinessNarrative.tsx',
    'apps/web/components/demo/ReplayImpactNarrative.tsx',
    'apps/web/components/demo/OperationalAccelerationPanel.tsx',
    'apps/web/components/demo/InstitutionalWalkthrough.tsx',
    'apps/web/app/demo/pilot/page.tsx',
  ];

  const BANNED = [
    'fully verified',
    'instant onboarding',
    'instant verification',
    'automatic acceptance',
    'automatically verified',
    'ai-powered',
    'magical onboarding',
    'guaranteed acceptance',
    'federated by default',
    'cryptographically guaranteed',
    'production-ready federation',
  ];

  it.each(TOUCHED_FILES)('%s avoids banned demo jargon', (rel) => {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    const lower = stripComments(src).toLowerCase();
    for (const phrase of BANNED) {
      expect(lower.includes(phrase), `should not contain "${phrase}"`).toBe(false);
    }
  });

  it('boundaries doc declares the banned-phrase posture', () => {
    const md = fs.readFileSync(
      path.join(repoRoot, 'docs/demo/pilot-demonstration-boundaries.md'),
      'utf8',
    );
    expect(md).toContain('automatic acceptance');
    expect(md).toContain('instant verification');
    expect(md).toContain('"AI-powered" anything');
  });
});
