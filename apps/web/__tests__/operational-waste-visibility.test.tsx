import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import { CEDAR_PILOT_DEMO } from '@/lib/demo/demoFixtures';
import { WasteEntryHeader } from '@/components/waste/WasteEntryHeader';
import { DuplicateOutreachNarrative } from '@/components/waste/DuplicateOutreachNarrative';
import { ContinuityInterruptionNarrative } from '@/components/waste/ContinuityInterruptionNarrative';
import { EvidenceFragmentationNarrative } from '@/components/waste/EvidenceFragmentationNarrative';
import { OperationalDeadTimeNarrative } from '@/components/waste/OperationalDeadTimeNarrative';
import { ManualReviewLoopNarrative } from '@/components/waste/ManualReviewLoopNarrative';
import { DeploymentDelayNarrative } from '@/components/waste/DeploymentDelayNarrative';
import { OperationalContinuityComparison } from '@/components/waste/OperationalContinuityComparison';
import { InstitutionalFrictionTimeline } from '@/components/waste/InstitutionalFrictionTimeline';
import { WasteVisibilitySummary } from '@/components/waste/WasteVisibilitySummary';

// ── Primitive render isolation ────────────────────────────────────────────

describe('WasteEntryHeader · render', () => {
  it('emits cohort + window + visibility framing', () => {
    const html = renderToStaticMarkup(
      React.createElement(WasteEntryHeader, {
        cohortLabel: 'Cedar · Q2-26',
        pilotWindow: '2026-04-19 → 2026-05-19',
      }),
    );
    expect(html).toContain('data-slot="waste-entry-header"');
    expect(html).toContain('Cedar · Q2-26');
    expect(html).toContain('2026-04-19');
    expect(html).toMatch(/visibility, not elimination/i);
  });

  it('never claims savings or ROI in the header copy', () => {
    const html = renderToStaticMarkup(
      React.createElement(WasteEntryHeader, {
        cohortLabel: 'Cedar',
        pilotWindow: '2026-04-19 → 2026-05-19',
      }),
    ).toLowerCase();
    expect(html).not.toContain('save millions');
    expect(html).not.toContain('guaranteed savings');
    expect(html).not.toContain('fake roi');
  });
});

describe('DuplicateOutreachNarrative · render', () => {
  it('renders one row per cross-check lane', () => {
    const html = renderToStaticMarkup(
      React.createElement(DuplicateOutreachNarrative, {
        lanes: CEDAR_PILOT_DEMO.crossCheckLanes,
      }),
    );
    expect(html).toContain('data-slot="duplicate-outreach-narrative"');
    for (const lane of CEDAR_PILOT_DEMO.crossCheckLanes) {
      expect(html).toContain(`data-lane-id="${lane.laneId}"`);
      expect(html).toContain(lane.source);
    }
    expect(html).toMatch(/Sending operator/i);
  });

  it('frames duplication as visible, not eliminated', () => {
    const html = renderToStaticMarkup(
      React.createElement(DuplicateOutreachNarrative, {
        lanes: CEDAR_PILOT_DEMO.crossCheckLanes,
      }),
    );
    expect(html).toMatch(/Visibility, not elimination/i);
    expect(html).toMatch(/still reviews/i);
  });
});

describe('ContinuityInterruptionNarrative · render', () => {
  it('renders one row per interruption with cause + institution-owned step', () => {
    const html = renderToStaticMarkup(
      React.createElement(ContinuityInterruptionNarrative, {
        interruptions: CEDAR_PILOT_DEMO.interruptions,
      }),
    );
    expect(html).toContain('data-slot="continuity-interruption-narrative"');
    for (const i of CEDAR_PILOT_DEMO.interruptions) {
      expect(html).toContain(i.cause);
      expect(html).toContain(i.institutionOwnedStep);
    }
  });

  it('describes recovery as institution-owned', () => {
    const html = renderToStaticMarkup(
      React.createElement(ContinuityInterruptionNarrative, {
        interruptions: CEDAR_PILOT_DEMO.interruptions,
      }),
    );
    expect(html).toMatch(/Institution-owned recovery step/i);
    expect(html).toMatch(/operator-led/i);
  });
});

describe('EvidenceFragmentationNarrative · render', () => {
  it('renders one row per evidence lane with status mapping', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceFragmentationNarrative, {
        evidenceLanes: CEDAR_PILOT_DEMO.evidenceContinuity,
      }),
    );
    expect(html).toContain('data-slot="evidence-fragmentation-narrative"');
    for (const lane of CEDAR_PILOT_DEMO.evidenceContinuity) {
      expect(html).toContain(`data-lane-id="${lane.laneId}"`);
      expect(html).toContain(`data-status="${lane.status}"`);
      expect(html).toContain(lane.source);
    }
    // Status labels
    expect(html).toContain('Source-confirmed');
  });

  it('names institution records as staying institution-owned', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceFragmentationNarrative, {
        evidenceLanes: CEDAR_PILOT_DEMO.evidenceContinuity,
      }),
    );
    expect(html).toMatch(/institution records stay institution-owned/i);
  });
});

