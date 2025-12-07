/**
 * B241A-I18N-002: TranslationEntry model tests
 */

import { PrismaClient, TranslationEntryStatus } from '@prisma/client';
import { TranslationEntryService } from '../TranslationEntry';
import { TranslationKeyService } from '../TranslationKey';

describe('TranslationEntryService', () => {
  let prisma: PrismaClient;
  let entryService: TranslationEntryService;
  let keyService: TranslationKeyService;

  beforeAll(() => {
    prisma = new PrismaClient();
    entryService = new TranslationEntryService(prisma);
    keyService = new TranslationKeyService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.translationEntry.deleteMany();
    await prisma.translationKey.deleteMany();
  });

  describe('createEntry', () => {
    it('should create a new translation entry', async () => {
      const key = await keyService.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      const entry = await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenido',
        createdBy: 'user-123',
      });

      expect(entry).toBeDefined();
      expect(entry.locale).toBe('es-ES');
      expect(entry.text).toBe('Bienvenido');
      expect(entry.version).toBe(1);
      expect(entry.status).toBe(TranslationEntryStatus.DRAFT);
    });

    it('should increment version for same key+locale', async () => {
      const key = await keyService.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      const entry1 = await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenido',
        createdBy: 'user-123',
      });

      const entry2 = await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenidos',
        createdBy: 'user-123',
      });

      expect(entry2.version).toBe(entry1.version + 1);
    });
  });

  describe('getLatestApproved', () => {
    it('should get latest approved translation', async () => {
      const key = await keyService.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      // Create draft entry
      await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenido (draft)',
        createdBy: 'user-123',
        status: TranslationEntryStatus.DRAFT,
      });

      // Create approved entry
      const approved = await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenido',
        createdBy: 'user-123',
        status: TranslationEntryStatus.APPROVED,
      });

      const latest = await entryService.getLatestApproved(key.id, 'es-ES');
      expect(latest).toBeDefined();
      expect(latest?.id).toBe(approved.id);
      expect(latest?.text).toBe('Bienvenido');
    });

    it('should return null if no approved translation', async () => {
      const key = await keyService.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenido',
        createdBy: 'user-123',
        status: TranslationEntryStatus.DRAFT,
      });

      const latest = await entryService.getLatestApproved(key.id, 'es-ES');
      expect(latest).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update entry status', async () => {
      const key = await keyService.createKey({
        context: 'pages.login.title',
        defaultText: 'Welcome',
      });

      const entry = await entryService.createEntry({
        keyId: key.id,
        locale: 'es-ES',
        text: 'Bienvenido',
        createdBy: 'user-123',
        status: TranslationEntryStatus.DRAFT,
      });

      const updated = await entryService.updateStatus(
        entry.id,
        TranslationEntryStatus.APPROVED
      );

      expect(updated.status).toBe(TranslationEntryStatus.APPROVED);
    });
  });
});

