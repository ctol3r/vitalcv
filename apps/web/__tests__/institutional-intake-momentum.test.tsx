import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import { CEDAR_PILOT_DEMO } from '@/lib/demo/demoFixtures';
import { IntakeEntryHeader } from '@/components/intake/IntakeEntryHeader';
import { ThirtySecondComprehension } from '@/components/intake/ThirtySecondComprehension';
import { EvidenceContinuitySummary } from '@/components/intake/EvidenceContinuitySummary';
import { DuplicateOutreachReduction } from '@/components/intake/DuplicateOutreachReduction';
import { InstitutionReviewNarrative } from '@/components/intake/InstitutionReviewNarrative';
import { OperationalReadinessSummary } from '@/components/intake/OperationalReadinessSummary';
import { ContinuityGapNarrative } from '@/components/intake/ContinuityGapNarrative';
import { InstitutionalIntakeProgress } from '@/components/intake/InstitutionalIntakeProgress';
import { EvidenceReuseSummary } from '@/components/intake/EvidenceReuseSummary';

// ── Comprehension panel (the critical 30-second surface) ──────────────────

describe('ThirtySecondComprehension · 5 questions, 5 answers', () => {
  it('renders all five binding questions', () => {
    const html = renderToStaticMarkup(
      React.createElement(ThirtySecondComprehension),
    );
    expect(html).toContain('What is this?');
    expect(html).toContain('Why does it help?');
    expect(html).toContain('What gets reused?');
    expect(html).toContain('What still requires humans?');
    expect(html).toContain('Why is onboarding faster?');
  });

  it('renders the five answers with data-index attributes 1..5', () => {
    const html = renderToStaticMarkup(
      React.createElement(ThirtySecondComprehension),
    );
    for (const i of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`data-index="${i}"`);
    }
  });

  it('answers use plain-English federal-source terminology', () => {
    const html = renderToStaticMarkup(
      React.createElement(ThirtySecondComprehension),
    );
    expect(html).toContain('NPPES');
    expect(html).toContain('OIG/LEIE');
    expect(html).toContain('PECOS');
    expect(html).toContain('committee');
    expect(html).toMatch(/state medical board/i);
  });
});

// ── Entry header ──────────────────────────────────────────────────────────

describe('IntakeEntryHeader · renders 30-second framing', () => {
  it('renders cohort + pilot window + binding framing line', () => {
    const html = renderToStaticMarkup(
      React.createElement(IntakeEntryHeader, {
        cohortLabel: CEDAR_PILOT_DEMO.cohortLabel,
        pilotWindow: CEDAR_PILOT_DEMO.pilotWindow,
      }),
    );
    expect(html).toContain('data-slot="intake-entry-header"');
    expect(html).toContain(CEDAR_PILOT_DEMO.cohortLabel);
    expect(html).toContain(CEDAR_PILOT_DEMO.pilotWindow);
    expect(html).toContain('Federal-source resolution, evidence reuse');
    expect(html).toMatch(/institution[\s-]?(review|owned|review)/i);
    expect(html).toMatch(/existing cadence/i);
  });
});

// ── Continuity summary ────────────────────────────────────────────────────

describe('EvidenceContinuitySummary · per-lane render', () => {
  it('renders one row per lane with user-facing status label', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceContinuitySummary, {
        lanes: CEDAR_PILOT_DEMO.evidenceContinuity,
      }),
    );
    expect(html).toContain('data-slot="evidence-continuity-summary"');
    for (const lane of CEDAR_PILOT_DEMO.evidenceContinuity) {
      expect(html).toContain(`data-lane-id="${lane.laneId}"`);
      expect(html).toContain(`data-status="${lane.status}"`);
    }
  });

  it('user-facing labels never expose the underlying enum keys', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceContinuitySummary, {
        lanes: CEDAR_PILOT_DEMO.evidenceContinuity,
      }),
    );
    expect(html).toContain('Source-confirmed');
    expect(html).toContain('Continuity restored');
  });
});

// ── Duplicate outreach reduction ─────────────────────────────────────────

describe('DuplicateOutreachReduction · 4 rows', () => {
  it('renders exactly four activity rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(DuplicateOutreachReduction),
    );
    const rows = (html.match(/data-slot="duplicate-outreach-row"/g) ?? []).length;
    expect(rows).toBe(4);
  });

  it('each row pairs "What changes" with "What you retain"', () => {
    const html = renderToStaticMarkup(
      React.createElement(DuplicateOutreachReduction),
    );
    expect(html).toMatch(/What changes/);
    expect(html).toMatch(/What you retain/);
  });

  it('does not claim guaranteed acceptance or instant verification', () => {
    const html = renderToStaticMarkup(
      React.createElement(DuplicateOutreachReduction),
    ).toLowerCase();
    expect(html).not.toContain('guaranteed acceptance');
    expect(html).not.toContain('instant verification');
    expect(html).not.toContain('automatic acceptance');
  });
});

// ── Institution review narrative ──────────────────────────────────────────

describe('InstitutionReviewNarrative · 4 institution-owned surfaces', () => {
  it('names the four institution-owned surfaces', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionReviewNarrative),
    );
    expect(html).toContain('State medical board verification');
    expect(html).toContain('Credentialing committee review');
    expect(html).toContain('Privileging decisions');
    expect(html).toContain('Stale-but-signed lane disposition');
  });

  it('every row names what VitalCV does NOT do', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionReviewNarrative),
    );
    const matches = (html.match(/What VitalCV does NOT do/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });
});

// ── Operational readiness summary ─────────────────────────────────────────

