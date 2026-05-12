/**
 * Runtime channel taxonomy lockdown.
 *
 * Pins:
 *   - Closed 4-value union (no silent expansion).
 *   - resolveRuntimeChannel resolution order is deterministic.
 *   - Explicit override wins over Vercel detection.
 *   - Preview-with-staging-URL → 'staging', not 'operator_preview'.
 *   - /api/health surfaces runtime_channel field.
 *   - Footer renders null in production, chip otherwise.
 *   - alwaysRender prop forces production chip (for /status page).
 */

import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  RUNTIME_CHANNELS,
  RUNTIME_CHANNEL_LABEL,
  isPreReleaseChannel,
  isProductionChannel,
  narrowRuntimeChannel,
  resolveRuntimeChannel,
  type RuntimeChannel,
} from '../lib/runtime/channel';
import { RuntimeChannelFooter } from '../components/runtime/RuntimeChannelFooter';
import { GET } from '../app/api/health/route';

const SAVE_KEYS = [
  'VITALCV_RUNTIME_CHANNEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'NODE_ENV',
  'VITALCV_STAGING_URL_PATTERN',
] as const;

const saved: Partial<Record<(typeof SAVE_KEYS)[number], string>> = {};

beforeEach(() => {
  for (const k of SAVE_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of SAVE_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('RuntimeChannel — union shape', () => {
  it('contains exactly 4 channels in canonical order', () => {
    expect([...RUNTIME_CHANNELS]).toEqual([
      'local_dev',
      'operator_preview',
      'staging',
      'production',
    ]);
  });

  it('every channel has a label', () => {
    for (const c of RUNTIME_CHANNELS) {
      expect(RUNTIME_CHANNEL_LABEL[c]).toBeDefined();
      expect(RUNTIME_CHANNEL_LABEL[c].length).toBeGreaterThan(0);
    }
  });

  it('label map is frozen', () => {
    expect(Object.isFrozen(RUNTIME_CHANNEL_LABEL)).toBe(true);
  });

  it('no label uses bare-word "Verified"', () => {
    for (const c of RUNTIME_CHANNELS) {
      expect(RUNTIME_CHANNEL_LABEL[c]).not.toMatch(/\bVerified\b/);
    }
  });
});

describe('narrowRuntimeChannel — fail-closed narrowing', () => {
  it('returns the channel for every valid string', () => {
    for (const c of RUNTIME_CHANNELS) {
      expect(narrowRuntimeChannel(c)).toBe(c);
    }
  });

  it('returns null on unknown / case-mismatched / non-string', () => {
    expect(narrowRuntimeChannel('LOCAL_DEV')).toBeNull();
    expect(narrowRuntimeChannel('prod')).toBeNull();
    expect(narrowRuntimeChannel('')).toBeNull();
    expect(narrowRuntimeChannel(null)).toBeNull();
    expect(narrowRuntimeChannel(undefined)).toBeNull();
    expect(narrowRuntimeChannel(0)).toBeNull();
  });
});

describe('resolveRuntimeChannel — resolution order', () => {
  it('returns local_dev when no env is set', () => {
    expect(resolveRuntimeChannel({})).toBe('local_dev');
  });

  it('honors VITALCV_RUNTIME_CHANNEL override (valid)', () => {
    expect(resolveRuntimeChannel({ VITALCV_RUNTIME_CHANNEL: 'staging' })).toBe('staging');
    expect(
      resolveRuntimeChannel({ VITALCV_RUNTIME_CHANNEL: 'production', VERCEL_ENV: 'preview' }),
    ).toBe('production');
  });

  it('ignores invalid VITALCV_RUNTIME_CHANNEL and falls through', () => {
    expect(
      resolveRuntimeChannel({ VITALCV_RUNTIME_CHANNEL: 'rogue', VERCEL_ENV: 'production' }),
    ).toBe('production');
  });

  it('VERCEL_ENV=production → production', () => {
    expect(resolveRuntimeChannel({ VERCEL_ENV: 'production' })).toBe('production');
  });

  it('VERCEL_ENV=preview + staging URL → staging', () => {
    expect(
      resolveRuntimeChannel({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'vitalcv-staging.vercel.app',
      }),
    ).toBe('staging');
    expect(
      resolveRuntimeChannel({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'app-stage.vitalcv.com',
      }),
    ).toBe('staging');
  });

  it('VERCEL_ENV=preview + non-staging URL → operator_preview', () => {
    expect(
      resolveRuntimeChannel({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'vitalcv-pr-123-blockchaincv.vercel.app',
      }),
    ).toBe('operator_preview');
  });

  it('VERCEL_ENV=preview without VERCEL_URL → operator_preview', () => {
    expect(resolveRuntimeChannel({ VERCEL_ENV: 'preview' })).toBe('operator_preview');
  });

  it('custom VITALCV_STAGING_URL_PATTERN overrides default', () => {
    expect(
      resolveRuntimeChannel({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'verify.vitalcv.com',
        VITALCV_STAGING_URL_PATTERN: '^verify\\.',
      }),
    ).toBe('staging');
  });

  it('VERCEL_ENV=development → local_dev', () => {
    expect(resolveRuntimeChannel({ VERCEL_ENV: 'development' })).toBe('local_dev');
  });

  it('NODE_ENV=production without VERCEL_ENV → production (self-hosted)', () => {
    expect(resolveRuntimeChannel({ NODE_ENV: 'production' })).toBe('production');
  });

  it('is deterministic: same env → same channel', () => {
    const env = { VERCEL_ENV: 'preview', VERCEL_URL: 'a-staging-b.vercel.app' } as const;
    const first = resolveRuntimeChannel(env);
    const second = resolveRuntimeChannel(env);
    const third = resolveRuntimeChannel(env);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});

describe('isProductionChannel + isPreReleaseChannel', () => {
  it('only production is the production channel', () => {
    for (const c of RUNTIME_CHANNELS) {
      expect(isProductionChannel(c)).toBe(c === 'production');
    }
  });

  it('all non-production channels are pre-release', () => {
    expect(isPreReleaseChannel('local_dev')).toBe(true);
    expect(isPreReleaseChannel('operator_preview')).toBe(true);
    expect(isPreReleaseChannel('staging')).toBe(true);
    expect(isPreReleaseChannel('production')).toBe(false);
  });
});

describe('/api/health — runtime_channel surface', () => {
  it('returns runtime_channel field in the response body', async () => {
    process.env.VERCEL_ENV = 'production';
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.runtime_channel).toBe('production');
  });

  it('runtime_channel reports operator_preview by default in preview', async () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'vitalcv-pr-1.vercel.app';
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.runtime_channel).toBe('operator_preview');
  });

  it('runtime_channel reports staging when URL matches staging pattern', async () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'vitalcv-staging.vercel.app';
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.runtime_channel).toBe('staging');
  });

  it('runtime_channel reports local_dev when nothing is set', async () => {
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.runtime_channel).toBe('local_dev');
  });

  it('preserves backward-compat config.clerk shape (Wave 136)', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_x';
    const res = await GET();
    const body = (await res.json()) as { config: { clerk: { enabled: boolean; mode: string } } };
    expect(body.config.clerk.enabled).toBe(true);
    expect(body.config.clerk.mode).toBe('production');
  });
});

