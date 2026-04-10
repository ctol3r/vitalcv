import { signPayloadES256, getPublicJWKS } from '../cryptoService';

describe('ES256 Receipt Issuance', () => {
  test('generates valid JWKS', () => {
    const jwks = getPublicJWKS();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].alg).toBe('ES256');
    expect(jwks.keys[0].crv).toBe('P-256');
  });

  test('signs payloads correctly', () => {
    const payload = { sub: 'npi-123', iss: 'vitalcv', iat: Math.floor(Date.now() / 1000) };
    const jwt = signPayloadES256(payload);
    
    expect(jwt.split('.')).toHaveLength(3);
  });
});
