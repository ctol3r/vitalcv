/**
 * W4-PR216A — dashboard hydration status lockdown.
 *
 * Pins the truth-contract behavior of the hydration-status module so
 * regressions cannot silently coerce upstream failures back into
 * "no data" without surfacing the failure.
 *
 * Doctrine link: governance-runtime fail-closed principle — unknown
 * outcomes are NOT classified as healthy.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyFetchOutcome,
  deriveHydrationAggregate,
  buildHydrationStatus,
  type ChannelStatusEntry,
} from '../lib/mobile/hydrationStatus';

describe('W4-PR216A — classifyFetchOutcome', () => {
  it('signed-out, not attempted → skipped-unauthenticated', () => {
    expect(classifyFetchOutcome(false, null, false)).toBe('skipped-unauthenticated');
  });

  it('signed-in, attempted, null result → failed (not silently absent)', () => {
    expect(classifyFetchOutcome(true, null, true)).toBe('failed');
  });

  it('signed-in, attempted, real object → ok', () => {
    expect(classifyFetchOutcome(true, { workspace: {} }, true)).toBe('ok');
  });

  it('signed-in, attempted, empty array → ok (the upstream confirmed empty)', () => {
    expect(classifyFetchOutcome(true, [], true)).toBe('ok');
  });

  it('signed-in but channel not attempted (e.g. no NPI) → skipped-unauthenticated', () => {
    // We collapse "skipped because we did not have the prerequisite"
    // into the same skipped bucket; aggregate logic excludes it from
    // the verdict.
    expect(classifyFetchOutcome(true, null, false)).toBe('skipped-unauthenticated');
  });

  it('signed-in, attempted, undefined result → failed', () => {
    expect(classifyFetchOutcome(true, undefined, true)).toBe('failed');
  });
});

describe('W4-PR216A — deriveHydrationAggregate', () => {
  const ch = (status: ChannelStatusEntry['status']): ChannelStatusEntry => ({
    channel: 'workspace',
    status,
  });

  it('all ok → ok', () => {
    expect(deriveHydrationAggregate([ch('ok'), ch('ok')])).toBe('ok');
  });

  it('ok + failed → degraded', () => {
    expect(deriveHydrationAggregate([ch('ok'), ch('failed')])).toBe('degraded');
  });

  it('all failed → failed (not ok, not empty)', () => {
    expect(deriveHydrationAggregate([ch('failed'), ch('failed')])).toBe('failed');
  });

  it('all skipped → empty (signed-out dashboards)', () => {
    expect(
      deriveHydrationAggregate([ch('skipped-unauthenticated'), ch('skipped-unauthenticated')]),
    ).toBe('empty');
  });

  it('mix of skipped + ok → ok (signed-in dashboard with optional channels skipped)', () => {
    expect(deriveHydrationAggregate([ch('skipped-unauthenticated'), ch('ok')])).toBe('ok');
  });

  it('mix of skipped + failed → failed (signed-in dashboard with everything fetched failing)', () => {
    expect(deriveHydrationAggregate([ch('skipped-unauthenticated'), ch('failed')])).toBe('failed');
  });

  it('empty channel list → empty', () => {
    expect(deriveHydrationAggregate([])).toBe('empty');
  });
});

describe('W4-PR216A — buildHydrationStatus', () => {
  it('returns a frozen status object', () => {
    const s = buildHydrationStatus([
      { channel: 'workspace', status: 'ok' },
    ]);
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('returns a frozen channels array', () => {
    const s = buildHydrationStatus([
      { channel: 'workspace', status: 'ok' },
    ]);
    expect(Object.isFrozen(s.channels)).toBe(true);
  });

  it('anyChannelOk is true when aggregate is ok', () => {
    const s = buildHydrationStatus([{ channel: 'workspace', status: 'ok' }]);
    expect(s.anyChannelOk).toBe(true);
  });

  it('anyChannelOk is true when aggregate is degraded', () => {
    const s = buildHydrationStatus([
      { channel: 'workspace', status: 'ok' },
      { channel: 'applications', status: 'failed' },
    ]);
    expect(s.anyChannelOk).toBe(true);
  });

  it('anyChannelOk is false when aggregate is failed', () => {
    const s = buildHydrationStatus([{ channel: 'workspace', status: 'failed' }]);
    expect(s.anyChannelOk).toBe(false);
  });

  it('anyChannelOk is false when aggregate is empty', () => {
    const s = buildHydrationStatus([
      { channel: 'workspace', status: 'skipped-unauthenticated' },
    ]);
    expect(s.anyChannelOk).toBe(false);
  });

  it('does not mutate input channel array (defensive copy)', () => {
    const channels: ChannelStatusEntry[] = [
      { channel: 'workspace', status: 'ok' },
    ];
    const s = buildHydrationStatus(channels);
    channels.push({ channel: 'applications', status: 'failed' });
    expect(s.channels).toHaveLength(1);
  });

  it('represents an all-failed signed-in dashboard as failed (not ok-with-no-data)', () => {
    const s = buildHydrationStatus([
      { channel: 'workspace', status: 'failed' },
      { channel: 'applications', status: 'failed' },
      { channel: 'profileCompleteness', status: 'failed' },
      { channel: 'proof', status: 'failed' },
      { channel: 'opportunities', status: 'failed' },
    ]);
    expect(s.aggregate).toBe('failed');
    expect(s.anyChannelOk).toBe(false);
  });

  it('represents the signed-out dashboard (everything skipped + opportunities ok) as ok', () => {
    // opportunities is fetched regardless of sign-in state, so it can
    // pull ok while every authenticated channel is skipped.
    const s = buildHydrationStatus([
      { channel: 'workspace', status: 'skipped-unauthenticated' },
      { channel: 'applications', status: 'skipped-unauthenticated' },
      { channel: 'opportunities', status: 'ok' },
      { channel: 'profileCompleteness', status: 'skipped-unauthenticated' },
      { channel: 'proof', status: 'skipped-unauthenticated' },
    ]);
    expect(s.aggregate).toBe('ok');
  });
});

describe('W4-PR216A — server.ts source-level audit', () => {
  it('loadClinicianMobileData attaches hydrationStatus to its return value', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/mobile/server.ts'),
      'utf8',
    );
    expect(src).toContain('hydrationStatus');
    expect(src).toContain('buildHydrationStatus');
    // The fetch-classification import must remain — silent regression
    // back to null-on-failure is what this PR is designed to prevent.
    expect(src).toContain('classifyFetchOutcome');
  });
});
