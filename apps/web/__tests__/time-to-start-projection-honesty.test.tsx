import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimeToStartEstimateSummary } from '@/components/trust/TimeToStartEstimateSummary';
import {
  buildPassportPilotTimeToStartEstimate,
  estimatePilotTimeToStart,
} from '@/lib/trust/time-to-start-estimate';
import { buildTimeToStartEstimate } from '@/lib/trust/time-to-start';

/**
 * Time-to-start numbers must never be rendered in the vocabulary of measurement.
 *
 * Both time-to-start modules compute `timeSaved` as `assumedBaseline - modelled
 * start`, where the baseline (90 days) is an assumption nobody observed and the
 * coefficients are hand-tuned. The surfaced result was previously labelled
 * "Without VitalCV" and "Time saved" — an asserted counterfactual and an asserted
 * outcome, neither of which we measured. docs/PILOT_ROI_NARRATIVE.md already says
 * the reduction is a hypothesis "until measured by real pilot cases. Do not
 * present as proven."
 *
 * These assertions pin the honest framing so a future copy-polish pass cannot
 * quietly restore the measurement vocabulary — a recurring failure mode in this
 * repo, where "polish" has dropped truth-contract strings before.
 *
 * The measured counterpart is lib/trust/qualified-start-measurement.ts, which
 * emits no saving at all.
 */

const MEASUREMENT_VOCABULARY = [
  'without vitalcv',
  'time saved',
  'time-saved',
  'proven',
  'guaranteed',
];

describe('time-to-start projections are labelled as projections', () => {
  it('carries the epistemic status inside the values themselves', () => {
    const estimate = estimatePilotTimeToStart({
      readinessScore: 55,
      missingSources: 1,
      blockedStates: 0,
    });

    // Inside the value, not only the surrounding label — so a number lifted into
    // a screenshot or a deck still says what it is.
    expect(estimate.baselineLabel).toContain('(assumed)');
    expect(estimate.timeSavedLabel).toContain('(projected)');
    expect(estimate.disclosureLabel.toLowerCase()).toContain('not a measured result');
  });

  it('applies the same discipline to the second, currently-unwired module', () => {
    const estimate = buildTimeToStartEstimate({
      blockers: [],
      gaps: [],
      licensureStatus: 'verified',
    });

    expect(estimate.withoutVitalCvLabel).toContain('(assumed)');
    expect(estimate.withVitalCvLabel).toContain('(projected)');
    expect(estimate.timeSavedLabel).toContain('(projected)');
  });

  it('renders no measurement vocabulary on the live review surface', () => {
    const estimate = buildPassportPilotTimeToStartEstimate({
      readiness: { score: 62, status: 'READY', blockers: [] },
      sourceCoverage: {
        summary: {
          checked: [],
          stale: ['state_license'],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
    } as unknown as Parameters<typeof buildPassportPilotTimeToStartEstimate>[0]);

    const html = renderToStaticMarkup(
      <TimeToStartEstimateSummary estimate={estimate} />,
    ).toLowerCase();

    for (const banned of MEASUREMENT_VOCABULARY) {
      expect(html).not.toContain(banned);
    }

    expect(html).toContain('assumed baseline');
    expect(html).toContain('projected difference');
    // The surface states the comparison is against an assumption, in prose.
    expect(html).toContain('not measured');
  });
});
