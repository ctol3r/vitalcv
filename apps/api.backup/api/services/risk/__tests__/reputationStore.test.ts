/**
 * Tests for reputation store
 */

import {
  addToReputationStore,
  checkReputation,
  removeFromReputationStore,
} from '../reputationStore';

describe('Reputation Store', () => {
  beforeEach(() => {
    // Clear reputation cache before each test
    // In a real implementation, this would clear Redis or similar
  });

  it('should add device to reputation store', async () => {
    await addToReputationStore({
      deviceId: 'bad-device-1',
      reason: 'Known bot',
      severity: 'BLOCK',
    });

    const entry = await checkReputation('bad-device-1');
    expect(entry).toBeTruthy();
    expect(entry?.severity).toBe('BLOCK');
    expect(entry?.reason).toBe('Known bot');
  });

  it('should add IP to reputation store', async () => {
    await addToReputationStore({
      ipHash: 'bad-ip-hash',
      reason: 'Tor exit node',
      severity: 'HIGH',
    });

    const entry = await checkReputation(undefined, 'bad-ip-hash');
    expect(entry).toBeTruthy();
    expect(entry?.severity).toBe('HIGH');
  });

  it('should return null for non-existent entry', async () => {
    const entry = await checkReputation('unknown-device');
    expect(entry).toBeNull();
  });

  it('should remove entry from reputation store', async () => {
    await addToReputationStore({
      deviceId: 'temp-bad-device',
      reason: 'Temporary block',
      severity: 'MEDIUM',
    });

    let entry = await checkReputation('temp-bad-device');
    expect(entry).toBeTruthy();

    await removeFromReputationStore('temp-bad-device');

    entry = await checkReputation('temp-bad-device');
    expect(entry).toBeNull();
  });

  it('should handle expired entries', async () => {
    const expiresAt = new Date(Date.now() + 1000); // 1 second from now
    await addToReputationStore({
      deviceId: 'expiring-device',
      reason: 'Temporary',
      severity: 'LOW',
      expiresAt,
    });

    let entry = await checkReputation('expiring-device');
    expect(entry).toBeTruthy();

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    entry = await checkReputation('expiring-device');
    expect(entry).toBeNull();
  });
});

