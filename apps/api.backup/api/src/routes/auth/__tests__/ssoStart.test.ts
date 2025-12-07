import request from 'supertest';
import express from 'express';
import ssoStartRouter from '../sso/start';

const getSsoProviderByOrg = jest.fn();
const getOidcMetadata = jest.fn();
const persistSsoState = jest.fn();
const logSsoFailure = jest.fn();

jest.mock('../../../../../services/auth/models/SSOProvider.ts', () => ({
  getSsoProviderByOrg: (orgId: string) => getSsoProviderByOrg(orgId),
}));

jest.mock('../sso/oidcClient', () => ({
  getOidcMetadata: (issuer: string) => getOidcMetadata(issuer),
}));

jest.mock('../../../services/ssoStateStore', () => ({
  persistSsoState: (state: string, payload: any) => persistSsoState(state, payload),
}));

jest.mock('../../../../../services/audit/ssoEvents', () => ({
  logSsoFailure: (payload: any) => logSsoFailure(payload),
}));

describe('GET /auth/sso/start', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/auth/sso', ssoStartRouter);
    jest.clearAllMocks();
  });

  it('redirects to provider authorize endpoint with state + nonce', async () => {
    getSsoProviderByOrg.mockResolvedValue({
      id: 'provider-1',
      orgId: 'org-123',
      issuer: 'https://login.example.com',
      clientId: 'client-123',
      redirectUri: 'https://app.example.com/callback',
      domainWhitelist: [],
    });

    getOidcMetadata.mockResolvedValue({
      issuer: 'https://login.example.com',
      authorization_endpoint: 'https://login.example.com/authorize',
      token_endpoint: 'https://login.example.com/token',
      jwks_uri: 'https://login.example.com/jwks',
    });

    const response = await request(app).get('/auth/sso/start').query({ orgId: 'org-123' });

    expect(response.status).toBe(302);
    const location = response.headers['location'];
    expect(location).toContain('https://login.example.com/authorize');
    expect(location).toContain('client_id=client-123');
    expect(location).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
    expect(location).toMatch(/state=/);
    expect(location).toMatch(/nonce=/);
    expect(persistSsoState).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when org missing provider', async () => {
    getSsoProviderByOrg.mockResolvedValue(null);

    const response = await request(app).get('/auth/sso/start').query({ orgId: 'missing-org' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('provider_not_found');
  });
});
