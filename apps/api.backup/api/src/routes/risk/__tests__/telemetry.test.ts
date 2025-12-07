/**
 * Tests for telemetry endpoint
 */

import request from 'supertest';
import express from 'express';
import { randomUUID } from 'crypto';
import riskTelemetryRouter from '../telemetry';

const app = express();
app.use(express.json());
app.use('/risk', riskTelemetryRouter);

describe('POST /risk/telemetry', () => {
  it('should accept valid telemetry data', async () => {
    const deviceId = randomUUID();
    const response = await request(app)
      .post('/risk/telemetry')
      .send({
        deviceId,
        signals: {
          userAgent: 'Mozilla/5.0',
          timezone: 'America/New_York',
          screen: { width: 1920, height: 1080 },
          tzOffset: -300,
          languages: ['en-US', 'en'],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.deviceId).toBe(deviceId);
  });

  it('should reject missing deviceId', async () => {
    const response = await request(app)
      .post('/risk/telemetry')
      .send({
        signals: {
          userAgent: 'Mozilla/5.0',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_request');
  });

  it('should reject missing signals', async () => {
    const response = await request(app)
      .post('/risk/telemetry')
      .send({
        deviceId: randomUUID(),
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_request');
  });

  it('should reject deviceIds that are not UUIDs', async () => {
    const response = await request(app)
      .post('/risk/telemetry')
      .send({
        deviceId: 'not-a-uuid',
        signals: { userAgent: 'Mozilla/5.0' },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_request');
  });

  it('should handle rate limiting', async () => {
    const deviceId = randomUUID();
    const signals = { userAgent: 'Mozilla/5.0' };

    // Send 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/risk/telemetry')
        .send({ deviceId, signals });
      expect(response.status).toBe(200);
    }

    // 11th request should be rate limited
    const response = await request(app)
      .post('/risk/telemetry')
      .send({ deviceId, signals });

    expect(response.status).toBe(429);
  });
});
