/**
 * @jest-environment node
 * STUB: Demo flow contract presence tests.
 */

import { DemoState } from '@/lib/demo-flow';

const describeIfEnabled = process.env.SKIP_STUB_TESTS === 'true' ? describe.skip : describe;

describeIfEnabled('Demo flow contracts (STUB)', () => {
  it('exports expected demo states', () => {
    expect(DemoState.INTRO).toBe('INTRO');
    expect(DemoState.ISSUANCE).toBe('ISSUANCE');
    expect(DemoState.PRESENTATION).toBe('PRESENTATION');
    expect(DemoState.VERIFICATION).toBe('VERIFICATION');
    expect(DemoState.COMPLETE).toBe('COMPLETE');
  });
});
