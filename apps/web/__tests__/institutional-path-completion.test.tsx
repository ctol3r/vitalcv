import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import {
  CompletionConfirmation,
  InstitutionalNextStep,
  VerificationPreparation,
  ContinuityBridge,
  BoundedSimulationDisclosure,
} from '@/components/continuity';
import {
  CONTINUITY_HANDOFFS,
  REVIEW_ACKNOWLEDGEMENTS,
  VERIFICATION_PREPARATION,
  PILOT_COMPLETION_FIXTURE,
  getContinuityHandoff,
  listContinuityHandoffStates,
} from '@/lib/continuity/continuityFixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ── Fixture shape ─────────────────────────────────────────────────────────

describe('continuity fixtures', () => {
  it('exposes handoff fixtures in all three states', () => {
    const states = listContinuityHandoffStates();
    expect(states).toContain('ready');
    expect(states).toContain('preparing');
    expect(states).toContain('interrupted');
  });

  it('getContinuityHandoff returns null for unknown ids', () => {
    expect(getContinuityHandoff('not-real')).toBeNull();
  });

  it('CONTINUITY_HANDOFFS, REVIEW_ACKNOWLEDGEMENTS, VERIFICATION_PREPARATION, PILOT_COMPLETION_FIXTURE are well-formed', () => {
    expect(CONTINUITY_HANDOFFS.length).toBeGreaterThanOrEqual(3);
    expect(REVIEW_ACKNOWLEDGEMENTS.length).toBeGreaterThanOrEqual(2);
    expect(VERIFICATION_PREPARATION.npi).toMatch(/^\d{10}$/);
    expect(PILOT_COMPLETION_FIXTURE.referenceId).toMatch(/^pilot_/);
  });
});

// ── Primitive render isolation ────────────────────────────────────────────

describe('CompletionConfirmation · render', () => {
  it('emits headline, acknowledgement, reference, and both lists', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompletionConfirmation, {
        headline: 'Submission recorded',
        acknowledgement: 'We have your request.',
        referenceId: 'pilot_xxx_001',
        recordedAt: '2026-05-19T15:42:08Z',
        whatHappensNext: ['Operator reviews within 2 business days.'],
        whatRemainsInstitutionOwned: ['State medical board PSV', 'Committee review'],
      }),
    );
    expect(html).toContain('data-slot="completion-confirmation"');
    expect(html).toContain('data-reference-id="pilot_xxx_001"');
    expect(html).toContain('Submission recorded');
    expect(html).toContain('Operator reviews within 2 business days.');
    expect(html).toContain('State medical board PSV');
    expect(html).toMatch(/institution-owned/i);
  });
});

describe('InstitutionalNextStep · render', () => {
  it('renders label + link + owner + does/does-not lines', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalNextStep, {
        label: 'See the demo',
        href: '/demo/pilot',
        owner: 'vitalcv',
        whatHappens: 'It does this.',
        whatItDoesNotDo: 'It does not do that.',
      }),
    );
    expect(html).toContain('data-slot="institutional-next-step"');
    expect(html).toContain('data-owner="vitalcv"');
    expect(html).toContain('href="/demo/pilot"');
    expect(html).toContain('It does this.');
    expect(html).toContain('It does not do that.');
  });

  it('renders nothing when href is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalNextStep, {
        label: 'x',
        href: '',
        owner: 'operator',
        whatHappens: 'x',
        whatItDoesNotDo: 'x',
      }),
    );
    expect(html).toBe('');
  });
});

describe('VerificationPreparation · render', () => {
  it('renders the three columns + an outbound link', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerificationPreparation, {
        href: '/verify',
        clinicianDisplayName: 'Macie',
      }),
    );
    expect(html).toContain('data-slot="verification-preparation"');
    expect(html).toContain('href="/verify"');
    expect(html).toContain('What you bring');
    expect(html).toContain('What /verify lets a reviewer do');
    expect(html).toContain('What /verify does NOT do');
    expect(html).toContain('Macie');
    expect(html).toMatch(/Final review remains institution-owned/i);
  });

  it('falls back to a generic headline without a clinician display name', () => {
    const html = renderToStaticMarkup(
      React.createElement(VerificationPreparation, {
        href: '/verify',
      }),
    );
    expect(html).toMatch(/Prepare to share continuity/i);
  });
});

