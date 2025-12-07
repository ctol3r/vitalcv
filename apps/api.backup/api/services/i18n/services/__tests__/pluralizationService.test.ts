/**
 * Tests for PluralizationService
 */

import { PluralizationService } from '../pluralizationService';

describe('PluralizationService', () => {
  let service: PluralizationService;

  beforeEach(() => {
    service = new PluralizationService();
  });

  describe('formatPlural', () => {
    it('should format English plural correctly', () => {
      const forms = {
        one: '1 item',
        other: '{count} items',
      };

      expect(service.formatPlural(1, 'items', 'en', forms)).toBe('1 item');
      expect(service.formatPlural(0, 'items', 'en', forms)).toBe('0 items');
      expect(service.formatPlural(2, 'items', 'en', forms)).toBe('2 items');
      expect(service.formatPlural(100, 'items', 'en', forms)).toBe('100 items');
    });

    it('should format Russian plural correctly', () => {
      const forms = {
        one: '1 элемент',
        few: '{count} элемента',
        many: '{count} элементов',
        other: '{count} элементов',
      };

      expect(service.formatPlural(1, 'items', 'ru', forms)).toBe('1 элемент');
      expect(service.formatPlural(2, 'items', 'ru', forms)).toBe('2 элемента');
      expect(service.formatPlural(5, 'items', 'ru', forms)).toBe('5 элементов');
      expect(service.formatPlural(21, 'items', 'ru', forms)).toBe('21 элемент');
    });

    it('should format Polish plural correctly', () => {
      const forms = {
        one: '1 element',
        few: '{count} elementy',
        many: '{count} elementów',
        other: '{count} elementów',
      };

      expect(service.formatPlural(1, 'items', 'pl', forms)).toBe('1 element');
      expect(service.formatPlural(2, 'items', 'pl', forms)).toBe('2 elementy');
      expect(service.formatPlural(5, 'items', 'pl', forms)).toBe('5 elementów');
    });

    it('should format Arabic plural correctly', () => {
      const forms = {
        zero: 'لا عناصر',
        one: 'عنصر واحد',
        two: 'عنصران',
        few: '{count} عناصر',
        many: '{count} عنصر',
        other: '{count} عنصر',
      };

      expect(service.formatPlural(0, 'items', 'ar', forms)).toBe('لا عناصر');
      expect(service.formatPlural(1, 'items', 'ar', forms)).toBe('عنصر واحد');
      expect(service.formatPlural(2, 'items', 'ar', forms)).toBe('عنصران');
      expect(service.formatPlural(3, 'items', 'ar', forms)).toBe('3 عناصر');
    });

    it('should handle languages without plural forms (Japanese)', () => {
      const forms = {
        other: '{count} アイテム',
      };

      expect(service.formatPlural(1, 'items', 'ja', forms)).toBe('1 アイテム');
      expect(service.formatPlural(100, 'items', 'ja', forms)).toBe('100 アイテム');
    });

    it('should fallback to other form when specific form not provided', () => {
      const forms = {
        one: '1 item',
        other: '{count} items',
      };

      expect(service.formatPlural(0, 'items', 'en', forms)).toBe('0 items');
      expect(service.formatPlural(2, 'items', 'en', forms)).toBe('2 items');
    });

    it('should handle locale codes with region', () => {
      const forms = {
        one: '1 item',
        other: '{count} items',
      };

      expect(service.formatPlural(1, 'items', 'en-US', forms)).toBe('1 item');
      expect(service.formatPlural(2, 'items', 'en-GB', forms)).toBe('2 items');
    });
  });

  describe('registerPluralRule', () => {
    it('should register and use custom plural rule', () => {
      const customRule = (count: number) => {
        if (count === 1) return 'one';
        if (count === 2) return 'two';
        return 'other';
      };

      service.registerPluralRule('custom', customRule);

      const forms = {
        one: '1 item',
        two: '2 items',
        other: '{count} items',
      };

      expect(service.formatPlural(1, 'items', 'custom', forms)).toBe('1 item');
      expect(service.formatPlural(2, 'items', 'custom', forms)).toBe('2 items');
      expect(service.formatPlural(3, 'items', 'custom', forms)).toBe('3 items');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return list of supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(languages).toContain('en');
      expect(languages).toContain('ru');
      expect(languages).toContain('pl');
      expect(languages).toContain('ar');
      expect(languages.length).toBeGreaterThan(0);
    });
  });
});

