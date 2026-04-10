import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NppesFetchResult } from '../../modules/identity/types';
import {
  buildManualAuditBundle,
  generateManualAuditBundleArtifacts,
  type ManualAuditBundleDependencies,
} from '../manualAuditBundle';

function buildNppesFixture(): NppesFetchResult {
  return {
    payloadHash: 'sha256:test',
    rawPayload: {
      result_count: 1,
      results: [{
        number: '1003000126',
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'ARDALAN',
          last_name: 'ENKESHAFI',
          middle_name: '',
          credential: 'M.D.',
          sole_proprietor: 'NO',
          gender: 'M',
          enumeration_date: '2007-08-31',
          last_updated: '2025-05-28',
          status: 'A',
          name_prefix: '',
          name_suffix: '',
          enumeration_type: 'NPI-1',
        },
        taxonomies: [{
          code: '208M00000X',
          taxonomy_group: '',
          desc: 'Hospitalist',
          state: 'DC',
          license: 'MD600003480',
          primary: true,
        }],
        addresses: [{
          country_code: 'US',
          country_name: 'United States',
          address_purpose: 'LOCATION',
          address_type: 'DOM',
          address_1: '1200 PECAN ST SE',
          city: 'WASHINGTON',
          state: 'DC',
          postal_code: '200322652',
          telephone_number: '777-444-6200',
        }],
        identifiers: [],
        endpoints: [],
        other_names: [],
        created_epoch: 1188577587000,
        last_updated_epoch: 1748459039000,
      }],
    },
  };
}

function buildDependencies(
  overrides: Partial<ManualAuditBundleDependencies> = {},
): ManualAuditBundleDependencies {
  return {
    fetchNppes: jest.fn().mockResolvedValue(buildNppesFixture()),
    checkOig: jest.fn().mockResolvedValue({
      excluded: false,
      matchType: 'NONE',
      matchConfidence: 'HIGH',
      status: 'CLEAR',
      details: 'No exclusion record found.',
      checkedAt: '2026-04-10T12:00:01.000Z',
      source: 'OIG_LEIE',
      leieVersionDate: '2026-04-01',
      dataVersion: '2026-04',
      cacheAge: 'fresh',
      sourceLatency: 'MONTHLY',
      dataFreshness: 'MONTHLY',
      lastVerifiedAt: '2026-04-10T12:00:01.000Z',
      provenance: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
    }),
    checkPecos: jest.fn().mockResolvedValue({
      npi: '1003000126',
      enrolled: true,
      claimState: 'ENROLLED',
      enrollmentType: 'PARTICIPATING',
      observedAt: new Date('2026-04-10T12:00:02.000Z'),
      dataVersion: '2026-Q2',
      dataFreshness: 'QUARTERLY',
      sourceLatency: 'QUARTERLY',
      checkedAt: new Date('2026-04-10T12:00:02.000Z'),
      rawPayload: { source: 'pecos-live-fixture' },
    }),
    now: () => new Date('2026-04-10T12:00:00.000Z'),
    ...overrides,
  };
}

describe('manualAuditBundle', () => {
  test.each([
    {
      name: 'ready',
      deps: buildDependencies(),
      expectedDecision: 'READY',
    },
    {
      name: 'partial',
      deps: buildDependencies({
        checkPecos: jest.fn().mockResolvedValue({
          npi: '1003000126',
          enrolled: null,
          claimState: 'UNKNOWN',
          enrollmentType: null,
          observedAt: new Date('2026-04-10T12:00:02.000Z'),
          dataVersion: '2026-Q2',
          dataFreshness: 'QUARTERLY',
          sourceLatency: 'QUARTERLY',
          checkedAt: new Date('2026-04-10T12:00:02.000Z'),
          rawPayload: {
            source: 'mock-pecos-provider',
            previewOnly: true,
          },
        }),
      }),
      expectedDecision: 'PARTIAL',
    },
    {
      name: 'blocked',
      deps: buildDependencies({
        checkOig: jest.fn().mockResolvedValue({
          excluded: true,
          matchType: 'EXACT',
          matchConfidence: 'HIGH',
          status: 'EXCLUDED',
          details: 'Exact LEIE exclusion record found.',
          checkedAt: '2026-04-10T12:00:01.000Z',
          source: 'OIG_LEIE',
          leieVersionDate: '2026-04-01',
          dataVersion: '2026-04',
          cacheAge: 'fresh',
          sourceLatency: 'MONTHLY',
          dataFreshness: 'MONTHLY',
          lastVerifiedAt: '2026-04-10T12:00:01.000Z',
          provenance: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
        }),
      }),
      expectedDecision: 'BLOCKED',
    },
  ])('decision always present: $name', async ({ deps, expectedDecision }) => {
    const bundle = await buildManualAuditBundle('1003000126', deps);

    expect(bundle.summary.decision).toBe(expectedDecision);
    expect(['READY', 'PARTIAL', 'BLOCKED']).toContain(bundle.summary.decision);
  });

  test('bundle generates in <60 seconds', async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manual-audit-bundle-'));
    const startedAt = Date.now();

    try {
      const { bundle, paths } = await generateManualAuditBundleArtifacts('1003000126', {
        ...buildDependencies(),
        outDir: outputDir,
      });
      const elapsedMs = Date.now() - startedAt;
      const pdf = await fs.readFile(paths.pdfPath);
      const json = await fs.readFile(paths.jsonPath, 'utf8');

      expect(elapsedMs).toBeLessThan(60_000);
      expect(bundle.summary.decision).toBe('READY');
      expect(pdf.subarray(0, 8).toString('utf8')).toBe('%PDF-1.4');
      expect(json).toContain('"decision":"READY"');
    } finally {
      await fs.rm(outputDir, { recursive: true, force: true });
    }
  });
});