describe('OperationalReadinessSummary · cohort overview', () => {
  it('renders cohort-level counts + per-clinician rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalReadinessSummary, {
        clinicians: CEDAR_PILOT_DEMO.clinicians,
      }),
    );
    expect(html).toContain('data-slot="operational-readiness-summary"');
    expect(html).toContain('Clinicians');
    expect(html).toContain('Operating states');
    expect(html).toContain('Specialties');
    for (const c of CEDAR_PILOT_DEMO.clinicians) {
      expect(html).toContain(c.npi);
      expect(html).toContain(c.displayName);
    }
  });

  it('uses the bounded "ready for institution review" heading', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalReadinessSummary, {
        clinicians: CEDAR_PILOT_DEMO.clinicians,
      }),
    );
    expect(html).toContain('ready for institution review');
  });
});

// ── Continuity gap narrative ──────────────────────────────────────────────

describe('ContinuityGapNarrative · interruption rendering', () => {
  it('renders one row per interruption with cause + path + step', () => {
    const html = renderToStaticMarkup(
      React.createElement(ContinuityGapNarrative, {
        interruptions: CEDAR_PILOT_DEMO.interruptions,
      }),
    );
    for (const i of CEDAR_PILOT_DEMO.interruptions) {
      expect(html).toContain(i.cause);
      expect(html).toContain(i.resolutionPath);
      expect(html).toContain(i.institutionOwnedStep);
    }
  });

  it('renders an empty-state when there are no interruptions', () => {
    const html = renderToStaticMarkup(
      React.createElement(ContinuityGapNarrative, { interruptions: [] }),
    );
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('No continuity gaps recorded');
  });
});

// ── Intake progress · 5 stages ───────────────────────────────────────────

describe('InstitutionalIntakeProgress · five stages with explicit owners', () => {
  it('renders all five stages with data-step-index', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalIntakeProgress),
    );
    for (const i of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`data-step-index="${i}"`);
    }
  });

  it('stages 4 and 5 are marked institution-owned', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalIntakeProgress),
    );
    expect(html).toMatch(
      /data-step-index="4"[\s\S]*?data-owner="institution"/,
    );
    expect(html).toMatch(
      /data-step-index="5"[\s\S]*?data-owner="institution"/,
    );
  });

  it('headline copy never claims deployment-ready without "institution-owned" caveat on step 5', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalIntakeProgress),
    );
    // The step-5 label includes "(institution-owned)" so a reader
    // cannot conflate it with an automatic acceptance.
    expect(html).toContain('Deployment-ready (institution-owned)');
  });
});

// ── Evidence reuse summary · binding boundary claims ─────────────────────

describe('EvidenceReuseSummary · binding boundary claims are always rendered', () => {
  it('renders the three non-removable boundary claims', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceReuseSummary, {
        metrics: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    expect(html).toContain('Reuse does not constitute guaranteed acceptance');
    expect(html).toContain('not a regulatory replacement');
    expect(html).toContain('not transfer trust automatically');
  });

  it('renders one row per metric', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceReuseSummary, {
        metrics: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    for (const m of CEDAR_PILOT_DEMO.deploymentReadiness) {
      expect(html).toContain(m.metric);
    }
  });
});

// ── Truth contract grep across all touched files ─────────────────────────

describe('truth contract · intake surface', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  const TOUCHED_FILES = [
    'apps/web/components/intake/IntakeEntryHeader.tsx',
    'apps/web/components/intake/ThirtySecondComprehension.tsx',
    'apps/web/components/intake/EvidenceContinuitySummary.tsx',
    'apps/web/components/intake/DuplicateOutreachReduction.tsx',
    'apps/web/components/intake/InstitutionReviewNarrative.tsx',
    'apps/web/components/intake/OperationalReadinessSummary.tsx',
    'apps/web/components/intake/ContinuityGapNarrative.tsx',
    'apps/web/components/intake/InstitutionalIntakeProgress.tsx',
    'apps/web/components/intake/EvidenceReuseSummary.tsx',
    'apps/web/app/intake/page.tsx',
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
    'growth hack',
  ];

  it.each(TOUCHED_FILES)('%s avoids banned intake jargon', (rel) => {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    const lower = stripComments(src).toLowerCase();
    for (const phrase of BANNED) {
      // EvidenceReuseSummary renders binding rejection claims like
      // "does not constitute guaranteed acceptance" -- exempt the file
      // when the phrase appears inside a clearly-bounded "does not"
      // or "not a" or "without" clause.
      if (
        rel.endsWith('EvidenceReuseSummary.tsx') ||
        rel.endsWith('DuplicateOutreachReduction.tsx') ||
        rel.endsWith('InstitutionReviewNarrative.tsx')
      ) {
        // The grep is still useful but allow rejection-form claims.
        const occurrences = (lower.match(new RegExp(phrase, 'g')) ?? [])
          .length;
        const negated = (
          lower.match(
            new RegExp(`(does not|not a|without|never)[^.]{0,40}${phrase}`, 'g'),
          ) ?? []
        ).length;
        expect(
          occurrences - negated,
          `unbounded "${phrase}" usage in ${rel}`,
        ).toBeLessThanOrEqual(0);
      } else {
        expect(lower.includes(phrase), `should not contain "${phrase}"`).toBe(
          false,
        );
      }
    }
  });

  it('boundaries doc declares the banned-phrase posture', () => {
    const md = fs.readFileSync(
      path.join(repoRoot, 'docs/demo/institutional-intake-boundaries.md'),
      'utf8',
    );
    expect(md).toContain('automatic acceptance');
    expect(md).toContain('instant onboarding');
    expect(md).toContain('"AI-powered" anything');
  });
});
