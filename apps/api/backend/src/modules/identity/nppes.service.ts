import { HttpError } from '../../utils/httpError';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';
import type { RawNppesResponse, NppesFetchResult } from './types';

const CMS_NPPES_ENDPOINT =
  'https://npiregistry.cms.hhs.gov/api/?version=2.1';

/**
 * Fetch provider data from the CMS NPPES Registry by NPI number.
 * Returns the raw payload and its SHA-256 hash for audit integrity.
 */
export async function fetchNpiFromCMS(npi: string): Promise<NppesFetchResult> {
  const url = `${CMS_NPPES_ENDPOINT}&number=${encodeURIComponent(npi)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    log('error', 'nppes_fetch_failed', {
      npi,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw new HttpError(502, 'Failed to reach CMS NPPES Registry');
  }

  if (!response.ok) {
    log('error', 'nppes_upstream_error', {
      npi,
      status: response.status,
    });
    throw new HttpError(502, `CMS NPPES returned status ${response.status}`);
  }

  let rawPayload: RawNppesResponse;
  try {
    rawPayload = JSON.parse(await response.text()) as RawNppesResponse;
  } catch {
    throw new HttpError(502, 'Invalid JSON from CMS NPPES Registry');
  }

  if (!Array.isArray(rawPayload.results) || typeof rawPayload.result_count !== 'number') {
    throw new HttpError(502, 'Invalid NPPES response shape from CMS registry');
  }

  const payloadHash = sha256ForPayload(rawPayload);

  if (rawPayload.result_count === 0 || rawPayload.results.length === 0) {
    throw new HttpError(404, `NPI ${npi} not found in CMS NPPES Registry`);
  }

  return { rawPayload, payloadHash };
}
