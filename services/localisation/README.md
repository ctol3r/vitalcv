# Localisation Service

## B230A-INTL: Internationalization Infrastructure

This service provides comprehensive internationalization (i18n) support for the Chai VC Platform, including translation management, locale-aware formatting, and currency conversion.

## Features

### 1. i18n Infrastructure (`i18nConfig.ts`)
- Central i18next configuration for server and client
- Locale detection with multiple strategies (user preference, org settings, Accept-Language header, storage, system)
- Dynamic translation resource loading
- Fallback chain support

### 2. Locale Helpers (`localeHelpers.ts`)
- Date/time formatting with timezone support
- Number and currency formatting
- Percentage formatting
- Pluralization support
- Relative time formatting
- File size and duration formatting

### 3. Translation Resource Management (`translationManager.ts`)
- JSON-based translation file management
- Versioning support
- Fallback chains
- Translation overrides
- CLI tool for managing translations
- Validation and import/export functionality

### 4. Currency Converter (`currencyConverter.ts`)
- Real-time exchange rate fetching
- Rate caching with TTL
- Fallback scenarios
- Batch conversion support
- Locale-aware currency selection

## Installation

```bash
cd services/localisation
npm install
```

## Usage

### Server-Side

```typescript
import { initServerI18n, detectLocale } from '@chai-vc/localisation';

// Initialize i18n
await initServerI18n('en-US');

// Detect locale
const locale = await detectLocale({
  checkUserPreference: async () => {
    // Check user preference from database
    return 'en-US';
  },
  checkAcceptLanguage: (header) => {
    return parseAcceptLanguage(header);
  },
});

// Use translations
import { i18next } from '@chai-vc/localisation';
const translation = i18next.t('common.save');
```

### Client-Side (React/Next.js)

```typescript
import { useTranslation, Translation, useDateFormat, useNumberFormat } from '@/i18n';

function MyComponent() {
  const { t, locale, changeLocale } = useTranslation();
  const { formatDate, formatCurrency } = useDateFormat();
  const { formatNumber } = useNumberFormat();

  return (
    <div>
      <Translation keyPath="common.save" />
      <p>{formatDate(new Date())}</p>
      <p>{formatCurrency(100, 'USD')}</p>
      <button onClick={() => changeLocale('es-ES')}>
        Switch to Spanish
      </button>
    </div>
  );
}
```

### Locale Helpers

```typescript
import {
  formatDate,
  formatTime,
  formatCurrency,
  formatPlural,
  getTimezone,
} from '@chai-vc/localisation';

// Format dates
const dateStr = formatDate(new Date(), { year: 'numeric', month: 'long' }, 'en-US');

// Format currency
const price = formatCurrency(99.99, 'USD', {}, 'en-US');

// Pluralization
const message = formatPlural(5, {
  one: '{{count}} item',
  other: '{{count}} items'
}, 'en-US');
```

### Currency Conversion

```typescript
import { currencyConverter, convertCurrency } from '@chai-vc/localisation';

// Convert currency
const converted = await convertCurrency(100, 'USD', 'EUR');

// Format with conversion
const formatted = await formatCurrencyAmount(100, 'USD', 'EUR', 'en-US');
```

## CLI Tool

The translation management CLI provides commands for managing translation resources:

```bash
# Add a translation
npm run cli add -l en-US -n common -k "app.name" -v "Chai VC Platform"

# List all keys
npm run cli list -l en-US -n common

# Find missing translations
npm run cli missing -l es-ES -r en-US

# Export translations
npm run cli export -l en-US -n common -o translations.json

# Import translations
npm run cli import -l es-ES -n common -f translations.json

# Validate translations
npm run cli validate -l en-US -n common
```

## Translation File Structure

Translation files are stored in JSON format:

```
locales/
├── en-US/
│   ├── common.json
│   ├── errors.json
│   ├── validation.json
│   └── ui.json
├── es-ES/
│   ├── common.json
│   └── ...
└── ...
```

Example `common.json`:
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading...",
    "error": "Error"
  },
  "navigation": {
    "home": "Home",
    "dashboard": "Dashboard"
  }
}
```

## Supported Locales

- `en-US` - English (United States)
- `en-GB` - English (United Kingdom)
- `es-ES` - Spanish (Spain)
- `fr-FR` - French (France)
- `de-DE` - German (Germany)
- `ja-JP` - Japanese (Japan)
- `zh-CN` - Chinese (Simplified, China)

## Locale Detection Strategy

The locale detection follows this priority order:

1. User preference (from database/session)
2. Organization settings
3. Accept-Language HTTP header
4. Storage (cookie/localStorage)
5. System/browser locale
6. Default locale (en-US)

## Currency Support

Supported currencies:
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- CNY (Chinese Yuan)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)
- CHF (Swiss Franc)
- INR (Indian Rupee)
- BRL (Brazilian Real)

## API Reference

See individual file documentation:
- `i18nConfig.ts` - i18n configuration and locale detection
- `localeHelpers.ts` - Formatting helpers
- `translationManager.ts` - Translation resource management
- `currencyConverter.ts` - Currency conversion service

## Testing

```bash
npm test
```

## Contributing

When adding new translations:

1. Use the CLI tool to add translations
2. Ensure all locales have translations (use `missing` command)
3. Validate translations before committing
4. Update this README if adding new features
