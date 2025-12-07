/**
 * B241A-I18N-001: TranslationKey model tests
 */

import { PrismaClient } from '@prisma/client';
import { TranslationKeyService } from '../TranslationKey';

describe('TranslationKeyService', () => {
  let prisma: PrismaClient;
  let service: TranslationKeyService;

  beforeAll(() => {
    prisma = new PrismaClient();
    service = new TranslationKeyService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.translationEntry.deleteMany();
    await prisma.translationKey.deleteMany();
  });

  describe('createKey', () => {
    it('should create a new translation key', async () => {
      const key = await service.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      expect(key).toBeDefined();
      expect(key.context).toBe('pages.login.title');
      expect(key.defaultText).toBe('Welcome');
      expect(key.id).toBeDefined();
    });

    it('should fail to create duplicate context', async () => {
      await service.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      await expect(
        service.createKey({
          context: 'pages.login.title',
          defaultText: 'Hello',
        })
      ).rejects.toThrow();
    });
  });

  describe('getKeyByContext', () => {
    it('should retrieve a key by context', async () => {
      const created = await service.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      const retrieved = await service.getKeyByContext('pages.login.title');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent context', async () => {
      const retrieved = await service.getKeyByContext('nonexistent.key');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateKey', () => {
    it('should update a translation key', async () => {
      const key = await service.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      const updated = await service.updateKey(key.id, {
        defaultText: 'Hello',
      });

      expect(updated.defaultText).toBe('Hello');
      expect(updated.context).toBe('pages.login.title');
    });
  });

  describe('deleteKey', () => {
    it('should delete a translation key', async () => {
      const key = await service.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      const deleted = await service.deleteKey(key.id);
      expect(deleted).toBe(true);

      const retrieved = await service.getKeyByContext('pages.login.title');
      expect(retrieved).toBeNull();
    });
  });

  describe('searchKeys', () => {
    it('should search keys by pattern', async () => {
      await service.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });
      await service.createKey({
        context: 'pages.login.subtitle',
        defaultText: 'Please sign in',
      });
      await service.createKey({
        context: 'pages.dashboard.title',
        defaultText: 'Dashboard',
      });

      const results = await service.searchKeys('login');
      expect(results.length).toBe(2);
      expect(results.every((r) => r.context.includes('login'))).toBe(true);
    });
  });
});

