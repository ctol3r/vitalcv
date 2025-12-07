/**
 * B241A-I18N-004: LocaleDetection tests
 */

import { LocaleDetectionService } from '../localeDetection';

describe('LocaleDetectionService', () => {
  let service: LocaleDetectionService;

  beforeEach(() => {
    service = new LocaleDetectionService({
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'es-ES', 'fr-FR', 'de-DE'],
    });
  });

  describe('detectLocale', () => {
    it('should detect from session override', () => {
      const result = service.detectLocale({
        sessionOverride: 'es-ES',
        browserLocale: 'en-US',
      });

      expect(result.locale).toBe('es-ES');
    });

    it('should detect from user profile', () => {
      const result = service.detectLocale({
        userProfileLocale: 'fr-FR',
        browserLocale: 'en-US',
      });

      expect(result.locale).toBe('fr-FR');
    });

    it('should detect from browser locale', () => {
      const result = service.detectLocale({
        browserLocale: 'es-ES,es;q=0.9',
      });

      expect(result.locale).toBe('es-ES');
    });

    it('should fallback to default', () => {
      const result = service.detectLocale({
        browserLocale: 'zh-CN',
      });

      expect(result.locale).toBe('en-US');
    });

    it('should build fallback chain', () => {
      const result = service.detectLocale({
        browserLocale: 'es-ES',
      });

      expect(result.fallbackChain.length).toBeGreaterThan(0);
      expect(result.fallbackChain[0]).toBe('es-ES');
      expect(result.fallbackChain).toContain('en-US');
    });
  });

  describe('getFallbackChain', () => {
    it('should return fallback chain for locale', () => {
      const chain = service.getFallbackChain('es-ES');
      expect(chain).toContain('es-ES');
      expect(chain).toContain('en-US');
    });
  });
});

