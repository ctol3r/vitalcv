/**
 * B241B-I18N: Internationalization Service
 *
 * Complete i18n service with translation providers, formatting services,
 * consistency checking, and API endpoints.
 */

// Integrations
export * from './integrations/externalTranslationProvider';

// Utils
export * from './utils/translationConsistencyChecker';
export * from './utils/missingTranslationDetector';
export * from './utils/templatingUtilities';

// Services
export * from './services/translationImportExportService';
export * from './services/localeSwitchService';
export * from './services/currencyFormattingService';
export * from './services/dateTimeFormattingService';
export * from './services/numberFormattingService';

// B252B-I18N Services
export * from './services/translationService';
export * from './services/languageDetectionService';
export * from './services/currencyFormatService';
export * from './services/dateTimeFormatService';
export * from './services/unitConversionService';
export * from './services/pluralizationService';
export * from './services/languagePackImportExportService';

// Analytics
export * from './analytics/localizationMetricsService';

// Middleware
export * from './middleware/localeMiddleware';

// API
export * from './api/multilingualContentAPI';
export * from './api/i18nAPI';
