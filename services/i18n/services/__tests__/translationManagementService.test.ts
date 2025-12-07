/**
 * B241A-I18N-003: TranslationManagementService tests
 */

import { PrismaClient, TranslationEntryStatus } from '@prisma/client';
import { TranslationManagementService } from '../translationManagementService';

describe('TranslationManagementService', () => {
  let prisma: PrismaClient;
  let service: TranslationManagementService;

  beforeAll(() => {
    prisma = new PrismaClient();
    service = new TranslationManagementService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.translationEntry.deleteMany();
    await prisma.translationKey.deleteMany();
  });

  describe('getTranslation', () => {
    it('should get translation with fallback to default', async () => {
      const key = await service.createKey('pages.login.title', 'Welcome');

      // No translation entry, should return default
      const translation = await service.getTranslation('pages.login.title', 'es-ES');
      expect(translation).toBe('Welcome');
    });

    it('should get approved translation', async () => {
      const key = await service.createKey('pages.login.title', 'Welcome');
      await service.createEntry(
        key.id,
        'es-ES',
        'Bienvenido',
        'user-123',
        TranslationEntryStatus.APPROVED
      );

      const translation = await service.getTranslation('pages.login.title', 'es-ES');
      expect(translation).toBe('Bienvenido');
    });
  });

  describe('importFromJSON', () => {
    it('should import translations from JSON', async () => {
      const data = [
        {
          context: 'pages.login.title',
          defaultText: 'Welcome',
          locale: 'es-ES',
          text: 'Bienvenido',
        },
        {
          context: 'pages.login.subtitle',
          defaultText: 'Please sign in',
          locale: 'es-ES',
          text: 'Por favor inicia sesión',
        },
      ];

      const result = await service.importFromJSON(data, 'user-123');
      expect(result.keysCreated).toBe(2);
      expect(result.entriesCreated).toBe(2);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('exportToJSON', () => {
    it('should export translations to JSON', async () => {
      const key = await service.createKey('pages.login.title', 'Welcome');
      await service.createEntry(
        key.id,
        'es-ES',
        'Bienvenido',
        'user-123',
        TranslationEntryStatus.APPROVED
      );

      const exported = await service.exportToJSON();
      expect(exported.length).toBeGreaterThan(0);
      expect(exported.some((e) => e.context === 'pages.login.title')).toBe(true);
    });
  });
});

