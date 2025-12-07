import { OrgMembershipRole } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import ssoCallbackRouter from '../sso/callback';

const consumeSsoState = jest.fn();
const getSsoProviderById = jest.fn();
const getSsoClientSecret = jest.fn();
const getOidcMetadata = jest.fn();
const exchangeCodeForTokens = jest.fn();
const verifyIdToken = jest.fn();
const fetchUserInfo = jest.fn();
const provisionSsoUser = jest.fn();
const linkDidFromSso = jest.fn();
const logSsoSuccess = jest.fn();
const logSsoFailure = jest.fn();
const generateToken = jest.fn();

jest.mock('../../../services/ssoStateStore', () => ({
  consumeSsoState: (state: string) => consumeSsoState(state),
}));

jest.mock('../../../../../services/auth/models/SSOProvider.ts', () => ({
  getSsoProviderById: (id: string) => getSsoProviderById(id),
  getSsoClientSecret: (provider: any) => getSsoClientSecret(provider),
}));

jest.mock('../sso/oidcClient', () => ({
  getOidcMetadata: (issuer: string) => getOidcMetadata(issuer),
  exchangeCodeForTokens: (input: any) => exchangeCodeForTokens(input),
  verifyIdToken: (input: any) => verifyIdToken(input),
  fetchUserInfo: (endpoint: string, token: string) => fetchUserInfo(endpoint, token),
}));

jest.mock('../../../../../services/auth/ssoProvision', () => ({
  provisionSsoUser: (payload: any) => provisionSsoUser(payload),
}));

jest.mock('../../../../../services/auth/ssoDidLink', () => ({
  linkDidFromSso: (userId: string, claims: any) => linkDidFromSso(userId, claims),
}));

jest.mock('../../../../../services/audit/ssoEvents', () => ({
  logSsoSuccess: (payload: any) => logSsoSuccess(payload),
  logSsoFailure: (payload: any) => logSsoFailure(payload),
}));

jest.mock('../../../../../backend/src/auth/jwt', () => ({
  generateToken: (payload: any) => generateToken(payload),
}));

describe('GET /auth/sso/callback', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/auth/sso', ssoCallbackRouter);
    jest.clearAllMocks();
  });

  it('completes SSO login and returns session token', async () => {
    consumeSsoState.mockResolvedValue({
      providerId: 'provider-1',
      orgId: 'org-1',
      nonce: 'nonce-1',
      createdAt: Date.now(),
    });
    getSsoProviderById.mockResolvedValue({
      id: 'provider-1',
      orgId: 'org-1',
      issuer: 'https://login.example.com',
      clientId: 'client-1',
      redirectUri: 'https://app.example.com/callback',
      domainWhitelist: [],
      autoProvisionRole: OrgMembershipRole.REVIEWER,
    });
    getSsoClientSecret.mockResolvedValue('secret');
    getOidcMetadata.mockResolvedValue({
      issuer: 'https://login.example.com',
      authorization_endpoint: 'https://login.example.com/authorize',
      token_endpoint: 'https://login.example.com/token',
      jwks_uri: 'https://login.example.com/jwks',
    });
    exchangeCodeForTokens.mockResolvedValue({
      id_token: 'id-token',
      access_token: 'access-token',
      token_type: 'Bearer',
    });
    verifyIdToken.mockResolvedValue({
      sub: 'user-1',
      email: 'clinician@example.com',
      nonce: 'nonce-1',
    });
    fetchUserInfo.mockResolvedValue({
      email: 'clinician@example.com',
      name: 'Dr Clinician',
    });
    provisionSsoUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'clinician@example.com',
        name: 'Dr Clinician',
        roles: ['CLINICIAN'],
      },
      membership: {
        orgId: 'org-1',
        role: OrgMembershipRole.REVIEWER,
      },
    });
    linkDidFromSso.mockResolvedValue(true);
    generateToken.mockReturnValue('jwt-token');

    const response = await request(app)
      .get('/auth/sso/callback')
      .query({ state: 'STATE', code: 'AUTH_CODE' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('jwt-token');
    expect(provisionSsoUser).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', providerId: 'provider-1' })
    );
    expect(logSsoSuccess).toHaveBeenCalled();
  });

  it('returns 400 when state is unknown', async () => {
    consumeSsoState.mockResolvedValue(null);

    const response = await request(app)
      .get('/auth/sso/callback')
      .query({ state: 'STATE', code: 'AUTH_CODE' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_state');
    expect(logSsoFailure).toHaveBeenCalled();
  });
});
