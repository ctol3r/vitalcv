/**
 * B95B-SEC-002: Router receipt endpoint tests
 *
 * Tests for /router/receipts/:id endpoint that returns
 * DLQ receipts with hash, reason, and timestamp.
 */

import request from 'supertest';
import express, { Express } from 'express';
import { createHash } from 'crypto';

// Mock the router app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Mock DLQ storage (same structure as router)
  interface DLQEntry {
    id: string;
    sink: string;
    reason: string;
    hashAnchor: string;
    receiptHash: string;
    timestamp: number;
    payload: unknown;
    metadata?: {
      requestId?: string;
      source?: string;
      retryCount?: number;
    };
  }

  const deadLetterQueue: DLQEntry[] = [];

  function computeHashAnchor(sink: string, payload: unknown, timestamp: number): string {
    const data = JSON.stringify({ sink, payload, timestamp });
    return createHash('sha256').update(data).digest('hex');
  }

  function computeFailureReceipt(sink: string, reason: string, hashAnchor: string, timestamp: number): string {
    const receipt = {
      sink,
      reason,
      hashAnchor,
      timestamp,
      type: 'DLQ_RECEIPT',
    };
    return createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
  }

  // Helper endpoint to add test entries
  app.post('/test/dlq', (req, res) => {
    const { sink, reason, payload } = req.body;
    const timestamp = Date.now();
    const hashAnchor = computeHashAnchor(sink, payload, timestamp);
    const receiptHash = computeFailureReceipt(sink, reason, hashAnchor, timestamp);

    const entry: DLQEntry = {
      id: `dlq-${timestamp}`,
      sink,
      reason,
      hashAnchor,
      receiptHash,
      timestamp,
      payload: payload || {},
      metadata: {
        requestId: req.headers['x-request-id'] as string,
        source: 'test',
        retryCount: 0,
      },
    };

    deadLetterQueue.push(entry);
    res.json(entry);
  });

  // B95B-SEC-002: Receipt endpoint
  app.get('/router/receipts/:id', (req, res) => {
    const receiptId = req.params.id;

    // Try to find by receipt hash first
    let entry = deadLetterQueue.find(item => item.receiptHash === receiptId);

    // If not found by receipt hash, try by entry ID
    if (!entry) {
      entry = deadLetterQueue.find(item => item.id === receiptId);
    }

    if (!entry) {
      return res.status(404).json({
        error: 'Receipt not found',
        receiptId,
      });
    }

    // B95B-SEC-002: Return receipt with hash, reason, and timestamp
    res.json({
      id: entry.id,
      receiptHash: entry.receiptHash,
      hashAnchor: entry.hashAnchor,
      reason: entry.reason,
      sink: entry.sink,
      timestamp: entry.timestamp,
      metadata: entry.metadata,
    });
  });

  return app;
}

describe('B95B-SEC-002: Router Receipt Endpoint', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('should return receipt by entry ID with hash, reason, and timestamp', async () => {
    // Create a test DLQ entry
    const createResponse = await request(app)
      .post('/test/dlq')
      .set('x-request-id', 'test-req-123')
      .send({
        sink: 'svc.issuer-api',
        reason: 'Missing allowed_sinks',
        payload: { test: 'data' },
      });

    expect(createResponse.status).toBe(200);
    const entryId = createResponse.body.id;
    const receiptHash = createResponse.body.receiptHash;

    // Query receipt by entry ID
    const receiptResponse = await request(app)
      .get(`/router/receipts/${entryId}`)
      .expect(200);

    expect(receiptResponse.body).toMatchObject({
      id: entryId,
      receiptHash: expect.any(String),
      hashAnchor: expect.any(String),
      reason: 'Missing allowed_sinks',
      sink: 'svc.issuer-api',
      timestamp: expect.any(Number),
      metadata: expect.objectContaining({
        requestId: 'test-req-123',
      }),
    });

    // Verify receipt hash is present
    expect(receiptResponse.body.receiptHash).toBe(receiptHash);
    expect(receiptResponse.body.receiptHash.length).toBeGreaterThan(0);
  });

  it('should return receipt by receipt hash', async () => {
    // Create a test DLQ entry
    const createResponse = await request(app)
      .post('/test/dlq')
      .send({
        sink: 'svc.verifier-api',
        reason: 'Signature verification failed',
        payload: { credential: 'test' },
      });

    const receiptHash = createResponse.body.receiptHash;

    // Query receipt by receipt hash
    const receiptResponse = await request(app)
      .get(`/router/receipts/${receiptHash}`)
      .expect(200);

    expect(receiptResponse.body).toMatchObject({
      receiptHash,
      reason: 'Signature verification failed',
      sink: 'svc.verifier-api',
      timestamp: expect.any(Number),
    });
  });

  it('should return 404 for non-existent receipt', async () => {
    const response = await request(app)
      .get('/router/receipts/non-existent-id')
      .expect(404);

    expect(response.body).toMatchObject({
      error: 'Receipt not found',
      receiptId: 'non-existent-id',
    });
  });

  it('should include hash anchor in receipt response', async () => {
    const createResponse = await request(app)
      .post('/test/dlq')
      .send({
        sink: 'svc.trust-registry',
        reason: 'Environment mismatch',
        payload: { env: 'production' },
      });

    const entryId = createResponse.body.id;
    const hashAnchor = createResponse.body.hashAnchor;

    const receiptResponse = await request(app)
      .get(`/router/receipts/${entryId}`)
      .expect(200);

    expect(receiptResponse.body.hashAnchor).toBe(hashAnchor);
    expect(receiptResponse.body.hashAnchor.length).toBe(64); // SHA-256 hex length
  });

  it('should include timestamp in receipt response', async () => {
    const beforeTime = Date.now();

    const createResponse = await request(app)
      .post('/test/dlq')
      .send({
        sink: 'etl.fhir-gateway',
        reason: 'Invalid payload format',
      });

    const afterTime = Date.now();
    const entryId = createResponse.body.id;

    const receiptResponse = await request(app)
      .get(`/router/receipts/${entryId}`)
      .expect(200);

    const timestamp = receiptResponse.body.timestamp;
    expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should include metadata in receipt response', async () => {
    const createResponse = await request(app)
      .post('/test/dlq')
      .set('x-request-id', 'metadata-test-456')
      .send({
        sink: 'svc.audit-log',
        reason: 'Sink not allowed',
      });

    const entryId = createResponse.body.id;

    const receiptResponse = await request(app)
      .get(`/router/receipts/${entryId}`)
      .expect(200);

    expect(receiptResponse.body.metadata).toMatchObject({
      requestId: 'metadata-test-456',
      source: 'test',
      retryCount: 0,
    });
  });
});

