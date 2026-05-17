/**
 * source-health-remediation-render.test.tsx
 *
 * Render-level test for the SourceHealthPanel's remediation-hint
 * integration. The panel's parent component is a 'use client' shell
 * that fetches `/api/internal/source-health` on mount, which makes a
 * full mount-and-await test fragile. This file instead renders the
 * exact same hint-row JSX shape that `SourceHealthPanel.tsx:178-193`
 * emits, parameterised across the six lane states named in the
 * Codex finding (gated, stale, critical, accessRequired,
 * reviewRequired, unavailable), and asserts that:
 *
 *   1. the hint paragraph renders for each state with the
 *      operator-action copy from the hint map;
 *   2. the rendered DOM exposes the diagnostic data-attributes the
 *      panel relies on (`data-hint-rule`, `data-hint-tone`);
 *   3. the rendered copy never makes a decision-grade claim
 *      (no "approved", "accepted", "final", "ready", "verified"
 *      anywhere; "decision-grade" appears only in disclaim
 *      constructions);
 *   4. each hint contains an operator-action verb / phrase from a
 *      vetted list ("Confirm", "Refresh", "Provision", "Route", or
 *      a "Do not …" disclaim).
 *
 * If the SourceHealthPanel ever inlines the hint copy or drops the
 * data-attributes, the assertions on the production JSX shape in
 * `source-health-remediation-hints.test.ts` plus the unit tests on
 * `getRemediationHint()` keep the regression surface covered.
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  getRemediationHint,
  type RemediationHint,
} from '@/lib/source-health/remediationHints';
import type {
  CanonicalSourceCoverageState,
  SourceHealthOperatorStatus,
} from '@vitalcv/trust-state';

// ── JSX shape mirror — must stay in lock-step with the production
//    block at apps/web/components/pilot-ops/SourceHealthPanel.tsx:178-193.
function hintToneClasses(tone: RemediationHint['tone']): string {
  switch (tone) {
    case 'critical':
      return 'text-rose-400/80';
    case 'warn':
      return 'text-amber-400/80';
    case 'info':
      return 'text-sky-400/70';
    default:
      return 'text-zinc-400/70';
  }
}

function HintRow({
  sourceId,
  operatorStatus,
  coverageState,
}: {
  sourceId: string;
  operatorStatus?: SourceHealthOperatorStatus;
  coverageState?: CanonicalSourceCoverageState;
}) {
  const hint = getRemediationHint({ sourceId, operatorStatus, coverageState });
  if (!hint) return null;
  return (
    <p
      className={`mt-0.5 text-[10px] ${hintToneClasses(hint.tone)}`}
      data-testid="source-health-remediation-hint"
      data-hint-rule={hint.rule}
      data-hint-tone={hint.tone}
    >
      → {hint.copy}
    </p>
  );
}

// ── Six lane states from the Codex finding.
interface LaneCase {
  label: string;
  props: {
    sourceId: string;
    operatorStatus?: SourceHealthOperatorStatus;
    coverageState?: CanonicalSourceCoverageState;
  };
  expectedRule: RemediationHint['rule'];
  expectedTone: RemediationHint['tone'];
  /** Substrings the rendered copy MUST contain. */
  contains: string[];
  /**
   * Whether "decision-grade" is allowed in the rendered copy. The
   * truth contract permits "decision-grade" only in a disclaim
   * construction ("Do not treat … as decision-grade …" or
   * "before treating … as decision-grade").
   */
  decisionGradeMustBeDisclaimer: boolean;
}

