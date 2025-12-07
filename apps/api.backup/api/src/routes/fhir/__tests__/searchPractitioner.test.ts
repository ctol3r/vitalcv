import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import searchPractitionerRouter from '../searchPractitioner.js';

const WIDGET_TOKEN_SECRET = process.env.WIDGET_TOKEN_SECRET || 'widget-secret-change-in-production';

describe('TEFCA Practitioner search route', () => {
  const app = express();
  app.use(searchPractitionerRouter);

  const getToken = (claims: Record<string, any>) => jwt.sign(claims, WIDGET_TOKEN_SECRET);

  it('returns practitioners for identifier search', async () => {
    const token = getToken({ sub: 'test-client', pou: 'TREATMENT' });
    const response = await request(app)
      .get('/fhir/R6/Practitioner?identifier=1234567890')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0].resourceType).toBe('Practitioner');
    expect(response.body[0].contained?.length).toBeGreaterThan(0);
  });

  it('returns empty array when no match is found', async () => {
    const token = getToken({ sub: 'test-client', pou: 'DIRECTORY' });
    const response = await request(app)
      .get('/fhir/R6/Practitioner?identifier=0000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
