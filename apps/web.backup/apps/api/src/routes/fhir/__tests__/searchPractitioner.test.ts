import request from 'supertest';
import express from 'express';
import searchPractitionerRouter from '../searchPractitioner';
import { resetAuditTrail, getAuditTrail } from '../../../../../services/tefca/auditLogger';

function createToken(purpose: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ purpose_of_use: purpose, requester: 'OrgTester' }));
  return `${header}.${payload}.`;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('GET /fhir/R6/Practitioner', () => {
  let app: express.Application;
  beforeEach(() => {
    app = express();
    app.use('/fhir/R6', searchPractitionerRouter);
    resetAuditTrail();
  });

  it('returns practitioner search results by identifier', async () => {
    const token = createToken('TREATMENT');
    const response = await request(app)
      .get('/fhir/R6/Practitioner')
      .set('Authorization', `Bearer ${token}`)
      .query({ identifier: '1234567890' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.entry.length).toBeGreaterThan(1); // includes role/org/endpoint

    const audit = getAuditTrail();
    expect(audit).toHaveLength(1);
    expect(audit[0].subject).toBe('identifier=1234567890');
  });

  it('returns empty bundle when no matches by name', async () => {
    const token = createToken('DIRECTORY');
    const response = await request(app)
      .get('/fhir/R6/Practitioner')
      .set('Authorization', `Bearer ${token}`)
      .query({ name: 'Zeta' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.entry).toEqual([]);
  });
});


