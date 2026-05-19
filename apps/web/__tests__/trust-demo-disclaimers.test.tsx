/**
 * trust-demo-disclaimers.test.tsx
 *
 * Every trust-surface route must render the canonical demo
 * disclaimer ("Demo data — not a real credentialing decision.") AND
 * a controlled-document classification flagged DEMO / FIXTURE.
 *
 * The test renders each route page via Next.js's async page contract
 * and inspects the SSR markup.
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const ROUTES: Array<{
  label: string;
  importer: () => Promise<{ default: (props: unknown) => Promise<React.ReactElement> | React.ReactElement }>;
  params?: Record<string, string>;
}> = [
  {
    label: '/passport/[npi]',
    importer: () => import('../app/trust-canon/passport/[npi]/page'),
    params: { npi: '1346053246' },
  },
  {
    label: '/verify/[receipt]',
    importer: () => import('../app/trust-canon/verify/[receipt]/page'),
    params: { receipt: 'rcpt_demo_004' },
  },
  {
    label: '/replay',
    importer: () => import('../app/trust-canon/replay/page'),
  },
  {
    label: '/receipt/[id]',
    importer: () => import('../app/trust-canon/receipt/[id]/page'),
    params: { id: 'rcpt_demo_004' },
  },
  {
    label: '/trust',
    importer: () => import('../app/trust-canon/trust/page'),
  },
];

async function renderRoute(
  importer: () => Promise<{ default: (props: unknown) => Promise<React.ReactElement> | React.ReactElement }>,
  params: Record<string, string> | undefined,
): Promise<string> {
  const mod = await importer();
  const props = params ? { params: Promise.resolve(params) } : {};
  const element = await mod.default(props);
  return renderToStaticMarkup(element);
}

describe('trust surfaces — demo disclaimers', () => {
  for (const route of ROUTES) {
    it(`${route.label} renders the canonical demo banner`, async () => {
      const html = await renderRoute(route.importer, route.params);
      expect(html).toMatch(
        /Demo data — not a real credentialing decision\./,
      );
      expect(html).toContain('data-testid="trust-demo-banner"');
    });

    it(`${route.label} carries a controlled-document footer`, async () => {
      const html = await renderRoute(route.importer, route.params);
      expect(html).toContain('data-testid="trust-control-footer"');
    });

    it(`${route.label} classification stripe includes "DEMO" or "FIXTURE"`, async () => {
      const html = await renderRoute(route.importer, route.params);
      expect(html).toMatch(/DEMO|FIXTURE/);
    });
  }
});
