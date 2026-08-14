import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ActivationPath,
  activationSteps,
} from '@/components/onboarding/ActivationPath';

describe('ActivationPath', () => {
  it('keeps the clinician path to four truth-bounded steps', () => {
    const steps = activationSteps('clinician');

    expect(steps).toHaveLength(4);
    expect(steps.map((step) => step.title)).toEqual([
      'Start with your NPI',
      'See every source state',
      'Keep the record you control',
      'Find a role worth moving for',
    ]);

    const html = renderToStaticMarkup(<ActivationPath compact />);
    expect(html.match(/data-activation-step=/g)).toHaveLength(4);
    expect(html).toContain('An NPI match is a registry identity record, not a license check.');
    expect(html).toContain('Nothing goes to an employer until you choose');
    expect(html).not.toContain('ready now');
    expect(html).not.toContain('eligible');
  });

  it('adds an explicit human employer response only on the pilot path', () => {
    const steps = activationSteps('pilot');
    const html = renderToStaticMarkup(<ActivationPath audience="pilot" />);

    expect(steps).toHaveLength(5);
    expect(html.match(/data-activation-step=/g)).toHaveLength(5);
    expect(html).toContain('Record what the employer did');
    expect(html).toContain('Clarification, a head-start acceptance, or a do-not-proceed decision');
    expect(html).not.toContain('automatic');
  });
});
