import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('/billing page', () => {
  it('renders shared pricing plans and explicit launch limitations', async () => {
    const { default: BillingPage } = await import('../app/billing/page');
    const markup = renderToStaticMarkup(<BillingPage />);

    expect(markup).toContain('Pricing &amp; Access');
    expect(markup).toContain('Starter');
    expect(markup).toContain('Growth');
    expect(markup).toContain('Enterprise');
    expect(markup).toContain('Self-serve checkout activates after pilot gate closes');
    expect(markup).toContain('No-double-pay repeat views');
    expect(markup).toContain('Government fee pass-through example');
  });

  it('routes buyer CTAs through the approved access mailto flow instead of live checkout', async () => {
    const { default: BillingPage } = await import('../app/billing/page');
    const markup = renderToStaticMarkup(<BillingPage />);

    expect(markup).toContain('mailto:access@vitalcv.com?subject=VitalCV+organization+access+request');
    expect(markup).toContain('mailto:access@vitalcv.com?subject=VitalCV+STARTER+access+request');
    expect(markup).toContain('mailto:access@vitalcv.com?subject=VitalCV+GROWTH+access+request');
    expect(markup).toContain('mailto:access@vitalcv.com?subject=VitalCV+ENTERPRISE+access+request');
    expect(markup).not.toContain('checkout.vitalcv.com');
    expect(markup).not.toContain('stripe');
  });
});
