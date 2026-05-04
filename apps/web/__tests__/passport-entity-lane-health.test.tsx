import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaneHealthSection } from '@/components/source-health/LaneHealthSection';
import { getLaneSnapshots } from '@/lib/source-health/getLaneSnapshots';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const passportEntityClientPath = resolve(
  __dirname,
  '../app/passport/[id]/PassportEntityClient.tsx',
);

describe('/passport/[id] mounts LaneHealth surface', () => {
  it('imports LaneHealthMount and renders it as a labeled section', () => {
    const source = readFileSync(passportEntityClientPath, 'utf8');

    expect(source).toContain(
      "import { LaneHealthMount } from '@/components/source-health/LaneHealthMount'",
    );
    expect(source).toContain('data-testid="passport-lane-health-mount"');
    expect(source).toContain('aria-label="Source health"');
    expect(source).toContain('<LaneHealthMount heading="Source health" />');
  });

  it('renders cold-start UNKNOWN lanes — never fakes LIVE', () => {
    const snapshots = getLaneSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snap of snapshots) {
      expect(snap.state).toBe('UNKNOWN');
    }

    const markup = renderToStaticMarkup(
      <LaneHealthSection snapshots={snapshots} heading="Source health" />,
    );

    expect(markup).toContain('Source health');
    expect(markup).not.toMatch(/\bLIVE\b/);
  });
});
