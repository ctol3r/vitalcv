import request from 'supertest';
import express from 'express';

const createMock = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    fHIRSubscription: {
      create: createMock,
    },
  })),
}));

import registerRouter from '../register';

describe('POST /fhir/subscriptions/register', () => {
  const app = express();
  app.use(express.json());
  app.use('/fhir/subscriptions', registerRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a subscription', async () => {
    const subscription = {
      id: 'sub-1',
      resourceType: 'Practitioner',
      criteria: 'Practitioner/*',
      callbackUrl: 'https://example.com/callback',
      status: 'PAUSED',
      lastHandshakeAt: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    };

    createMock.mockResolvedValue(subscription);

    const res = await request(app)
      .post('/fhir/subscriptions/register')
      .send({
        resourceType: 'Practitioner',
        criteria: 'Practitioner/*',
        callbackUrl: 'https://example.com/callback',
      });

    expect(res.status).toBe(201);
    expect(res.body.subscriptionId).toBe(subscription.id);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        resourceType: 'Practitioner',
        criteria: 'Practitioner/*',
        callbackUrl: 'https://example.com/callback',
      },
    });
  });

  it('validates inputs', async () => {
    const res = await request(app)
      .post('/fhir/subscriptions/register')
      .send({
        resourceType: 'Unknown',
        criteria: '',
        callbackUrl: 'http://insecure',
      });

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
import request from 'supertest';
import express from 'express';

const createMock = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    fHIRSubscription: {
      create: createMock,
    },
  })),
}));

import registerRouter from '../register';

describe('POST /fhir/subscriptions/register', () => {
  const app = express();
  app.use(express.json());
  app.use('/fhir/subscriptions', registerRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a subscription', async () => {
    const subscription = {
      id: 'sub-1',
      resourceType: 'Practitioner',
      criteria: 'Practitioner/*',
      callbackUrl: 'https://example.com/callback',
      status: 'PAUSED',
      lastHandshakeAt: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    };

    createMock.mockResolvedValue(subscription);

    const res = await request(app)
      .post('/fhir/subscriptions/register')
      .send({
        resourceType: 'Practitioner',
        criteria: 'Practitioner/*',
        callbackUrl: 'https://example.com/callback',
      });

    expect(res.status).toBe(201);
    expect(res.body.subscriptionId).toBe(subscription.id);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        resourceType: 'Practitioner',
        criteria: 'Practitioner/*',
        callbackUrl: 'https://example.com/callback',
      },
    });
  });

  it('validates inputs', async () => {
    const res = await request(app)
      .post('/fhir/subscriptions/register')
      .send({
        resourceType: 'Unknown',
        criteria: '',
        callbackUrl: 'http://insecure',
      });

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});

