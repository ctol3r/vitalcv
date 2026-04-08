import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimeToStartComparison } from '../components/home/TimeToStartComparison';

describe('time-to-start comparison', () => {
  it('renders the homepage comparison copy and accessibility labels', () => {
    const markup = renderToStaticMarkup(<TimeToStartComparison />);

    expect(markup).toContain('Time to Start');
    expect(markup).toContain('Without VitalCV');
    expect(markup).toContain('~90 days average');
    expect(markup).toContain('With VitalCV');
    expect(markup).toContain('~45-60 days');
    expect(markup).toContain('Save ~30-45 days');
    expect(markup).toContain('Estimated based on MGMA median locum rates and industry credentialing benchmarks.');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('Average time-to-start comparison showing about 90 days without VitalCV versus about 45 to 60 days with VitalCV.');
  });
});
