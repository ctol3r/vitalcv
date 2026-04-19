/**
 * RevenueReadyCountdown — rendering contract tests.
 *
 * Guarantees pinned:
 *   1. Dual headline metrics render in two cards tagged
 *      data-velocity-lane="credentialing" and "revenue".
 *   2. tabular-nums is applied on the numeric values (design enforcement).
 *   3. Null values render as "Not estimable" — never as "0 days" or "Unknown".
 *   4. Baseline + time-saved context renders when supplied.
 *   5. Disclosure text renders when supplied.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RevenueReadyCountdown } from '@/components/trust/RevenueReadyCountdown';
import type { VelocityCountdown } from '@/lib/clinical/privilege-types';

describe('RevenueReadyCountdown', () => {
  it('renders both lanes with their headline values', () => {
    const countdown: VelocityCountdown = {
      credentialingClearance: '3-5 Days',
      revenueActivation: '18-24 Days',
    };
    const markup = renderToStaticMarkup(<RevenueReadyCountdown countdown={countdown} />);
    expect(markup).toContain('Credentialing_Clearance');
    expect(markup).toContain('3-5 Days');
    expect(markup).toContain('Revenue_Activation');
    expect(markup).toContain('18-24 Days');
    expect(markup).toContain('data-velocity-lane="credentialing"');
    expect(markup).toContain('data-velocity-lane="revenue"');
  });

  it('applies tabular-nums on the numeric values', () => {
    const countdown: VelocityCountdown = {
      credentialingClearance: '3-5 Days',
      revenueActivation: '18-24 Days',
    };
    const markup = renderToStaticMarkup(<RevenueReadyCountdown countdown={countdown} />);
    expect(markup).toContain('tabular-nums');
  });

  it('renders "Not estimable" for null values', () => {
    const countdown: VelocityCountdown = {
      credentialingClearance: null,
      revenueActivation: null,
    };
    const markup = renderToStaticMarkup(<RevenueReadyCountdown countdown={countdown} />);
    const matches = markup.match(/Not estimable/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('renders baseline and time saved context when supplied', () => {
    const countdown: VelocityCountdown = {
      credentialingClearance: '3-5 Days',
      revenueActivation: '18-24 Days',
      baseline: '90-120 Days',
      timeSaved: '~75 Days',
    };
    const markup = renderToStaticMarkup(<RevenueReadyCountdown countdown={countdown} />);
    expect(markup).toContain('Without VitalCV');
    expect(markup).toContain('90-120 Days');
    expect(markup).toContain('Time saved');
    expect(markup).toContain('~75 Days');
  });

  it('renders disclosure copy when supplied', () => {
    const countdown: VelocityCountdown = {
      credentialingClearance: '3-5 Days',
      revenueActivation: '18-24 Days',
      disclosure: 'Commercial payer enrollment remains the trailing constraint.',
    };
    const markup = renderToStaticMarkup(<RevenueReadyCountdown countdown={countdown} />);
    expect(markup).toContain('Commercial payer enrollment remains the trailing constraint.');
  });
});
