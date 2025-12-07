# i18n Service

B241A-I18N: Internationalization (i18n) service for Chai VC Platform

## Overview

This service provides comprehensive internationalization capabilities including translation management, locale detection, timezone handling, address/phone formatting, currency conversion, and unit conversion.

## Features

### Models

- **TranslationKey** (B241A-I18N-001): Central registry of all translatable strings
  - Fields: `id`, `context` (path in code), `defaultText`, `createdAt`, `updatedAt`

- **TranslationEntry** (B241A-I18N-002): Translations for specific locales
  - Fields: `id`, `keyId`, `locale`, `text`, `version`, `status` (draft/approved), `createdBy`, `createdAt`, `updatedAt`
  - Supports versioning and approval workflow

### Services

- **TranslationManagementService** (B241A-I18N-003)
  - CRUD operations for translation keys and entries
  - Batch import/export (JSON, CSV)
  - External translation provider integration
  - Operation logging

- **LocaleDetection & FallbackService** (B241A-I18N-004)
  - Detects user locale from browser settings, user profile, or geo-IP
  - Implements fallback logic for missing translations
  - Supports session override

- **TimezoneUtility** (B241A-I18N-005)
  - Timezone conversion between zones
  - Lists supported timezones with offsets
  - Handles daylight saving time
  - Formats datetime for display and storage

- **AddressFormatter** (B241A-I18N-006)
  - Formats addresses according to country-specific standards
  - Supports multiple regions (US, UK, Germany, France, Japan, China, India, etc.)
  - Returns correctly ordered and punctuated strings

- **PhoneNumberFormatter** (B241A-I18N-007)
  - Normalizes and formats phone numbers
  - Validates numbers per country
  - Returns E.164 for storage and locale-specific display

- **CountryRegionDataProvider** (B241A-I18N-008)
  - Provides structured data for countries and regions
  - Includes names, codes, primary language, currency, timezone
  - Caches data for performance

- **CurrencyConversionEngine** (B241A-I18N-009)
  - Fetches exchange rates (mock/stub implementation)
  - Converts amounts between currencies
  - Caches rates and refreshes daily
  - Handles rounding and edge cases

- **MeasurementUnitsConverter** (B241A-I18N-010)
  - Converts units (metric to imperial)
  - Supports lengths, weights, volumes, temperatures
  - Returns converted value and unit

## Installation

```bash
cd services/i18n
npm install
```

## Usage

### Translation Management

```typescript
import { PrismaClient } from '@prisma/client';
import { TranslationManagementService } from '@chai-vc/i18n';

const prisma = new PrismaClient();
const service = new TranslationManagementService(prisma);

// Create a translation key
const key = await service.createKey('pages.login.title', 'Welcome');

// Create a translation entry
await service.createEntry(
  key.id,
  'es-ES',
  'Bienvenido',
  'user-123',
  TranslationEntryStatus.APPROVED
);

// Get translation with fallback
const translation = await service.getTranslation('pages.login.title', 'es-ES');
```

### Locale Detection

```typescript
import { LocaleDetectionService } from '@chai-vc/i18n';

const detector = new LocaleDetectionService({
  defaultLocale: 'en-US',
  supportedLocales: ['en-US', 'es-ES', 'fr-FR'],
});

const locale = detector.detectLocale({
  browserLocale: 'es-ES,es;q=0.9',
  userProfileLocale: 'fr-FR',
});
```

### Timezone Utility

```typescript
import { TimezoneUtility } from '@chai-vc/i18n';

const tz = new TimezoneUtility();

// Convert timezone
const converted = tz.convertTimezone(
  new Date(),
  'UTC',
  'America/New_York'
);

// Format for display
const formatted = tz.formatDateTime(
  new Date(),
  'America/New_York'
);
```

### Address Formatting

```typescript
import { AddressFormatter } from '@chai-vc/i18n';

const formatter = new AddressFormatter();

const formatted = formatter.formatAddress({
  street: '123 Main St',
  city: 'San Francisco',
  region: 'CA',
  postalCode: '94102',
  countryCode: 'US',
});
```

### Phone Number Formatting

```typescript
import { PhoneNumberFormatter } from '@chai-vc/i18n';

const formatter = new PhoneNumberFormatter();

const formatted = formatter.formatPhoneNumber({
  number: '4155552671',
  countryCode: 'US',
});

// Returns: { e164: '+14155552671', international: '+1 415-555-2671', ... }
```

### Currency Conversion

```typescript
import { CurrencyConversionEngine } from '@chai-vc/i18n';

const engine = new CurrencyConversionEngine();

const result = await engine.convert(100, 'USD', 'EUR');
```

### Unit Conversion

```typescript
import { MeasurementUnitsConverter } from '@chai-vc/i18n';

const converter = new MeasurementUnitsConverter();

const result = converter.convert({
  value: 100,
  fromUnit: 'm',
  toUnit: 'ft',
  unitType: 'length',
});
```

## Database Migration

Run the migration to create the necessary tables:

```bash
cd backend
npx prisma migrate dev --name add_i18n_models
```

## Testing

```bash
npm test
```

## Structure

```
services/i18n/
├── models/
│   ├── TranslationKey.ts
│   ├── TranslationEntry.ts
│   └── __tests__/
├── services/
│   ├── translationManagementService.ts
│   ├── localeDetection.ts
│   ├── timezoneUtility.ts
│   ├── addressFormatter.ts
│   ├── phoneNumberFormatter.ts
│   ├── currencyConversionEngine.ts
│   ├── measurementUnitsConverter.ts
│   └── __tests__/
├── data/
│   └── countryRegionDataProvider.ts
├── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

- `@prisma/client`: Database client
- `libphonenumber-js`: Phone number formatting
- `luxon`: Timezone handling
- `papaparse`: CSV parsing

## Notes

- Currency conversion uses mock data by default. Replace with real API integration in production.
- Country/region data is static. Consider loading from external sources in production.
- Translation provider integration is extensible via the `ExternalTranslationProvider` interface.

