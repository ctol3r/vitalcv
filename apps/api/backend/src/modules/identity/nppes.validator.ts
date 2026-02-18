import { HttpError } from '../../utils/httpError';
import type { RawNppesResponse, NormalizedProvider } from './types';

/**
 * Normalize and validate a raw NPPES response into a clean provider record.
 * Throws structured errors if required fields are missing.
 */
export function normalizeProvider(raw: RawNppesResponse): NormalizedProvider {
  const result = raw.results[0];
  if (!result) {
    throw new HttpError(404, 'No results in NPPES response');
  }

  const basic = result.basic;
  if (!basic) {
    throw new HttpError(422, 'NPPES result missing basic information block');
  }

  if (!basic.enumeration_type && !result.enumeration_type) {
    throw new HttpError(
      422,
      'NPPES result missing enumeration_type',
      'INVALID_NPPES_DATA',
    );
  }

  if (!basic.status) {
    throw new HttpError(
      422,
      'NPPES result missing provider status',
      'INVALID_NPPES_DATA',
    );
  }

  const primaryTaxonomy =
    result.taxonomies?.find((t) => t.primary)?.desc ?? null;

  return {
    npi: result.number,
    enumeration_type: basic.enumeration_type || result.enumeration_type,
    status: basic.status,
    first_name: basic.first_name ?? '',
    last_name: basic.last_name ?? '',
    primary_taxonomy: primaryTaxonomy,
  };
}
