const DEFAULT_TRUSTED_ISSUERS = ['did:web:issuer.vitalcv.com'];

const TRUSTED_ISSUERS = (process.env.TRUSTED_ISSUERS || '')
  .split(',')
  .map((issuer) => issuer.trim())
  .filter(Boolean);

const REGISTERED_ISSUERS = TRUSTED_ISSUERS.length > 0
  ? TRUSTED_ISSUERS
  : DEFAULT_TRUSTED_ISSUERS;

/**
 * Check if the issuer DID is registered in the Trust Registry.
 *
 * TODO: Replace static registry with smart contract lookup.
 */
export function isTrustedIssuer(issuerDid: string): boolean {
  if (!issuerDid) {
    return false;
  }

  return REGISTERED_ISSUERS.includes(issuerDid);
}

export default {
  isTrustedIssuer,
};
