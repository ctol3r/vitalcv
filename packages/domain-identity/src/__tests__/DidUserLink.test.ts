import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createUser, deleteUser, getUserById } from '../../../../services/users/models/User';
import { findUserIdByDid, linkDidToUser, listDidsForUser, unlinkDid } from '../models/DidUserLink';

describe('DidUserLink model', () => {
  let userId: string;
  const did = `did:example:${Date.now()}`;

  beforeAll(async () => {
    const user = await createUser({
      email: `did-user+${Date.now()}@example.com`,
      name: 'DID Demo User',
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!userId) {
      return;
    }

    const links = await listDidsForUser(userId);
    await Promise.all(links.map((link) => unlinkDid(link.did)));

    const user = await getUserById(userId);
    if (user) {
      await deleteUser(userId);
    }
  });

  it('links DID to user and retrieves it', async () => {
    const link = await linkDidToUser({ userId, did });
    expect(link.userId).toBe(userId);
    expect(link.did).toBe(did);

    const found = await findUserIdByDid(did);
    expect(found?.userId).toBe(userId);
  });

  it('lists DIDs for a user and unlinks', async () => {
    const list = await listDidsForUser(userId);
    expect(list.length).toBeGreaterThan(0);

    const removed = await unlinkDid(did);
    expect(removed.did).toBe(did);
  });
});
