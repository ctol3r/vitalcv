/**
 * caBreezeLiveLookup.test.ts — fail-closed contract for the CA DCA BreEZe
 * live lookup (ships dark behind STATE_BOARD_MODE=live).
 *
 * Structure-faithful fixtures: the HTML shapes below mirror the BreEZe
 * results table the parser targets (`tr.searchResults` rows). They are NOT
 * recorded from the live site — live validation is a documented go-live
 * precondition. Until then the contract under test is the honesty rules:
 * nothing ambiguous may ever parse into a definitive license status.
 */

import {
  createCaBreezeLiveLookup,
  type ProviderNameRecord,
} from '../src/services/providers/connectors/caBreezeLiveLookup';

const FIXED_NOW = new Date('2026-07-12T00:00:00.000Z');

const NAME: ProviderNameRecord = { firstName: 'Sarah', lastName: 'Chen' };

function resultsPage(rows: string): string {
  return `<html><body><table class="table">${rows}</table></body></html>`;
}

function physicianRow(input: {
  name?: string;
  licenseNumber?: string;
  licenseType?: string;
  status?: string;
  expiration?: string;
}): string {
  const {
    name = 'SARAH CHEN',
    licenseNumber = 'A123456',
    licenseType = 'Physician and Surgeon A',
    status = 'License Active',
    expiration = '2027-05-31',
  } = input;
  return `<tr class="searchResults"><td>${name}</td><td>${licenseNumber}</td><td>${licenseType}</td><td>${status}</td><td>SAN FRANCISCO, CA</td><td>${expiration}</td></tr>`;
}

const NO_RESULTS_PAGE = '<html><body><div>No results found for your search criteria.</div></body></html>';
const WAF_PAGE = '<html><body><h1>Access denied</h1><p>Your request was blocked.</p></body></html>';

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html' } });
}

function buildLookup(overrides: {
  html?: string;
  status?: number;
  fetchImpl?: typeof fetch;
  name?: ProviderNameRecord | null;
  nameError?: Error;
}) {
  const fetchImpl =
    overrides.fetchImpl ??
    (jest.fn().mockResolvedValue(htmlResponse(overrides.html ?? '', overrides.status ?? 200)) as unknown as typeof fetch);

  return createCaBreezeLiveLookup({
    fetchImpl,
    resolveProviderName: overrides.nameError
      ? jest.fn().mockRejectedValue(overrides.nameError)
      : jest.fn().mockResolvedValue(overrides.name === undefined ? NAME : overrides.name),
    now: () => FIXED_NOW,
  });
}

