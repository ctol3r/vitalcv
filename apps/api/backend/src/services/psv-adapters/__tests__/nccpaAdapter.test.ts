import { verifyNCCPA, verifyStateBoard } from '../adapters/nccpaAdapter';

describe('Advanced Source Adapters', () => {
  test('NCCPA verification behaves deterministically', async () => {
    const res = await verifyNCCPA('1234567890', 'CA-123');
    expect(res.status).toBe('CERTIFIED');
    expect(res.lastChecked).toBeDefined();
  });

  test('State Board verification yields active expiration', async () => {
    const res = await verifyStateBoard('CA', 'MD12345');
    expect(res.status).toBe('ACTIVE');
    expect(res.expirationDate).toBeDefined();
  });
});