describe('ContinuityBridge · render', () => {
  it.each([
    ['ready', 'Ready to hand off'],
    ['preparing', 'Preparing handoff'],
    ['interrupted', 'Handoff interrupted'],
  ] as const)('state %s renders user-facing label "%s"', (state, label) => {
    const html = renderToStaticMarkup(
      React.createElement(ContinuityBridge, {
        fromLabel: '/x',
        toLabel: '/y',
        toHref: '/y',
        state,
        whatTravels: 'one envelope',
        whatStaysBehind: 'institution-owned step',
      }),
    );
    expect(html).toContain('data-slot="continuity-bridge"');
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain(label);
    expect(html).toContain('one envelope');
    expect(html).toContain('institution-owned step');
  });

  it('only the ready state renders a link', () => {
    const readyHtml = renderToStaticMarkup(
      React.createElement(ContinuityBridge, {
        fromLabel: '/a',
        toLabel: '/b',
        toHref: '/b',
        state: 'ready',
        whatTravels: 'x',
        whatStaysBehind: 'y',
      }),
    );
    const interruptedHtml = renderToStaticMarkup(
      React.createElement(ContinuityBridge, {
        fromLabel: '/a',
        toLabel: '/b',
        toHref: '/b',
        state: 'interrupted',
        whatTravels: 'x',
        whatStaysBehind: 'y',
      }),
    );
    expect(readyHtml).toContain('href="/b"');
    expect(interruptedHtml).not.toContain('href="/b"');
    expect(interruptedHtml).toContain('data-slot="continuity-bridge-no-link"');
  });
});

describe('BoundedSimulationDisclosure · render', () => {
  it('renders the three labeled blocks', () => {
    const html = renderToStaticMarkup(
      React.createElement(BoundedSimulationDisclosure, {
        simulationLabel: 'Pilot intake',
        whatIsSimulated: 'This surface does X.',
        whatWouldHappenInProduction: 'A production system would do Y.',
        whatRemainsInstitutionOwned: 'Z stays institution-owned.',
      }),
    );
    expect(html).toContain('data-slot="bounded-simulation-disclosure"');
    expect(html).toContain('data-simulation-label="Pilot intake"');
    expect(html).toContain('This surface does X.');
    expect(html).toContain('A production system would do Y.');
    expect(html).toContain('Z stays institution-owned.');
  });
});

// ── Path-completion invariants on the modified routes ─────────────────────

describe('path-completion · /pilot', () => {
  const src = read('apps/web/app/pilot/PilotRequestForm.tsx');

  it('imports the continuity primitives', () => {
    expect(src).toMatch(/CompletionConfirmation/);
    expect(src).toMatch(/InstitutionalNextStep/);
    expect(src).toMatch(/BoundedSimulationDisclosure/);
  });

  it('the OK branch renders BoundedSimulationDisclosure + CompletionConfirmation + InstitutionalNextStep', () => {
    const okBranch = src.slice(src.indexOf("phase === 'ok'"));
    expect(okBranch).toMatch(/<BoundedSimulationDisclosure/);
    expect(okBranch).toMatch(/<CompletionConfirmation/);
    expect(okBranch).toMatch(/<InstitutionalNextStep/);
  });
});

describe('path-completion · /employer/review/[applicationId]', () => {
  const src = read('apps/web/app/employer/review/[applicationId]/page.tsx');

  it('imports the continuity primitives', () => {
    expect(src).toMatch(/ReviewAcknowledgement/);
    expect(src).toMatch(/BoundedSimulationDisclosure/);
    expect(src).toMatch(/ContinuityBridge/);
  });

  it('no static review buttons remain (Accept/Reject/Request HTML buttons replaced)', () => {
    expect(src).not.toMatch(/Accept as head start/);
    expect(src).not.toMatch(/Request missing info/);
    expect(src).not.toMatch(/<button[^>]*>Reject<\/button>/);
  });

  it('renders the bounded disclosure + acknowledgment primitive', () => {
    expect(src).toMatch(/<BoundedSimulationDisclosure/);
    expect(src).toMatch(/<ReviewAcknowledgement/);
  });
});