const LANE_CASES: LaneCase[] = [
  {
    label: 'GATED',
    props: { sourceId: 'STATE_BOARD', coverageState: 'gated' },
    expectedRule: 'gated',
    expectedTone: 'warn',
    contains: ['Institutional access required', 'access-required before review'],
    decisionGradeMustBeDisclaimer: false,
  },
  {
    label: 'STALE',
    props: { sourceId: 'NPPES_API', operatorStatus: 'STALE' },
    expectedRule: 'stale',
    expectedTone: 'warn',
    contains: ['Refresh source probe', 'route to operator review'],
    decisionGradeMustBeDisclaimer: false,
  },
  {
    label: 'CRITICAL',
    props: { sourceId: 'NPPES_API', operatorStatus: 'CRITICAL' },
    expectedRule: 'critical',
    expectedTone: 'critical',
    contains: ['Source probe failing', 'do not rely on this lane'],
    decisionGradeMustBeDisclaimer: false,
  },
  {
    label: 'accessRequired',
    props: { sourceId: 'STATE_BOARD', coverageState: 'accessRequired' },
    expectedRule: 'access_required',
    expectedTone: 'warn',
    contains: ['Operator credentials required', 'route the candidate to manual review'],
    decisionGradeMustBeDisclaimer: false,
  },
  {
    label: 'reviewRequired',
    props: { sourceId: 'OIG_LEIE', coverageState: 'reviewRequired' },
    expectedRule: 'review_required',
    expectedTone: 'warn',
    // The disclaim "before treating it as decision-grade" is the
    // only place "decision-grade" may appear in the panel.
    contains: ['Lane signal is ambiguous', 'Route to operator review'],
    decisionGradeMustBeDisclaimer: true,
  },
  {
    label: 'unavailable',
    props: { sourceId: 'PECOS_PUBLIC', coverageState: 'unavailable' },
    expectedRule: 'unavailable',
    expectedTone: 'critical',
    // The disclaim "Do not treat this lane as decision-grade …" is
    // the only place "decision-grade" may appear in the panel.
    contains: ['Source unavailable', 'Do not treat this lane as decision-grade'],
    decisionGradeMustBeDisclaimer: true,
  },
];

// Words that must NEVER appear in a hint's rendered copy. Each is a
// completion / resolution claim that the operator-action contract
// forbids: the hint exists precisely because the lane is NOT in any
// of these states.
const FORBIDDEN_RESOLUTION_WORDS = ['approved', 'accepted', 'final', 'ready', 'verified'];

// Operator-action signals — every hint must contain at least one.
const OPERATOR_ACTION_SIGNALS = [
  /\bConfirm\b/,
  /\bRefresh\b/,
  /\bRoute\b/,
  /\bProvision\b/,
  /\bCheck\b/,
  /\bDo not\b/,
];

describe('SourceHealthPanel — remediation hint render', () => {
  for (const lane of LANE_CASES) {
    describe(`lane state: ${lane.label}`, () => {
      const html = renderToStaticMarkup(<HintRow {...lane.props} />);

      it('renders a remediation-hint paragraph', () => {
        expect(html).toContain('data-testid="source-health-remediation-hint"');
      });

      it(`carries the expected hint rule (${lane.expectedRule}) and tone (${lane.expectedTone})`, () => {
        expect(html).toContain(`data-hint-rule="${lane.expectedRule}"`);
        expect(html).toContain(`data-hint-tone="${lane.expectedTone}"`);
      });

      it('contains the documented operator-action copy', () => {
        for (const fragment of lane.contains) {
          expect(html, `${lane.label} hint missing fragment: ${fragment}`)
            .toContain(fragment);
        }
      });

      it('contains at least one operator-action verb / disclaim', () => {
        const matched = OPERATOR_ACTION_SIGNALS.some((re) => re.test(html));
        expect(matched, `${lane.label} hint had no operator-action signal in:\n${html}`).toBe(true);
      });

      it('never makes a decision-grade claim — no "approved/accepted/final/ready/verified"', () => {
        for (const word of FORBIDDEN_RESOLUTION_WORDS) {
          const wordRe = new RegExp(`\\b${word}\\b`, 'i');
          expect(html, `${lane.label} hint contained forbidden resolution word: ${word}`)
            .not.toMatch(wordRe);
        }
      });

      it(
        lane.decisionGradeMustBeDisclaimer
          ? 'contains "decision-grade" only inside a disclaim construction'
          : 'does not contain "decision-grade" at all',
        () => {
          if (!lane.decisionGradeMustBeDisclaimer) {
            expect(html).not.toMatch(/decision-grade/i);
            return;
          }
          // When "decision-grade" appears, it must be in a disclaim
          // construction. Accepted shapes:
          //   - "Do not treat … as decision-grade …"
          //   - "before treating … as decision-grade"
          //   - "until a fresh check succeeds" (implicit disclaim,
          //     paired with "Do not treat")
          expect(html).toMatch(
            /(do not\s+(?:treat|rely)[^.]*decision-grade|before[^.]*decision-grade)/i,
          );
        },
      );
    });
  }

  it('renders nothing when the lane is healthy + checked (no hint)', () => {
    const html = renderToStaticMarkup(
      <HintRow sourceId="NPPES_API" operatorStatus="HEALTHY" coverageState="checked" />,
    );
    // React renders `null` as the empty string.
    expect(html).toBe('');
  });
});
