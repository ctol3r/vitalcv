import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

const emitEventMock = jest.fn();

jest.mock('../../../../../../backend/src/services/notifications/eventBus', () => ({
  eventBus: {
    emitEvent: emitEventMock,
  },
}));

import callbackRouter from '../callback';

describe('POST /fhir/subscriptions/callback', () => {
  const app = express();
  app.use(express.json());
  app.use('/fhir/subscriptions', callbackRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET;
  });

  it('accepts unsigned payloads', async () => {
    const payload = { resourceType: 'Bundle' };

    const res = await request(app).post('/fhir/subscriptions/callback').send(payload);

    expect(res.status).toBe(202);
    expect(emitEventMock).toHaveBeenCalledWith(
      'FHIRSubscriptionNotification',
      expect.objectContaining({
        topic: 'external',
        data: payload,
      })
    );
  });

  it('validates signature when provided', async () => {
    process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET = 'secret';
    const body = { foo: 'bar' };
    const signature = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    const res = await request(app)
      .post('/fhir/subscriptions/callback')
      .set('x-fhir-topic', 'test')
      .set('x-fhir-signature', signature)
      .send(body);

    expect(res.status).toBe(202);
    expect(emitEventMock).toHaveBeenCalledWith(
      'FHIRSubscriptionNotification',
      expect.objectContaining({
        topic: 'test',
        data: body,
      })
    );
  });

  it('rejects invalid signatures', async () => {
    process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET = 'secret';

    const res = await request(app)
      .post('/fhir/subscriptions/callback')
      .set('x-fhir-signature', 'deadbeef')
      .send({ foo: 'bar' });

    expect(res.status).toBe(401);
    expect(emitEventMock).not.toHaveBeenCalled();
  });
});
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

const emitEventMock = jest.fn();

jest.mock('../../../../../../backend/src/services/notifications/eventBus', () => ({
  eventBus: {
    emitEvent: emitEventMock,
  },
}));

import callbackRouter from '../callback';

describe('POST /fhir/subscriptions/callback', () => {
  const app = express();
  app.use(express.json());
  app.use('/fhir/subscriptions', callbackRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET;
  });

  it('accepts unsigned payloads', async () => {
    const payload = { resourceType: 'Bundle' };

    const res = await request(app).post('/fhir/subscriptions/callback').send(payload);

    expect(res.status).toBe(202);
    expect(emitEventMock).toHaveBeenCalledWith(
      'FHIRSubscriptionNotification',
      expect.objectContaining({
        topic: 'external',
        data: payload,
      })
    );
  });

  it('validates signature when provided', async () => {
    process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET = 'secret';
    const body = { foo: 'bar' };
    const signature = crypto
      .createHmac('sha256', 'secret')
      .update(JSON.stringify(body))
      .digest('hex');

    const res = await request(app)
      .post('/fhir/subscriptions/callback')
      .set('x-fhir-topic', 'test')
      .set('x-fhir-signature', signature)
      .send(body);

    expect(res.status).toBe(202);
    expect(emitEventMock).toHaveBeenCalledWith(
      'FHIRSubscriptionNotification',
      expect.objectContaining({
        topic: 'test',
        data: body,
      })
    );
  });

  it('rejects invalid signatures', async () => {
    process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET = 'secret';

    const res = await request(app)
      .post('/fhir/subscriptions/callback')
      .set('x-fhir-signature', 'deadbeef')
      .send({ foo: 'bar' });

    expect(res.status).toBe(401);
    expect(emitEventMock).not.toHaveBeenCalled();
  });
});

