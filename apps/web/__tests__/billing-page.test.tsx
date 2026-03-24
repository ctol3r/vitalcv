import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('/billing page', () => {
  it('renders shared pricing plans and explicit launch limitations', async () => {
    const { default: BillingPage } = await import('../app/billing/page');
    const markup = renderToStaticMarkup(<BillingPage />);

    expect(markup).toContain('Billing &amp; API Access');
    expect(markup).toContain('Starter');
    expect(markup).toContain('Growth');
    expect(markup).toContain('Enterprise');
    expect(markup).toContain('Public checkout remains gated until the launch gate closes.');
    expect(markup).toContain('No-double-pay repeat views');
    expect(markup).toContain('Government fee pass-through example');
  });
});
