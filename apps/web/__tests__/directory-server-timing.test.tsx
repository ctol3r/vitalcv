/**
 * directory-server-timing.test.tsx — the cold-render waterfall instrument.
 *
 * /directory/[npi] cold renders were measured at 8.22–8.30s in production
 * against 0.15–0.53s warm, with upstream latency already disproven by direct
 * measurement. These tests pin the instrument added to attribute that time:
 * every render of the page must carry its span timings, in standard
 * Server-Timing field-value syntax, in the document it produced.
 *
 * Why the document and not an HTTP header: an App Router server-component
 * page has no API that sets a response header, and the page is ISR — a
 * header would describe the cached response it rides on, not the render
 * being measured. The carrier is an inert
 * `<script type="application/server-timing">` plus a metadata-phase meta tag.
 *
 * The page is rendered for real (renderToStaticMarkup, per the
 * issuer-receipt-candidate.test.ts pattern) with the upstream fetch modules
 * mocked — a source scan would prove a string exists, not that a render
 * emits it.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectoryTiming } from '@/lib/directory/serverTiming';
import { mapNppesResult } from '@/lib/clinician-record/nppes';

vi.mock('@/lib/clinician-record/nppes', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/clinician-record/nppes')>();
  return {
    ...original,
    fetchNppesRecord: vi.fn(),
  };
});

vi.mock('@/lib/clinician-record/cmsClinicians', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/clinician-record/cmsClinicians')>();
  return {
    ...original,
    fetchCmsClinicianRows: vi.fn(),
  };
});

import { fetchNppesRecord } from '@/lib/clinician-record/nppes';
import { fetchCmsClinicianRows } from '@/lib/clinician-record/cmsClinicians';
import ProviderDirectoryPage, {
  generateMetadata,
} from '../app/directory/[npi]/page';

/** A minimal but valid NPPES result — enough for the page to render fully. */
const NPPES_RESULT = {
  number: '1003000126',
  enumeration_type: 'NPI-1',
  basic: {
    first_name: 'ARDALAN',
    last_name: 'ENKESHAFI',
    credential: 'M.D.',
    status: 'A',
    enumeration_date: '2005-05-23',
    last_updated: '2007-07-08',
    sole_proprietor: 'NO',
    sex: 'M',
  },
  addresses: [
    {
      address_purpose: 'LOCATION',
      address_type: 'DOM',
      address_1: '900 SETON DR',
      city: 'CUMBERLAND',
      state: 'MD',
      postal_code: '215021854',
      country_code: 'US',
      telephone_number: '301-555-0100',
    },
  ],
  taxonomies: [
    {
      code: '207R00000X',
      desc: 'Internal Medicine',
      primary: true,
      state: 'MD',
      license: 'D0000000',
    },
  ],
  identifiers: [],
  endpoints: [],
  other_names: [],
  practiceLocations: [],
} as unknown as Record<string, unknown>;

const NPI = '1003000126';

beforeEach(() => {
  vi.mocked(fetchNppesRecord).mockResolvedValue({
    reading: mapNppesResult(NPPES_RESULT),
    retrievedAt: '2026-08-15T00:00:00.000Z',
  });
  vi.mocked(fetchCmsClinicianRows).mockResolvedValue({
    state: 'not_listed',
    rows: [],
    retrievedAt: '2026-08-15T00:00:00.000Z',
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('DirectoryTiming helper', () => {
  it('records spans in execution order and formats Server-Timing syntax', async () => {
    const timing = new DirectoryTiming('page', NPI);
    await timing.measure('first', async () => 'a');
    timing.measureSync('second', () => 'b');

    const names = timing.getSpans().map((s) => s.name);
    expect(names).toEqual(['first', 'second']);
    expect(timing.headerValue()).toMatch(
      /^first;dur=\d+(\.\d)?, second;dur=\d+(\.\d)?$/,
    );
  });

  it('records the span even when the measured step throws', async () => {
    const timing = new DirectoryTiming('page', NPI);
    await expect(
      timing.measure('failing', () => Promise.reject(new Error('upstream down'))),
    ).rejects.toThrow('upstream down');
    expect(timing.getSpans().map((s) => s.name)).toEqual(['failing']);
  });

  it('logs one structured line only when DIRECTORY_TIMING=1', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const silent = new DirectoryTiming('page', NPI);
      silent.measureSync('x', () => 1);
      silent.log();
      expect(spy).not.toHaveBeenCalled();

      vi.stubEnv('DIRECTORY_TIMING', '1');
      const loud = new DirectoryTiming('page', NPI);
      loud.measureSync('x', () => 1);
      loud.log();
      expect(spy).toHaveBeenCalledTimes(1);

      const line = JSON.parse(spy.mock.calls[0][0] as string);
      expect(line.event).toBe('directory_timing');
      expect(line.route).toBe('/directory/[npi]');
      expect(line.phase).toBe('page');
      // Correlation key, not anonymization — and never the raw NPI.
      expect(line.npiHash).toMatch(/^[0-9a-f]{12}$/);
      expect(JSON.stringify(line)).not.toContain(NPI);
      expect(line.spans.x).toBeTypeOf('number');
      expect(line.totalMs).toBeTypeOf('number');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('page render carries its timing spans', () => {
  it('embeds Server-Timing spans for nppes, cms, assemble and jsonld', async () => {
    const html = renderToStaticMarkup(
      await ProviderDirectoryPage({ params: Promise.resolve({ npi: NPI }) }),
    );

    const carrier = html.match(
      /<script type="application\/server-timing" id="directory-server-timing">([^<]*)<\/script>/,
    );
    expect(carrier, 'timing carrier missing from rendered page').not.toBeNull();

    const value = carrier![1];
    expect(value).toMatch(/nppes;dur=\d+(\.\d)?/);
    expect(value).toMatch(/cms;dur=\d+(\.\d)?/);
    expect(value).toMatch(/assemble;dur=\d+(\.\d)?/);
    expect(value).toMatch(/jsonld;dur=\d+(\.\d)?/);
  });

  it('does not change what the reader sees: the carrier is inert markup', async () => {
    const html = renderToStaticMarkup(
      await ProviderDirectoryPage({ params: Promise.resolve({ npi: NPI }) }),
    );
    // The record itself still renders around the instrument.
    expect(html).toContain('ARDALAN');
    expect(html).toContain('Public registry record');
    // An unknown script type is never executed and never displayed.
    expect(html).not.toMatch(/application\/server-timing"[^>]*>\s*[^<]*<script/);
  });

  it('emits metadata-phase spans through the metadata other-tag', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ npi: NPI }),
    });
    const other = (metadata.other ?? {}) as Record<string, string>;
    expect(other['server-timing-metadata']).toMatch(/nppes;dur=\d+(\.\d)?/);
    expect(other['server-timing-metadata']).toMatch(/assemble;dur=\d+(\.\d)?/);
  });

  it('keeps the noindex fallback untimed-but-logged when the record is unreadable', async () => {
    vi.mocked(fetchNppesRecord).mockResolvedValue(null);
    const metadata = await generateMetadata({
      params: Promise.resolve({ npi: NPI }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.other).toBeUndefined();
  });
});
