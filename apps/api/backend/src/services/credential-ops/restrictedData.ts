import { HttpError } from '../../utils/httpError';

const RESTRICTED_KEYS = new Set([
  'ssn',
  'socialsecuritynumber',
  'dateofbirth',
  'dob',
  'birthdate',
  'healthdisclosure',
  'medicalhistory',
  'peerreviewmaterial',
  'peerreviewdetails',
  'protectedhealthinformation',
  'phi',
]);

const SSN_VALUE = /(^|\D)\d{3}[- ]?\d{2}[- ]?\d{4}(\D|$)/;

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Credential-operations records deliberately hold references and receipts,
 * never raw restricted credentialing values. This guard runs at every JSON
 * ingestion boundary before Prisma receives the payload.
 */
export function assertNoRestrictedCredentialOpsData(value: unknown, path = 'payload'): void {
  if (typeof value === 'string') {
    if (SSN_VALUE.test(value)) {
      throw new HttpError(400, `${path} must reference restricted data externally; raw SSN-like values are not accepted.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRestrictedCredentialOpsData(item, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (RESTRICTED_KEYS.has(normalizedKey(key))) {
      throw new HttpError(400, `${path}.${key} is restricted; store an external reference or receipt instead.`);
    }
    assertNoRestrictedCredentialOpsData(nested, `${path}.${key}`);
  }
}
