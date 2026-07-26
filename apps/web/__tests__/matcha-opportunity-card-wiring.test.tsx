/**
 * Wave K — MATCHA opportunity card wiring: click-through to the role detail
 * route and the readiness-gated Apply-with-VitalCV CTA.
 *
 * The gate is the engine's own output: hard blockers (or an INELIGIBLE band)
 * render an honest "resolve blockers" affordance pointing at the full
 * breakdown — never a broken apply button. Clear roles render the real
 * Apply-with-VitalCV entry point (the audited POST /api/apply/share flow).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The drafter needs the clinician workspace provider; it is not under test here.
vi.mock('../components/matcha/CoverLetterDrafter', () => ({
  CoverLetterDrafter: () => null,
}));

import { OpportunityCard } from '../components/matcha/OpportunityCard';
import { hardGateCount } from '../components/matcha/OpportunityApplyCta';
import type { IntelligenceExplanation } from '../components/matcha/OpportunityIntelligenceCard';

const OPPORTUNITY = {
  id: 'opp-1',
  title: 'Cardiology — Interventional',
  organization: 'Bay Area Cardiac Group',
  organizationId: 'org-9',
  location: 'Oakland, CA',
  state: 'CA',
  specialty: 'Cardiology',
  payRange: '$310k–$360k',
  remote: false,
};

const CLEAR: IntelligenceExplanation = {
  matchBand: 'CLEAR',
  matchScore: 92,
  confidence: 0.9,
  fitReasons: [{ label: 'CA license on file', positive: true }],
  missingCredentials: [],
  blockers: [],
};

const HARD_GATED: IntelligenceExplanation = {
  matchBand: 'PARTIAL',
  matchScore: 48,
  confidence: 0.8,
  fitReasons: [],
  missingCredentials: ['dea'],
  blockers: [
    { label: 'DEA registration required', severity: 'hard', actionLabel: 'Add your DEA number' },
    { label: 'Board cert preferred', severity: 'soft' },
  ],
};

function renderCard(props: Partial<Parameters<typeof OpportunityCard>[0]> = {}) {
  return renderToStaticMarkup(
    <OpportunityCard
      opportunity={OPPORTUNITY}
      explanation={CLEAR}
      bucket="new"
      onSetStatus={() => {}}
      npi="1003000126"
      detailHref="/holder/opportunities/opp-1"
      {...props}
    />,
  );
}

describe('opportunity card — detail click-through (Wave K)', () => {
  it('links the title and the Full breakdown affordance to the role detail route', () => {
    const markup = renderCard();
    expect(markup).toContain('href="/holder/opportunities/opp-1"');
    expect(markup).toContain('Full breakdown');
  });

  it('renders no dead link when detailHref is absent', () => {
    const markup = renderCard({ detailHref: undefined });
    expect(markup).not.toContain('/holder/opportunities/opp-1');
    expect(markup).not.toContain('Full breakdown');
  });
});

describe('opportunity card — gated Apply with VitalCV (Wave K)', () => {
  it('shows the real Apply with VitalCV entry point when no hard gates remain', () => {
    const markup = renderCard();
    expect(markup).toContain('Apply with VitalCV');
    expect(markup).not.toContain('gating requirement');
  });

  it('shows remediation, not a broken apply, when the engine hard-gates the role', () => {
    const markup = renderCard({ explanation: HARD_GATED });
    expect(markup).not.toContain('Apply with VitalCV');
    expect(markup).toContain('1 gating requirement to resolve before you can apply');
    // The affordance routes to the full breakdown where blockers + actions live.
    expect(markup).toContain('See what');
    expect(markup).toContain('href="/holder/opportunities/opp-1"');
  });

  it('renders no apply CTA at all without an NPI', () => {
    const markup = renderCard({ npi: null });
    expect(markup).not.toContain('Apply with VitalCV');
    expect(markup).not.toContain('gating requirement');
  });
});

describe('hardGateCount — the gate is the engine output, never a guess', () => {
  it('is zero without an explanation (no fabricated gate)', () => {
    expect(hardGateCount(undefined)).toBe(0);
  });

  it('counts hard blockers only', () => {
    expect(hardGateCount(HARD_GATED)).toBe(1);
    expect(hardGateCount(CLEAR)).toBe(0);
  });

  it('treats an INELIGIBLE band as gated even when blocker details are absent', () => {
    expect(
      hardGateCount({
        matchBand: 'INELIGIBLE',
        matchScore: 10,
        confidence: 0.7,
        missingCredentials: ['dea', 'state_license'],
        blockers: [],
      }),
    ).toBe(2);
    expect(
      hardGateCount({
        matchBand: 'INELIGIBLE',
        matchScore: 10,
        confidence: 0.7,
        blockers: [],
      }),
    ).toBe(1);
  });
});
