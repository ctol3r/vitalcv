/**
 * @jest-environment node
 * STUB: Config loader validation tests.
 */

import { loadRuntimeConfig } from '@/lib/runtime-config';

const describeIfEnabled = process.env.SKIP_STUB_TESTS === 'true' ? describe.skip : describe;

describeIfEnabled('Runtime config validation (STUB)', () => {
  it('fails fast when required variables are missing', () => {
    expect(() => loadRuntimeConfig({} as NodeJS.ProcessEnv)).toThrow(
      'Missing required environment variables',
    );
  });
});