describe('OperationalDeadTimeNarrative · render', () => {
  it('renders the five dead-time categories', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalDeadTimeNarrative, {}),
    );
    expect(html).toContain('data-slot="operational-dead-time-narrative"');
    expect(html).toContain('Federal-source resolution wait');
    expect(html).toContain('Phone-tag confirmation');
    expect(html).toContain('Re-query after registry lag');
    expect(html).toContain('Committee-window dead time');
    expect(html).toContain('Privileging-decision dead time');
  });

  it('does not claim committee or privileging accelerates', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalDeadTimeNarrative, {}),
    );
    expect(html).toMatch(/Committee cadence is institution-owned/i);
    expect(html).toMatch(/Privileging is institution-owned/i);
  });
});

describe('ManualReviewLoopNarrative · render', () => {
  it('renders the five manual review loops', () => {
    const html = renderToStaticMarkup(
      React.createElement(ManualReviewLoopNarrative, {}),
    );
    expect(html).toContain('data-slot="manual-review-loop-narrative"');
    expect(html).toContain('Re-reading the same NPPES record');
    expect(html).toContain('Re-summarising the same operator note');
    expect(html).toContain('Re-checking exclusion-list status');
    expect(html).toContain('Reconciling source timestamps by hand');
    expect(html).toContain('Tracking down the original requester');
  });

  it('separates re-reading from deliberate judgement', () => {
    const html = renderToStaticMarkup(
      React.createElement(ManualReviewLoopNarrative, {}),
    );
    expect(html).toMatch(/Some review is judgement/i);
    expect(html).toMatch(/Some review is re-reading the packet/i);
    expect(html).toMatch(/deliberate institutional judgement/i);
  });
});

describe('DeploymentDelayNarrative · render', () => {
  it('renders the three delay axes and the metric rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(DeploymentDelayNarrative, {
        rows: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    expect(html).toContain('data-slot="deployment-delay-narrative"');
    expect(html).toContain('Federal-source resolution axis');
    expect(html).toContain('Committee-review axis');
    expect(html).toContain('Privileging-decision axis');
    for (const row of CEDAR_PILOT_DEMO.deploymentReadiness) {
      expect(html).toContain(row.metric);
    }
  });

  it('names federal-source as the only compressing axis', () => {
    const html = renderToStaticMarkup(
      React.createElement(DeploymentDelayNarrative, {
        rows: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    expect(html).toMatch(/Only one compresses/i);
    expect(html).toMatch(/Committee cadence is institution-owned/i);
    expect(html).toMatch(/Privileging is institution-owned/i);
  });

  it('flags after column as a pilot target, not measured', () => {
    const html = renderToStaticMarkup(
      React.createElement(DeploymentDelayNarrative, {
        rows: CEDAR_PILOT_DEMO.deploymentReadiness,
      }),
    );
    expect(html).toMatch(/Pilot target/i);
    expect(html).toMatch(/not a measured cohort result/i);
  });
});

describe('OperationalContinuityComparison · render', () => {
  it('renders eight steps with today vs pilot framing', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalContinuityComparison, {}),
    );
    expect(html).toContain('data-slot="operational-continuity-comparison"');
    for (let i = 1; i <= 8; i += 1) {
      expect(html).toContain(`data-step-index="${i}"`);
    }
  });

  it('marks the four institution-owned steps explicitly', () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalContinuityComparison, {}),
    );
    const ownedMatches = html.match(/data-institution-owned="true"/g) ?? [];
    expect(ownedMatches.length).toBe(4);
    expect(html).toContain('State medical board PSV');
    expect(html).toContain('Credentialing committee review');
    expect(html).toContain('Privileging decision');
    expect(html).toContain('Final acceptance');
  });
});

describe('InstitutionalFrictionTimeline · render', () => {
  it('renders six checkpoints T-0 through T-5', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalFrictionTimeline, {}),
    );
    expect(html).toContain('data-slot="institutional-friction-timeline"');
    for (const marker of ['T-0', 'T-1', 'T-2', 'T-3', 'T-4', 'T-5']) {
      expect(html).toContain(`data-marker="${marker}"`);
    }
    expect(html).toContain('Candidate identified');
    expect(html).toContain('Federal-source resolution');
    expect(html).toContain('State medical board PSV');
    expect(html).toContain('Committee scheduling');
    expect(html).toContain('Committee disposition');
    expect(html).toContain('Privileging + deployment');
  });

  it('names committee + privileging as institution-owned', () => {
    const html = renderToStaticMarkup(
      React.createElement(InstitutionalFrictionTimeline, {}),
    );
    expect(html).toMatch(/Committee cadence is institution-owned/i);
    expect(html).toMatch(/Privileging and deployment cadence are institution-owned/i);
  });
});

