import { describe, it, expect } from '@jest/globals';
import type { Response, NextFunction } from 'express';
import { pouEnforce, PouRequest } from '../pouEnforce.js';

describe('PoU enforcement middleware', () => {
  const createMockRes = (capture: any[]) => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockImplementation(function (body: any) {
      capture.push(body);
      return this;
    });
    return res as Response;
  };

  it('rejects request without PoU', () => {
    const req = { headers: {} } as PouRequest;
    const res = createMockRes();
    const next = jest.fn();

    pouEnforce(req, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('redacts PractitionerRole locations for Directory PoU', () => {
    const req = { headers: {}, auth: { pou: 'DIRECTORY' } } as unknown as PouRequest;
    const captured: any[] = [];
    const res = createMockRes(captured);
    const next = jest.fn();

    pouEnforce(req, res, next as NextFunction);
    expect(next).toHaveBeenCalled();

    const payload = [{
      resourceType: 'PractitionerRole',
      id: 'role-1',
      practitioner: { reference: 'Practitioner/pract-1' },
      location: [{ display: 'Location A' }],
      telecom: [{ system: 'phone', value: '555-010-1111' }],
    }];

    res.json(payload);

    const sanitized = captured[0];
    expect(Array.isArray(sanitized)).toBe(true);
    expect(sanitized[0].location).toBeUndefined();
    expect(sanitized[0].telecom).toBeDefined();
  });
});
import { pouEnforce, PouEnforcedRequest } from '../pouEnforce';
import { Response } from 'express';
import { TefcaPurposeOfUse } from '../../../../../services/tefca/models/QhinConfig';

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

function createBundle() {
  return {
    resourceType: 'Bundle',
    entry: [
      {
        resource: {
          resourceType: 'Practitioner',
          id: 'practitioner-1',
          identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
          name: [{ text: 'Dr. Alice Carter' }],
          telecom: [{ system: 'phone', value: '555-1010' }],
        },
      },
    ],
  };
}

describe('pouEnforce middleware', () => {
  it('redacts telecom for directory PoU', done => {
    const token = createToken(TefcaPurposeOfUse.DIRECTORY);
    const middleware = pouEnforce();
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as PouEnforcedRequest;

    const res: Partial<Response> = {
      json(payload: any) {
        expect(payload.entry[0].resource.telecom).toBeUndefined();
        done();
        return this as Response;
      },
      status() {
        return this as Response;
      },
    };

    middleware(req, res as Response, () => {
      res.json!(createBundle());
    });
  });

  it('keeps telecom for treatment PoU', done => {
    const token = createToken(TefcaPurposeOfUse.TREATMENT);
    const middleware = pouEnforce();
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as PouEnforcedRequest;

    const res: Partial<Response> = {
      json(payload: any) {
        expect(payload.entry[0].resource.telecom).toBeDefined();
        done();
        return this as Response;
      },
      status() {
        return this as Response;
      },
    };

    middleware(req, res as Response, () => {
      res.json!(createBundle());
    });
  });
});