describe('path-completion · /holder', () => {
  const src = read('apps/web/app/holder/page.tsx');

  it('imports VerificationPreparation + ContinuityBridge', () => {
    expect(src).toMatch(/VerificationPreparation/);
    expect(src).toMatch(/ContinuityBridge/);
  });

  it('renders both primitives in the has_npi branch', () => {
    expect(src).toMatch(/<VerificationPreparation/);
    expect(src).toMatch(/<ContinuityBridge[\s\S]*toHref="\/verify"/);
  });
});

describe('path-completion · /verify', () => {
  const src = read('apps/web/app/verify/page.tsx');

  it('imports BoundedSimulationDisclosure + InstitutionalNextStep', () => {
    expect(src).toMatch(/BoundedSimulationDisclosure/);
    expect(src).toMatch(/InstitutionalNextStep/);
  });

  it('exposes a demo-token button for inspection without a real JWT', () => {
    expect(src).toMatch(/verify-demo-token-button/);
    expect(src).toMatch(/DEMO_VERIFICATION_TOKEN/);
    expect(src).toMatch(/real verification not yet materialized/i);
  });

  it('renders the bounded disclosure + a next-step pointing back to readiness', () => {
    expect(src).toMatch(/<BoundedSimulationDisclosure/);
    expect(src).toMatch(/<InstitutionalNextStep[\s\S]*href="\/holder\/readiness"/);
  });
});

// ── Truth contract · fake-automation containment ──────────────────────────

describe('truth contract · continuity primitives and repaired routes', () => {
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  const TOUCHED_FILES = [
    'apps/web/components/continuity/CompletionConfirmation.tsx',
    'apps/web/components/continuity/InstitutionalNextStep.tsx',
    'apps/web/components/continuity/ReviewAcknowledgement.tsx',
    'apps/web/components/continuity/VerificationPreparation.tsx',
    'apps/web/components/continuity/ContinuityBridge.tsx',
    'apps/web/components/continuity/BoundedSimulationDisclosure.tsx',
    'apps/web/lib/continuity/continuityFixtures.ts',
    'apps/web/app/pilot/PilotRequestForm.tsx',
    'apps/web/app/employer/review/[applicationId]/page.tsx',
    'apps/web/app/holder/page.tsx',
    'apps/web/app/verify/page.tsx',
  ];

  const BANNED = [
    'fake approval',
    'auto-approve',
    'auto approves',
    'instant verification',
    'verifies instantly',
    'automatically verified',
    'automatic acceptance',
    'magical onboarding',
    'automated decision',
    'we approve',
    'we accept',
    'automatic backend processing',
    'back-office automation',
    'guaranteed approval',
    'guaranteed acceptance',
  ];

  it.each(TOUCHED_FILES)(
    '%s avoids banned automation jargon',
    (rel) => {
      const src = read(rel);
      const lower = stripComments(src).toLowerCase();
      for (const phrase of BANNED) {
        expect(
          lower.includes(phrase),
          `should not contain "${phrase}"`,
        ).toBe(false);
      }
    },
  );

  it('boundaries doc enumerates the five-state taxonomy', () => {
    const md = read('docs/product/institutional-path-boundaries.md');
    expect(md).toMatch(/`executable`/);
    expect(md).toMatch(/`simulated`/);
    expect(md).toMatch(/`institution-owned`/);
    expect(md).toMatch(/`intentionally-incomplete`/);
    expect(md).toMatch(/`future-state`/);
  });

  it('boundaries doc declares the banned-phrase posture', () => {
    const md = read('docs/product/institutional-path-boundaries.md');
    expect(md).toMatch(/fake approval/i);
    expect(md).toMatch(/instant verification/i);
    expect(md).toMatch(/magical onboarding/i);
    expect(md).toMatch(/automatic backend processing/i);
    expect(md).toMatch(/guaranteed approval/i);
  });

  it('boundaries doc names the four repaired flows', () => {
    const md = read('docs/product/institutional-path-boundaries.md');
    expect(md).toMatch(/\/pilot/);
    expect(md).toMatch(/\/employer\/review/);
    expect(md).toMatch(/\/holder/);
    expect(md).toMatch(/\/verify/);
  });
});