describe('RuntimeChannelFooter — render shape', () => {
  it('production channel renders nothing by default (silent on customer-facing)', () => {
    const html = renderToStaticMarkup(<RuntimeChannelFooter channel="production" />);
    expect(html).toBe('');
  });

  it('alwaysRender forces production chip', () => {
    const html = renderToStaticMarkup(
      <RuntimeChannelFooter channel="production" alwaysRender />,
    );
    expect(html).toContain('data-runtime-channel="production"');
    expect(html).toContain('Production');
  });

  it('staging renders distinct chip', () => {
    const html = renderToStaticMarkup(<RuntimeChannelFooter channel="staging" />);
    expect(html).toContain('data-runtime-channel="staging"');
    expect(html).toContain('Staging');
  });

  it('operator_preview renders distinct chip', () => {
    const html = renderToStaticMarkup(<RuntimeChannelFooter channel="operator_preview" />);
    expect(html).toContain('data-runtime-channel="operator_preview"');
    expect(html).toContain('Operator preview');
  });

  it('local_dev renders distinct chip', () => {
    const html = renderToStaticMarkup(<RuntimeChannelFooter channel="local_dev" />);
    expect(html).toContain('data-runtime-channel="local_dev"');
    expect(html).toContain('Local development');
  });

  it('every channel chip carries data-testid="runtime-channel-footer"', () => {
    for (const c of RUNTIME_CHANNELS) {
      const html = renderToStaticMarkup(
        <RuntimeChannelFooter channel={c} alwaysRender />,
      );
      expect(html).toContain('data-testid="runtime-channel-footer"');
    }
  });

  it('no chip uses vibrant red/green hex (monochrome)', () => {
    for (const c of RUNTIME_CHANNELS) {
      const html = renderToStaticMarkup(<RuntimeChannelFooter channel={c} alwaysRender />);
      const redLeak = html.match(/#(?:[d-f][0-9a-f]{2})00[0-9a-f]{2}/i);
      const greenLeak = html.match(/#00[0-9a-f]{2}[d-f][0-9a-f]{2}/i);
      expect(redLeak).toBeNull();
      expect(greenLeak).toBeNull();
    }
  });
});

describe('banned-strings scan', () => {
  const LIB = readFileSync(resolve(__dirname, '../lib/runtime/channel.ts'), 'utf8');
  const FOOTER = readFileSync(
    resolve(__dirname, '../components/runtime/RuntimeChannelFooter.tsx'),
    'utf8',
  );
  const ROUTE = readFileSync(resolve(__dirname, '../app/api/health/route.ts'), 'utf8');
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  for (const phrase of BANNED) {
    it(`channel.ts does not contain: ${phrase}`, () => {
      expect(LIB).not.toContain(phrase);
    });
    it(`RuntimeChannelFooter.tsx does not contain: ${phrase}`, () => {
      expect(FOOTER).not.toContain(phrase);
    });
    it(`/api/health route.ts does not contain: ${phrase}`, () => {
      expect(ROUTE).not.toContain(phrase);
    });
  }
});
