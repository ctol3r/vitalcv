/**
 * OIDC4VCI Client (Browser-side)
 * Handles DPoP key generation, token exchange, and credential issuance using Web Crypto API.
 */

// Helper: Base64URL Encode
function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper: Convert CryptoKey to JWK
async function exportJWK(key: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey('jwk', key);
}

// Helper: Calculate JWK Thumbprint (RFC 7638)
async function calculateJwkThumbprint(jwk: JsonWebKey): Promise<string> {
  // Sort keys and filter to required members for thumbprint
  const ordered = {
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  };
  const json = JSON.stringify(ordered);
  const buffer = new TextEncoder().encode(json);
  const hash = await window.crypto.subtle.digest('SHA-256', buffer);
  return base64UrlEncode(hash);
}

// Helper: Generate DPoP Proof
async function generateDpopProof(
  keyPair: CryptoKeyPair,
  htm: string,
  htu: string,
  accessToken?: string
): Promise<string> {
  const publicJwk = await exportJWK(keyPair.publicKey);

  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: publicJwk,
  };

  const payload: any = {
    jti: base64UrlEncode(window.crypto.getRandomValues(new Uint8Array(12))),
    htm: htm,
    htu: htu,
    iat: Math.floor(Date.now() / 1000),
  };

  if (accessToken) {
    const encoder = new TextEncoder();
    const data = encoder.encode(accessToken);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    payload.ath = base64UrlEncode(hash);
  }

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export class OidcClient {
  private keyPair: CryptoKeyPair | null = null;

  async init() {
    this.keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false, // non-extractable private key (secure in memory, not persisted to disk in this implementation, but session scoped)
      ['sign']
    );
  }

  async exchangePreAuthCode(
    issuerUrl: string,
    preAuthCode: string
  ): Promise<{ access_token: string; c_nonce?: string }> {
    if (!this.keyPair) await this.init();

    const tokenEndpoint = `${issuerUrl}/token`;
    const dpopProof = await generateDpopProof(this.keyPair!, 'POST', tokenEndpoint);

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
      'pre-authorized_code': preAuthCode,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopProof,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    return response.json();
  }

  async requestCredential(
    issuerUrl: string,
    accessToken: string,
    cNonce: string | undefined,
    format: 'vc+sd-jwt' | 'jwt_vc_json' = 'vc+sd-jwt'
  ): Promise<any> {
    if (!this.keyPair) await this.init();

    const credentialEndpoint = `${issuerUrl}/credential`;
    const dpopProof = await generateDpopProof(
      this.keyPair!,
      'POST',
      credentialEndpoint,
      accessToken
    );

    const body: any = {
      credential_request: {
        format,
        proof: {
          proof_type: 'jwt',
          // Note: Real proof generation would require signing the nonce/audience with the holding key.
          // For this pilot, the DPoP binding (cnf.jkt) acts as holder binding.
          // The backend issueSdJwtCredential uses holderJkt from the token.
        },
      },
    };

    if (cNonce) {
      body.c_nonce = cNonce;
    }

    const response = await fetch(credentialEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DPoP ${accessToken}`,
        'DPoP': dpopProof,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Credential request failed: ${err}`);
    }

    return response.json();
  }
}
