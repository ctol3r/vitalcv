/**
 * freshness-meter.test.tsx — W3 FreshnessMeter + ExpiryHorizon.
 *
 * Guards the rendered contract: source + cadence line + tone, honest
 * "not observed" for unchecked lanes, expiry markers/rows, no looping
 * spinner (motion doctrine), and no bare "Verified".
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { FreshnessMeter, ExpiryHorizon } from '@/design-system/components/FreshnessMeter';
import { REGULATORY_WINDOWS } from '@/lib/freshness/regulatoryWindows';

const NOW = '2026-07-18T00:00:00Z';

describe('FreshnessMeter', () => {
  it('renders source, tone, and a last-checked / next-due cadence line', () => {
    const html = renderToStaticMarkup(
      <FreshnessMeter
        source="OIG LEIE exclusions"
        checkedAt="2026-07-16T00:00:00Z"
        window={REGULATORY_WINDOWS.sanctionScreening}
        now={NOW}
      />,
    );
    expect(html).toContain('OIG LEIE exclusions');
    expect(html).toContain('data-freshness-tone="current"');
    expect(html).toContain('last checked 2026-07-16');
    expect(html).toContain('next due');
    expect(html).toContain('NCQA CR.5');
  });

  it('names the consequence and escalates when stale', () => {
    const html = renderToStaticMarkup(
      <FreshnessMeter
        source="State license"
        checkedAt="2026-06-15T00:00:00Z"
        window={REGULATORY_WINDOWS.licenseMonitoring}
        now={NOW}
      />,
    );
    expect(html).toContain('data-freshness-tone="stale"');
    expect(html).toContain('acceptance pauses');
    expect(html).toContain('data-escalation="urgent"');
  });

  it('renders "not observed" for an unchecked lane, never a false freshness', () => {
    const html = renderToStaticMarkup(
      <FreshnessMeter
        source="NPDB"
        checkedAt={null}
        window={REGULATORY_WINDOWS.primarySourceVerification}
        now={NOW}
      />,
    );
    expect(html).toContain('data-freshness-tone="unknown"');
    expect(html).toContain('not observed');
  });

  it('uses no looping spinner (motion doctrine)', () => {
    const html = renderToStaticMarkup(
      <FreshnessMeter source="X" checkedAt={null} window={REGULATORY_WINDOWS.sanctionScreening} now={NOW} />,
    );
    expect(html).not.toContain('animate-spin');
  });
});

describe('ExpiryHorizon', () => {
  const items = [
    { label: 'State license', expiresAt: '2026-08-10' },
    { label: 'DEA registration', expiresAt: '2026-09-01' },
    { label: 'Board certification', expiresAt: '2027-02-01' },
    { label: 'Malpractice', expiresAt: '2026-06-01' }, // already past
  ];

  it('renders a row per item with days-to-expiry', () => {
    const html = renderToStaticMarkup(<ExpiryHorizon items={items} now={NOW} />);
    for (const it of items) expect(html).toContain(it.label);
    expect(html).toContain('data-expiry-horizon');
    expect(html).toContain('12-month horizon');
  });

  it('zones the nearest expiry as urgent and a far one as far', () => {
    const html = renderToStaticMarkup(<ExpiryHorizon items={items} now={NOW} />);
    expect(html).toContain('data-expiry-zone="urgent"'); // state license ~23d
    expect(html).toContain('data-expiry-zone="far"'); // board cert ~198d
  });

  it('shows a past-expiry item as expired, not as valid', () => {
    const html = renderToStaticMarkup(<ExpiryHorizon items={items} now={NOW} />);
    expect(html).toMatch(/expired \d+d ago/);
  });
});

describe('W3 — no bare "Verified"', () => {
  it('neither component renders the bare status word', () => {
    const a = renderToStaticMarkup(
      <FreshnessMeter source="OIG" checkedAt="2026-07-10T00:00:00Z" window={REGULATORY_WINDOWS.sanctionScreening} now={NOW} />,
    );
    const b = renderToStaticMarkup(
      <ExpiryHorizon items={[{ label: 'License', expiresAt: '2026-08-10' }]} now={NOW} />,
    );
    expect(/>\s*Verified\s*</.test(a + b)).toBe(false);
  });
});
