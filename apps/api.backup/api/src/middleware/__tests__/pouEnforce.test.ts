import { describe, expect, it, jest } from '@jest/globals';
import type { Response, NextFunction } from 'express';
import { pouEnforce, PouRequest } from '../pouEnforce.js';

const createMockRes = (capture: any[]) => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockImplementation(function (body: any) {
    capture.push(body);
    return this;
  });
  return res as Response;
};

describe('PoU enforcement middleware', () => {
  it('rejects missing PoU claim', () => {
    const req = { headers: {} } as PouRequest;
    const capture: any[] = [];
    const res = createMockRes(capture);
    const next = jest.fn();

    pouEnforce(req, res, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('redacts PractitionerRole location for directory PoU', () => {
    const req = { headers: {}, auth: { pou: 'DIRECTORY' } } as unknown as PouRequest;
    const capture: any[] = [];
    const res = createMockRes(capture);
    const next = jest.fn();

    pouEnforce(req, res, next as NextFunction);
    expect(next).toHaveBeenCalled();

    const payload = [{
      resourceType: 'PractitionerRole',
      id: 'role-1',
      practitioner: { reference: 'Practitioner/pract-1' },
      location: [{ display: 'Confidential Clinic' }],
      telecom: [{ system: 'phone', value: '555-444-1111' }],
    }];

    res.json(payload);

    const sanitized = capture[0];
    expect(sanitized[0].location).toBeUndefined();
    expect(sanitized[0].telecom).toBeDefined();
  });
});
