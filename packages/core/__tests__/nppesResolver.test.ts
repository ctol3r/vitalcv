import { describe, expect, it, vi } from 'vitest';
import {
  isValidNpiChecksum,
  projectMinimalDto,
  resolveNppes,
} from '../src/services/nppesResolver';

function makeResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('isValidNpiChecksum', () => {
  it.each([
    ['1346053246', true],
    ['1234567893', true],
    ['1234567890', false],
    ['1356428912', false],
    ['abc', false],
    ['', false],
    ['12345678901', false],
  ])('Luhn(%s) = %s', (npi, expected) => {
    expect(isValidNpiChecksum(npi)).toBe(expected);
  });
});

describe('projectMinimalDto', () => {
  it('extracts a clean DTO from a populated NPPES result', () => {
    const dto = projectMinimalDto({
      number: '1346053246',
      basic: {
        first_name: '  Mira ',
        last_name: 'Chen',
        middle_name: 'L',
        credential: ' MD ',
      },
      taxonomies: [
        { code: '207R00000X', desc: 'Internal Medicine', primary: true, state: 'CA' },
        { code: '207RH0000X', desc: 'Hospital Medicine', primary: false, state: 'CA' },
      ],
      addresses: [
        { state: 'CA', address_purpose: 'LOCATION' },
        { state: 'NY', address_purpose: 'MAILING' },
      ],
    });
    expect(dto).toEqual({
      firstName: 'Mira',
      lastName: 'Chen',
      credential: 'MD',
      primaryTaxonomy: { code: '207R00000X', desc: 'Internal Medicine' },
      activeState: 'CA',
    });
  });

  it('falls back to the first taxonomy when none is primary', () => {
    const dto = projectMinimalDto({
      taxonomies: [
        { code: '208600000X', desc: 'Surgery' },
        { code: '207R00000X', desc: 'Internal Medicine' },
      ],
    });
    expect(dto.primaryTaxonomy.code).toBe('208600000X');
  });

  it('handles missing optional fields with null', () => {
    const dto = projectMinimalDto({});
    expect(dto).toEqual({
      firstName: null,
      lastName: null,
      credential: null,
      primaryTaxonomy: { code: null, desc: null },
      activeState: null,
    });
  });

  it('treats empty/whitespace fields as null', () => {
    const dto = projectMinimalDto({
      basic: { first_name: '', last_name: '   ', credential: ' ' },
    });
    expect(dto.firstName).toBeNull();
    expect(dto.lastName).toBeNull();
    expect(dto.credential).toBeNull();
  });

  it('uses LOCATION-purpose address state when no taxonomy state is set', () => {
    const dto = projectMinimalDto({
      addresses: [
        { state: 'NY', address_purpose: 'MAILING' },
        { state: 'CA', address_purpose: 'LOCATION' },
      ],
    });
    expect(dto.activeState).toBe('CA');
  });
});

describe('resolveNppes outcomes', () => {
  it('returns "found" with a projected DTO on 200 + populated results', async () => {
    const fetchImpl = vi.fn(async () =>
      makeResponse({
        result_count: 1,
        results: [
          {
            number: '1346053246',
            basic: { first_name: 'Mira', last_name: 'Chen', credential: 'MD' },
            taxonomies: [
              {
                code: '207R00000X',
                desc: 'Internal Medicine',
                primary: true,
                state: 'CA',
              },
            ],
          },
        ],
      }),
    );
    const out = await resolveNppes('1346053246', { fetchImpl });
    expect(out.kind).toBe('found');
    if (out.kind !== 'found') return;
    expect(out.provider.firstName).toBe('Mira');
    expect(out.provider.primaryTaxonomy.code).toBe('207R00000X');
  });

  it('returns "not_found" when CMS reports result_count: 0', async () => {
    const fetchImpl = vi.fn(async () =>
      makeResponse({ result_count: 0, results: [] }),
    );
    const out = await resolveNppes('1346053246', { fetchImpl });
    expect(out.kind).toBe('not_found');
  });

  it('returns "upstream_error" with status on non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('boom', { status: 503 }),
    );
    const out = await resolveNppes('1346053246', { fetchImpl });
    expect(out.kind).toBe('upstream_error');
    if (out.kind === 'upstream_error') expect(out.status).toBe(503);
  });

  it('returns "upstream_error" 502 when CMS returns non-JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('not json', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );
    const out = await resolveNppes('1346053246', { fetchImpl });
    expect(out.kind).toBe('upstream_error');
  });

  it('returns "network_error" when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED 10.0.0.1');
    });
    const out = await resolveNppes('1346053246', { fetchImpl });
    expect(out.kind).toBe('network_error');
    if (out.kind === 'network_error') {
      expect(out.detail).toContain('ECONNREFUSED');
    }
  });

  it('honors apiBase override (offline mirror)', async () => {
    let calledUrl = '';
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      calledUrl = typeof input === 'string' ? input : input.toString();
      return makeResponse({ result_count: 0, results: [] });
    });
    await resolveNppes('1346053246', {
      fetchImpl,
      apiBase: 'https://demo-mirror.example.com/nppes/',
    });
    expect(calledUrl).toContain('demo-mirror.example.com');
    expect(calledUrl).toContain('number=1346053246');
    expect(calledUrl).toContain('version=2.1');
  });
});
