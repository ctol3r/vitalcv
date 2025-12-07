import request from 'supertest';
import app from '../../src/app';
import { presentationStore } from '../../src/services/presentation/store';
import { VPValidator } from '../../src/services/presentation/validator';
import { isRevoked } from '../../src/revocation/statuslist';

// Mock the dependencies
jest.mock('../../src/services/presentation/validator');
jest.mock('../../src/revocation/statuslist');

const mockValidate = VPValidator.prototype.validate as jest.Mock;
const mockIsRevoked = isRevoked as jest.Mock;

describe('OIDC4VP Endpoints', () => {
  beforeEach(() => {
      jest.clearAllMocks();
  });

  describe('POST /api/oidc4vp/presentation-request', () => {
    it('should create a session and return request object', async () => {
      const pd = { id: 'test-pd', input_descriptors: [] };
      const res = await request(app)
        .post('/api/oidc4vp/presentation-request')
        .send({
          clientId: 'did:web:test',
          presentationDefinition: pd,
          expectedSchema: 'TestCredential'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('nonce');
      expect(res.body).toHaveProperty('state');
      expect(res.body.client_id).toBe('did:web:test');
    });
  });

  describe('POST /api/oidc4vp/presentation', () => {
    it('should verify a valid presentation', async () => {
      // Setup session
      const { nonce, state } = presentationStore.createSession({}, 'client', 'TestCredential');

      // Mock validator success
      mockValidate.mockResolvedValue({
        valid: true,
        payload: {
          vp: {
            verifiableCredential: [
              {
                type: ['VerifiableCredential', 'TestCredential'],
                id: 'urn:uuid:123'
              }
            ]
          }
        }
      });

      mockIsRevoked.mockReturnValue(false);

      const res = await request(app)
        .post('/api/oidc4vp/presentation')
        .send({
          vp_token: 'valid.vp.token',
          presentation_submission: { id: 'ps-1', definition_id: 'pd-1', descriptor_map: [] },
          state: state
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(mockValidate).toHaveBeenCalled();

      // Check store status
      const session = presentationStore.getSession(nonce);
      expect(session?.status).toBe('verified');
    });

    it('should reject nonce mismatch (handled by validator)', async () => {
      const { nonce, state } = presentationStore.createSession({}, 'client', 'TestCredential');

      mockValidate.mockResolvedValue({
        valid: false,
        error: 'Nonce mismatch'
      });

      const res = await request(app)
        .post('/api/oidc4vp/presentation')
        .send({
          vp_token: 'invalid.vp.token',
          presentation_submission: {},
          state: state
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_presentation');

      const session = presentationStore.getSession(nonce);
      expect(session?.status).toBe('failed');
    });

    it('should reject incorrect signature', async () => {
      const { nonce, state } = presentationStore.createSession({}, 'client');

      mockValidate.mockResolvedValue({
        valid: false,
        error: 'Signature invalid'
      });

      const res = await request(app)
        .post('/api/oidc4vp/presentation')
        .send({
          vp_token: 'bad.sig',
          presentation_submission: {},
          state
        });

      expect(res.status).toBe(400);
    });

    it('should reject revoked credential', async () => {
       const { nonce, state } = presentationStore.createSession({}, 'client');

       mockValidate.mockResolvedValue({
        valid: true,
        payload: {
          vp: {
            verifiableCredential: [
              { id: 'urn:uuid:revoked', type: ['VerifiableCredential'] }
            ]
          }
        }
      });

      mockIsRevoked.mockImplementation((id) => id === 'urn:uuid:revoked');

      const res = await request(app)
        .post('/api/oidc4vp/presentation')
        .send({
          vp_token: 'revoked.token',
          presentation_submission: {},
          state
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('revoked_credential');
    });

    it('should reject expired credential', async () => {
       const { nonce, state } = presentationStore.createSession({}, 'client');

       // Expired yesterday
       const expiredDate = new Date(Date.now() - 86400000).toISOString();

       mockValidate.mockResolvedValue({
        valid: true,
        payload: {
          vp: {
            verifiableCredential: [
              { id: 'urn:uuid:valid', expirationDate: expiredDate }
            ]
          }
        }
      });

      // Not revoked
      mockIsRevoked.mockReturnValue(false);

      const res = await request(app)
        .post('/api/oidc4vp/presentation')
        .send({
          vp_token: 'expired.token',
          presentation_submission: {},
          state
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('expired_credential');
    });
  });
});



















