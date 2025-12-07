
import { jwtVerify, decodeJwt } from 'jose';

/**
 * Validates an SD-JWT response (Presentation)
 *
 * @param sdJwt - The SD-JWT string (Compact serialization)
 * @param disclosures - Array of disclosure strings
 * @param nonce - The nonce expected in the response
 * @returns Object containing validity status and parsed claims
 */
export async function validateSdResponse(
  sdJwt: string,
  disclosures: string[],
  nonce: string
): Promise<{
  valid: boolean;
  claims?: Record<string, any>;
  error?: string;
  disclosedClaims?: string[];
}> {
  try {
    // 1. Basic format check
    if (!sdJwt || typeof sdJwt !== 'string') {
      return { valid: false, error: 'Invalid SD-JWT format' };
    }

    // 2. Decode JWT (without signature verification for MVP client-side helper if public key not available)
    // In a real scenario, we would verify the signature with the Issuer's public key.
    // Here we assume the backend does the heavy lifting, but we check structure and nonce.
    const claims = decodeJwt(sdJwt);

    // 3. Verify Nonce
    if (claims.nonce !== nonce) {
      return { valid: false, error: `Invalid nonce. Expected ${nonce}, got ${claims.nonce}` };
    }

    // 4. Verify Disclosures (Basic hash check stub)
    // In a full implementation, we would hash each disclosure and check against
    // the _sd array in the JWT claims.
    // For this MVP helper, we'll just ensure we have disclosures if _sd is present.

    const _sd = (claims as any)._sd;
    const disclosedKeys: string[] = [];

    if (_sd && Array.isArray(_sd) && _sd.length > 0) {
      if (!disclosures || disclosures.length === 0) {
        // This is technically allowed (none disclosed), but if we expected some, it might be worth noting.
      }

      // Parse disclosures to see what keys were revealed
      // Disclosure format: [salt, key, value] (base64url encoded array)
      for (const d of disclosures) {
        try {
          const decoded = Buffer.from(d, 'base64url').toString();
          const parsed = JSON.parse(decoded);
          if (Array.isArray(parsed) && parsed.length === 3) {
             disclosedKeys.push(parsed[1] as string); // The key
          }
        } catch (e) {
          console.warn('Failed to parse disclosure:', d);
        }
      }
    }

    return {
      valid: true,
      claims,
      disclosedClaims: disclosedKeys
    };

  } catch (error: any) {
    return { valid: false, error: error.message || 'Validation failed' };
  }
}














