import { haipConfig } from '@vitalcv/haip-config';
import { getConfiguredIssuerDid, isValidDidFormat, normalizeDid } from './issuerDid';

const REQUIRED_SIGNING_ALG = 'ES256';
const REQUIRED_PKCE_METHOD = 'S256';

export type HaipNoDowngradeResult = {
  valid: boolean;
  violations: string[];
};

function addViolation(violations: string[], condition: boolean, message: string): void {
  if (condition) {
    violations.push(message);
  }
}

export function evaluateHaipNoDowngrade(params: {
  algorithm?: string;
  tokenType?: string;
  signed?: boolean;
  issuerDid?: string;
}): HaipNoDowngradeResult {
  const violations: string[] = [];

  const normalizedAlgorithm = params.algorithm?.trim();
  addViolation(
    violations,
    normalizedAlgorithm !== undefined && normalizedAlgorithm !== REQUIRED_SIGNING_ALG,
    `algorithm \"${normalizedAlgorithm}\" rejected; only ES256 is permitted`,
  );

  addViolation(
    violations,
    params.signed === false,
    'Unsigned credential requests are rejected under HAIP enforcement',
  );

  const normalizedTokenType = (params.tokenType ?? '').trim().toLowerCase();
  addViolation(
    violations,
    normalizedTokenType === 'bearer',
    'Bearer tokens are rejected; DPoP-bound tokens are required',
  );

  if (params.issuerDid !== undefined) {
    const normalizedIssuerDid = normalizeDid(params.issuerDid);
    addViolation(
      violations,
      !isValidDidFormat(normalizedIssuerDid) || normalizedIssuerDid !== normalizeDid(getConfiguredIssuerDid()),
      `issuer DID \"${normalizedIssuerDid}\" rejected; must match configured issuer DID`,
    );
  }

  addViolation(
    violations,
    haipConfig.allowedAlgorithms.length !== 1 || haipConfig.allowedAlgorithms[0] !== REQUIRED_SIGNING_ALG,
    'Signing algorithm whitelist is not locked to ES256',
  );

  addViolation(
    violations,
    !haipConfig.pkce.required ||
      haipConfig.pkce.allowedMethods.length !== 1 ||
      haipConfig.pkce.allowedMethods[0] !== REQUIRED_PKCE_METHOD,
    'PKCE S256 is required',
  );

  addViolation(
    violations,
    !haipConfig.par.required,
    'PAR is required',
  );

  addViolation(
    violations,
    !haipConfig.dpop.required,
    'DPoP is required',
  );

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function isHaipEnforced(): boolean {
  return haipConfig.enforce || haipConfig.dpop.required || haipConfig.pkce.required || haipConfig.par.required;
}
