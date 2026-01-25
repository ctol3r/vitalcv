/**
 * @jest-environment node
 * STUB: Route existence checks.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const describeIfEnabled = process.env.SKIP_STUB_TESTS === 'true' ? describe.skip : describe;

describeIfEnabled('Route existence (STUB)', () => {
  const appRoot = resolve(__dirname, '..', '..');
  const routes = [
    'app/page.tsx',
    'app/clinician/page.tsx',
    'app/employer/page.tsx',
    'app/issuer/page.tsx',
    'app/demo/page.tsx',
  ];

  it('exposes expected route modules', () => {
    for (const route of routes) {
      const routePath = resolve(appRoot, route);
      expect(existsSync(routePath)).toBe(true);
    }
  });
});