describe('caBreezeLiveLookup (dark until STATE_BOARD_MODE=live)', () => {
  test('single active MBC match parses to a definitive ACTIVE result', async () => {
    const lookup = buildLookup({ html: resultsPage(physicianRow({})) });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('ACTIVE');
    expect(result.licenseNumber).toBe('A123456');
    expect(result.licensee).toBe('SARAH CHEN');
    expect(result.expirationDate).toBe('2027-05-31');
    expect(result.decisionGrade).toBe(true);
    expect(result.degradationReason).toBeNull();
    expect(result.sourceDisclaimer).toContain('Board-reported status: "License Active"');
    expect(result.lastVerifiedAt).toBe(FIXED_NOW.toISOString());
  });

  test('revoked and surrendered board statuses map to REVOKED (fails closed downstream)', async () => {
    for (const status of ['License Revoked', 'License Surrendered']) {
      const lookup = buildLookup({ html: resultsPage(physicianRow({ status })) });
      const result = await lookup('1003000126');
      expect(result.licenseStatus).toBe('REVOKED');
      expect(result.decisionGrade).toBe(true);
    }
  });

  test('delinquent and cancelled statuses map to EXPIRED, never ACTIVE', async () => {
    for (const status of ['Delinquent', 'License Cancelled']) {
      const lookup = buildLookup({ html: resultsPage(physicianRow({ status })) });
      const result = await lookup('1003000126');
      expect(result.licenseStatus).toBe('EXPIRED');
    }
  });

  test('unrecognized page shape degrades as PARSER_FAILURE, never as absence', async () => {
    const lookup = buildLookup({ html: WAF_PAGE });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
    expect(result.degradationReason).toBe('PARSER_FAILURE');
    expect(result.decisionGrade).toBe(false);
  });

  test('unrecognized board status text on a matching row degrades as PARSER_FAILURE', async () => {
    const lookup = buildLookup({
      html: resultsPage(physicianRow({ status: 'Probationary — see order' })),
    });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
    expect(result.degradationReason).toBe('PARSER_FAILURE');
    expect(result.sourceDisclaimer).toContain('Probationary — see order');
  });

  test('genuine no-results page returns NOT_AVAILABLE without degradation so the lane cascades', async () => {
    const lookup = buildLookup({ html: NO_RESULTS_PAGE });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
    expect(result.degradationReason).toBeNull();
    expect(result.decisionGrade).toBe(false);
    expect(result.sourceDisclaimer).toContain('not proof of absence');
  });

  test('results page with only non-physician rows cascades as NOT_AVAILABLE', async () => {
    const lookup = buildLookup({
      html: resultsPage(physicianRow({ licenseType: 'Registered Nurse', licenseNumber: 'RN9999' })),
    });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
    expect(result.degradationReason).toBeNull();
  });

  test('multiple distinct matching license numbers is ambiguous — refuses a definitive status', async () => {
    const lookup = buildLookup({
      html: resultsPage(
        physicianRow({ licenseNumber: 'A123456' }) +
          physicianRow({ licenseNumber: 'A654321', status: 'License Revoked' }),
      ),
    });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
    expect(result.decisionGrade).toBe(false);
    expect(result.sourceDisclaimer).toContain('cannot disambiguate');
  });

  test('a provided license number scopes an ambiguous multi-match to one definitive row', async () => {
    const lookup = buildLookup({
      html: resultsPage(
        physicianRow({ licenseNumber: 'A123456' }) +
          physicianRow({ licenseNumber: 'A654321', status: 'License Revoked' }),
      ),
    });

    const result = await lookup('1003000126', 'A654321');

    expect(result.licenseStatus).toBe('REVOKED');
    expect(result.licenseNumber).toBe('A654321');
  });

  test('rows that do not match the NPPES name are ignored', async () => {
    const lookup = buildLookup({
      html: resultsPage(physicianRow({ name: 'JOHN SMITH' })),
    });

    const result = await lookup('1003000126');

    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
    expect(result.degradationReason).toBeNull();
  });

  test('unresolvable provider name degrades as IDENTITY_UNRESOLVED without fetching', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const lookup = buildLookup({ name: null, fetchImpl });

    const result = await lookup('1003000126');

    expect(result.degradationReason).toBe('IDENTITY_UNRESOLVED');
    expect(result.decisionGrade).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('NPPES resolution failure degrades as IDENTITY_UNRESOLVED', async () => {
    const lookup = buildLookup({ nameError: new Error('nppes unavailable') });

    const result = await lookup('1003000126');

    expect(result.degradationReason).toBe('IDENTITY_UNRESOLVED');
    expect(result.sourceDisclaimer).toContain('nppes unavailable');
  });

  test('non-OK HTTP response degrades as OUTAGE', async () => {
    const lookup = buildLookup({ html: 'blocked', status: 403 });

    const result = await lookup('1003000126');

    expect(result.degradationReason).toBe('OUTAGE');
    expect(result.sourceDisclaimer).toContain('HTTP 403');
  });

  test('timeout degrades as OUTAGE', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    const lookup = buildLookup({ fetchImpl });

    const result = await lookup('1003000126');

    expect(result.degradationReason).toBe('OUTAGE');
    expect(result.sourceDisclaimer).toContain('timed out');
  });
});