describe('WasteVisibilitySummary · render', () => {
  it('renders six narrative summary rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(WasteVisibilitySummary, {}),
    );
    expect(html).toContain('data-slot="waste-visibility-summary"');
    for (const id of ['01', '02', '03', '04', '05', '06']) {
      expect(html).toContain(`data-narrative-id="${id}"`);
    }
  });

  it('enumerates the institution-owned-in-full list', () => {
    const html = renderToStaticMarkup(
      React.createElement(WasteVisibilitySummary, {}),
    );
    expect(html).toContain('State medical board PSV');
    expect(html).toContain('Credentialing committee review');
    expect(html).toContain('Privileging decisions');
    expect(html).toContain('Final acceptance');
    expect(html).toMatch(/freshness/i);
    expect(html).toMatch(/stale-but-signed/i);
  });

  it('declares "no ROI or savings claim" in the footer', () => {
    const html = renderToStaticMarkup(
      React.createElement(WasteVisibilitySummary, {}),
    );
    expect(html).toMatch(/no ROI or savings claim/i);
    expect(html).toMatch(/Visibility, not elimination/i);
  });
});

// ── Truth contract · banned-jargon leakage ────────────────────────────────

describe('truth contract · waste surface', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  function stripDeclarativeMatter(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  const TOUCHED_FILES = [
    'apps/web/components/waste/WasteEntryHeader.tsx',
    'apps/web/components/waste/DuplicateOutreachNarrative.tsx',
    'apps/web/components/waste/ContinuityInterruptionNarrative.tsx',
    'apps/web/components/waste/EvidenceFragmentationNarrative.tsx',
    'apps/web/components/waste/OperationalDeadTimeNarrative.tsx',
    'apps/web/components/waste/ManualReviewLoopNarrative.tsx',
    'apps/web/components/waste/DeploymentDelayNarrative.tsx',
    'apps/web/components/waste/OperationalContinuityComparison.tsx',
    'apps/web/components/waste/InstitutionalFrictionTimeline.tsx',
    'apps/web/components/waste/WasteVisibilitySummary.tsx',
    'apps/web/app/demo/waste/page.tsx',
  ];

  const BANNED = [
    'save millions',
    'instant onboarding',
    'instant verification',
    'fake roi',
    'ai-powered',
    'guaranteed savings',
    'protocol theater',
    'automatic acceptance',
    'automatically verified',
    'magical onboarding',
    'cryptographically guaranteed',
  ];

  it.each(TOUCHED_FILES)(
    '%s avoids banned waste-surface jargon',
    (rel) => {
      const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      const lower = stripDeclarativeMatter(src).toLowerCase();
      for (const phrase of BANNED) {
        expect(
          lower.includes(phrase),
          `should not contain "${phrase}"`,
        ).toBe(false);
      }
    },
  );

  it('boundaries doc declares the banned-phrase posture', () => {
    const md = fs.readFileSync(
      path.join(repoRoot, 'docs/demo/operational-waste-boundaries.md'),
      'utf8',
    );
    expect(md).toMatch(/save millions/i);
    expect(md).toMatch(/instant onboarding/i);
    expect(md).toMatch(/fake roi/i);
    expect(md).toMatch(/AI-powered/i);
    expect(md).toMatch(/protocol theater/i);
    expect(md).toMatch(/guaranteed savings/i);
  });

  it('boundaries doc enumerates the five taxonomy states', () => {
    const md = fs.readFileSync(
      path.join(repoRoot, 'docs/demo/operational-waste-boundaries.md'),
      'utf8',
    );
    expect(md).toMatch(/`demonstrated`/i);
    expect(md).toMatch(/`observed`/i);
    expect(md).toMatch(/`simulated`/i);
    expect(md).toMatch(/`unsupported`/i);
    expect(md).toMatch(/`institution-owned`/i);
  });

  it('boundaries doc names institution-owned items explicitly', () => {
    const md = fs.readFileSync(
      path.join(repoRoot, 'docs/demo/operational-waste-boundaries.md'),
      'utf8',
    );
    expect(md).toMatch(/State medical board PSV/i);
    expect(md).toMatch(/Credentialing committee review/i);
    expect(md).toMatch(/Privileging decisions/i);
    expect(md).toMatch(/stale-but-signed lanes/i);
  });
});
