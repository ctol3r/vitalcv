/**
 * B252A-I18N-010: i18nModelsTests suite
 *
 * Comprehensive tests verifying TranslationKey, TranslationLanguage, TranslationValue,
 * LanguagePack, Country, Currency, Unit, Timezone, UserLocaleSetting models:
 * relationships, constraints, uniqueness
 */

import { PrismaClient, TextDirection, TranslationValueStatus, UnitCategory } from '@prisma/client';
import { TranslationKeyService } from '../models/TranslationKey';
import { TranslationLanguageService } from '../models/TranslationLanguage';
import { TranslationValueService } from '../models/TranslationValue';
import { LanguagePackService } from '../models/LanguagePack';
import { CountryService } from '../models/Country';
import { CurrencyService } from '../models/Currency';
import { UnitService } from '../models/Unit';
import { TimezoneService } from '../models/Timezone';
import { UserLocaleSettingService } from '../models/UserLocaleSetting';

describe('i18n Models Tests', () => {
  let prisma: PrismaClient;
  let translationKeyService: TranslationKeyService;
  let translationLanguageService: TranslationLanguageService;
  let translationValueService: TranslationValueService;
  let languagePackService: LanguagePackService;
  let countryService: CountryService;
  let currencyService: CurrencyService;
  let unitService: UnitService;
  let timezoneService: TimezoneService;
  let userLocaleSettingService: UserLocaleSettingService;

  beforeAll(() => {
    prisma = new PrismaClient();
    translationKeyService = new TranslationKeyService(prisma);
    translationLanguageService = new TranslationLanguageService(prisma);
    translationValueService = new TranslationValueService(prisma);
    languagePackService = new LanguagePackService(prisma);
    countryService = new CountryService(prisma);
    currencyService = new CurrencyService(prisma);
    unitService = new UnitService(prisma);
    timezoneService = new TimezoneService(prisma);
    userLocaleSettingService = new UserLocaleSettingService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.userLocaleSetting.deleteMany();
    await prisma.languagePack.deleteMany();
    await prisma.translationValue.deleteMany();
    await prisma.translationKeyB252A.deleteMany();
    await prisma.translationLanguage.deleteMany();
    await prisma.country.deleteMany();
    await prisma.currency.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.timezone.deleteMany();
  });

  describe('TranslationKey', () => {
    it('should create a translation key with all fields', async () => {
      const key = await translationKeyService.createKey({
        key: 'common.welcome',
        defaultMessage: 'Welcome',
        description: 'Welcome message',
      });

      expect(key).toBeDefined();
      expect(key.key).toBe('common.welcome');
      expect(key.defaultMessage).toBe('Welcome');
      expect(key.description).toBe('Welcome message');
      expect(key.id).toBeDefined();
      expect(key.createdAt).toBeDefined();
      expect(key.updatedAt).toBeDefined();
    });

    it('should create a translation key without description', async () => {
      const key = await translationKeyService.createKey({
        key: 'common.hello',
        defaultMessage: 'Hello',
      });

      expect(key).toBeDefined();
      expect(key.description).toBeNull();
    });

    it('should enforce key uniqueness', async () => {
      await translationKeyService.createKey({
        key: 'common.unique',
        defaultMessage: 'Unique',
      });

      await expect(
        translationKeyService.createKey({
          key: 'common.unique',
          defaultMessage: 'Duplicate',
        })
      ).rejects.toThrow();
    });

    it('should retrieve a key by key string', async () => {
      const created = await translationKeyService.createKey({
        key: 'common.test',
        defaultMessage: 'Test',
      });

      const retrieved = await translationKeyService.getKeyByKey('common.test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should update a translation key', async () => {
      const key = await translationKeyService.createKey({
        key: 'common.update',
        defaultMessage: 'Original',
      });

      const updated = await translationKeyService.updateKey(key.id, {
        defaultMessage: 'Updated',
      });

      expect(updated.defaultMessage).toBe('Updated');
    });
  });

  describe('TranslationLanguage', () => {
    it('should create a translation language with all fields', async () => {
      const language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
        direction: TextDirection.LTR,
        enabled: true,
      });

      expect(language).toBeDefined();
      expect(language.languageCode).toBe('en');
      expect(language.name).toBe('English');
      expect(language.nativeName).toBe('English');
      expect(language.direction).toBe(TextDirection.LTR);
      expect(language.enabled).toBe(true);
    });

    it('should default to LTR and enabled', async () => {
      const language = await translationLanguageService.createLanguage({
        languageCode: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
      });

      expect(language.direction).toBe(TextDirection.LTR); // Default
      expect(language.enabled).toBe(true); // Default
    });

    it('should enforce language code uniqueness', async () => {
      await translationLanguageService.createLanguage({
        languageCode: 'es',
        name: 'Spanish',
        nativeName: 'Español',
      });

      await expect(
        translationLanguageService.createLanguage({
          languageCode: 'es',
          name: 'Spanish Duplicate',
          nativeName: 'Español',
        })
      ).rejects.toThrow();
    });

    it('should retrieve a language by code', async () => {
      const created = await translationLanguageService.createLanguage({
        languageCode: 'fr',
        name: 'French',
        nativeName: 'Français',
      });

      const retrieved = await translationLanguageService.getLanguageByCode('fr');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });
  });

  describe('TranslationValue', () => {
    let translationKey: any;
    let language: any;

    beforeEach(async () => {
      translationKey = await translationKeyService.createKey({
        key: 'test.key',
        defaultMessage: 'Test',
      });
      language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      });
    });

    it('should create a translation value', async () => {
      const value = await translationValueService.createValue({
        translationKeyId: translationKey.id,
        languageId: language.id,
        value: 'Test Translation',
        status: TranslationValueStatus.APPROVED,
      });

      expect(value).toBeDefined();
      expect(value.translationKeyId).toBe(translationKey.id);
      expect(value.languageId).toBe(language.id);
      expect(value.value).toBe('Test Translation');
      expect(value.status).toBe(TranslationValueStatus.APPROVED);
    });

    it('should default to DRAFT status', async () => {
      const value = await translationValueService.createValue({
        translationKeyId: translationKey.id,
        languageId: language.id,
        value: 'Draft Translation',
      });

      expect(value.status).toBe(TranslationValueStatus.DRAFT);
    });

    it('should enforce unique key-language combination', async () => {
      await translationValueService.createValue({
        translationKeyId: translationKey.id,
        languageId: language.id,
        value: 'First',
      });

      await expect(
        translationValueService.createValue({
          translationKeyId: translationKey.id,
          languageId: language.id,
          value: 'Second',
        })
      ).rejects.toThrow();
    });

    it('should retrieve value by key and language', async () => {
      const created = await translationValueService.createValue({
        translationKeyId: translationKey.id,
        languageId: language.id,
        value: 'Retrieved',
      });

      const retrieved = await translationValueService.getValueByKeyAndLanguage(
        translationKey.id,
        language.id
      );
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });
  });

  describe('LanguagePack', () => {
    let language: any;

    beforeEach(async () => {
      language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      });
    });

    it('should create a language pack', async () => {
      const pack = await languagePackService.createPack({
        languageId: language.id,
        version: '1.0.0',
        exportedAt: new Date(),
        data: { 'common.welcome': 'Welcome', 'common.hello': 'Hello' },
      });

      expect(pack).toBeDefined();
      expect(pack.languageId).toBe(language.id);
      expect(pack.version).toBe('1.0.0');
      expect(pack.data).toEqual({ 'common.welcome': 'Welcome', 'common.hello': 'Hello' });
    });

    it('should retrieve latest pack for a language', async () => {
      await languagePackService.createPack({
        languageId: language.id,
        version: '1.0.0',
        exportedAt: new Date('2024-01-01'),
        data: {},
      });

      const latest = await languagePackService.createPack({
        languageId: language.id,
        version: '2.0.0',
        exportedAt: new Date('2024-01-02'),
        data: {},
      });

      const retrieved = await languagePackService.getLatestPack(language.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(latest.id);
    });
  });

  describe('Country', () => {
    it('should create a country with all fields', async () => {
      const country = await countryService.createCountry({
        isoCode: 'US',
        name: 'United States',
        nativeName: 'United States',
        currencyCode: 'USD',
        primaryLanguageCode: 'en',
        region: 'North America',
      });

      expect(country).toBeDefined();
      expect(country.isoCode).toBe('US');
      expect(country.name).toBe('United States');
      expect(country.currencyCode).toBe('USD');
      expect(country.primaryLanguageCode).toBe('en');
      expect(country.region).toBe('North America');
    });

    it('should enforce ISO code uniqueness', async () => {
      await countryService.createCountry({
        isoCode: 'GB',
        name: 'United Kingdom',
        nativeName: 'United Kingdom',
        currencyCode: 'GBP',
        primaryLanguageCode: 'en',
        region: 'Europe',
      });

      await expect(
        countryService.createCountry({
          isoCode: 'GB',
          name: 'Great Britain',
          nativeName: 'Great Britain',
          currencyCode: 'GBP',
          primaryLanguageCode: 'en',
          region: 'Europe',
        })
      ).rejects.toThrow();
    });

    it('should list countries by region', async () => {
      await countryService.createCountry({
        isoCode: 'US',
        name: 'United States',
        nativeName: 'United States',
        currencyCode: 'USD',
        primaryLanguageCode: 'en',
        region: 'North America',
      });

      await countryService.createCountry({
        isoCode: 'CA',
        name: 'Canada',
        nativeName: 'Canada',
        currencyCode: 'CAD',
        primaryLanguageCode: 'en',
        region: 'North America',
      });

      const countries = await countryService.listCountriesByRegion('North America');
      expect(countries.length).toBe(2);
    });
  });

  describe('Currency', () => {
    it('should create a currency with all fields', async () => {
      const currency = await currencyService.createCurrency({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
        rounding: 'half-up',
        exchangeRate: 1.0,
      });

      expect(currency).toBeDefined();
      expect(currency.code).toBe('USD');
      expect(currency.name).toBe('US Dollar');
      expect(currency.symbol).toBe('$');
      expect(currency.decimalPlaces).toBe(2);
      expect(currency.rounding).toBe('half-up');
      expect(currency.exchangeRate).toBe(1.0);
    });

    it('should default decimal places to 2', async () => {
      const currency = await currencyService.createCurrency({
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
      });

      expect(currency.decimalPlaces).toBe(2);
    });

    it('should enforce code uniqueness', async () => {
      await currencyService.createCurrency({
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
      });

      await expect(
        currencyService.createCurrency({
          code: 'EUR',
          name: 'Euro Duplicate',
          symbol: '€',
        })
      ).rejects.toThrow();
    });
  });

  describe('Unit', () => {
    it('should create a unit with all fields', async () => {
      const unit = await unitService.createUnit({
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1.0,
      });

      expect(unit).toBeDefined();
      expect(unit.name).toBe('meter');
      expect(unit.symbol).toBe('m');
      expect(unit.category).toBe(UnitCategory.LENGTH);
      expect(unit.conversionFactor).toBe(1.0);
    });

    it('should enforce name-symbol uniqueness', async () => {
      await unitService.createUnit({
        name: 'kilogram',
        symbol: 'kg',
        category: UnitCategory.WEIGHT,
        conversionFactor: 1000.0,
      });

      await expect(
        unitService.createUnit({
          name: 'kilogram',
          symbol: 'kg',
          category: UnitCategory.WEIGHT,
          conversionFactor: 1000.0,
        })
      ).rejects.toThrow();
    });

    it('should list units by category', async () => {
      await unitService.createUnit({
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1.0,
      });

      await unitService.createUnit({
        name: 'kilometer',
        symbol: 'km',
        category: UnitCategory.LENGTH,
        conversionFactor: 1000.0,
      });

      const units = await unitService.listUnitsByCategory(UnitCategory.LENGTH);
      expect(units.length).toBe(2);
    });
  });

  describe('Timezone', () => {
    it('should create a timezone with all fields', async () => {
      const timezone = await timezoneService.createTimezone({
        name: 'America/Los_Angeles',
        offsetMinutes: -480,
        observesDST: true,
        region: 'North America',
      });

      expect(timezone).toBeDefined();
      expect(timezone.name).toBe('America/Los_Angeles');
      expect(timezone.offsetMinutes).toBe(-480);
      expect(timezone.observesDST).toBe(true);
      expect(timezone.region).toBe('North America');
    });

    it('should enforce name uniqueness', async () => {
      await timezoneService.createTimezone({
        name: 'America/New_York',
        offsetMinutes: -300,
        observesDST: true,
        region: 'North America',
      });

      await expect(
        timezoneService.createTimezone({
          name: 'America/New_York',
          offsetMinutes: -300,
          observesDST: true,
          region: 'North America',
        })
      ).rejects.toThrow();
    });

    it('should list timezones by region', async () => {
      await timezoneService.createTimezone({
        name: 'America/Los_Angeles',
        offsetMinutes: -480,
        observesDST: true,
        region: 'North America',
      });

      await timezoneService.createTimezone({
        name: 'America/New_York',
        offsetMinutes: -300,
        observesDST: true,
        region: 'North America',
      });

      const timezones = await timezoneService.listTimezonesByRegion('North America');
      expect(timezones.length).toBe(2);
    });
  });

  describe('UserLocaleSetting', () => {
    let user: any;
    let language: any;
    let country: any;
    let timezone: any;

    beforeEach(async () => {
      // Create a test user
      user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      });

      country = await countryService.createCountry({
        isoCode: 'US',
        name: 'United States',
        nativeName: 'United States',
        currencyCode: 'USD',
        primaryLanguageCode: 'en',
        region: 'North America',
      });

      timezone = await timezoneService.createTimezone({
        name: 'America/New_York',
        offsetMinutes: -300,
        observesDST: true,
        region: 'North America',
      });
    });

    afterEach(async () => {
      await prisma.user.deleteMany({ where: { email: 'test@example.com' } });
    });

    it('should create a user locale setting with all fields', async () => {
      const setting = await userLocaleSettingService.createSetting({
        userId: user.id,
        languageId: language.id,
        countryId: country.id,
        timezoneId: timezone.id,
        currencyCode: 'USD',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: '#,##0.00',
      });

      expect(setting).toBeDefined();
      expect(setting.userId).toBe(user.id);
      expect(setting.languageId).toBe(language.id);
      expect(setting.countryId).toBe(country.id);
      expect(setting.timezoneId).toBe(timezone.id);
      expect(setting.currencyCode).toBe('USD');
      expect(setting.dateFormat).toBe('MM/DD/YYYY');
      expect(setting.numberFormat).toBe('#,##0.00');
    });

    it('should enforce user uniqueness', async () => {
      await userLocaleSettingService.createSetting({
        userId: user.id,
        languageId: language.id,
      });

      await expect(
        userLocaleSettingService.createSetting({
          userId: user.id,
          languageId: language.id,
        })
      ).rejects.toThrow();
    });

    it('should retrieve setting by user ID', async () => {
      const created = await userLocaleSettingService.createSetting({
        userId: user.id,
        languageId: language.id,
      });

      const retrieved = await userLocaleSettingService.getSettingByUserId(user.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should update setting by user ID', async () => {
      await userLocaleSettingService.createSetting({
        userId: user.id,
        languageId: language.id,
      });

      const updated = await userLocaleSettingService.updateSettingByUserId(user.id, {
        currencyCode: 'EUR',
      });

      expect(updated.currencyCode).toBe('EUR');
    });
  });

  describe('Model Relationships', () => {
    it('should cascade delete translation values when key is deleted', async () => {
      const key = await translationKeyService.createKey({
        key: 'test.cascade',
        defaultMessage: 'Test',
      });

      const language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      });

      await translationValueService.createValue({
        translationKeyId: key.id,
        languageId: language.id,
        value: 'Test Value',
      });

      await translationKeyService.deleteKey(key.id);

      const values = await translationValueService.listValuesByKey(key.id);
      expect(values.length).toBe(0);
    });

    it('should cascade delete translation values when language is deleted', async () => {
      const key = await translationKeyService.createKey({
        key: 'test.cascade2',
        defaultMessage: 'Test',
      });

      const language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      });

      await translationValueService.createValue({
        translationKeyId: key.id,
        languageId: language.id,
        value: 'Test Value',
      });

      await translationLanguageService.deleteLanguage(language.id);

      const values = await translationValueService.listValuesByLanguage(language.id);
      expect(values.length).toBe(0);
    });

    it('should set null on user locale setting when language is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'cascade@example.com',
          name: 'Cascade User',
        },
      });

      const language = await translationLanguageService.createLanguage({
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      });

      const setting = await userLocaleSettingService.createSetting({
        userId: user.id,
        languageId: language.id,
      });

      await translationLanguageService.deleteLanguage(language.id);

      const updated = await userLocaleSettingService.getSettingById(setting.id);
      expect(updated?.languageId).toBeNull();

      await prisma.user.delete({ where: { id: user.id } });
    });
  });
});

