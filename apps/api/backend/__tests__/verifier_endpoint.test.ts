import request from 'supertest';
import express from 'express';
import { router as verifierRouter } from '../src/routes/verifier_routes';

const app = express();
app.use('/api', verifierRouter);

describe('verifier credential status endpoint', () => {
  it('returns a credential status', async () => {
    const res = await request(app).get('/api/verifier/credential/123/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ credentialId: '123', status: 'valid' });
  });
});
