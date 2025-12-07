/**
 * Tests for B128C-EVID-030: Evidence seed
 */

import request from 'supertest';
import express from 'express';
import router from '../evidence-seed';

const app = express();
app.use(express.json());
app.use('/api/evidence', router);

describe('Evidence Seed API', () => {
  it('should seed evidence with SHA256 hash', async () => {
    const response = await request(app)
      .post('/api/evidence/seed')
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.evidence.sha256Hash).toBeDefined();
    expect(response.body.verification.sha256).toBeDefined();
    expect(response.body.verification.anchor).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('should verify evidence integrity', async () => {
    const seedResponse = await request(app)
      .post('/api/evidence/seed')
      .send({});

    const evidenceId = seedResponse.body.evidence.id;

    const verifyResponse = await request(app)
      .get(`/api/evidence/verify/${evidenceId}`);

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.verified).toBe(true);
    expect(verifyResponse.body.integrity.match).toBe(true);
  });

  it('should link evidence to KPIs', async () => {
    await request(app).post('/api/evidence/seed').send({});

    const response = await request(app)
      .get('/api/evidence/kpi/minutes-in-notes');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.evidenceCount).toBeGreaterThan(0);
  });

  it('should return 404 for non-existent evidence', async () => {
    const response = await request(app)
      .get('/api/evidence/verify/EVID-nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

