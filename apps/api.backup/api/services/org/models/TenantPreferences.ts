/**
 * Tenant Preferences Model
 * B113B-INTL-009: Organization configuration for language & region preferences
 *
 * Manages tenant-level internationalization settings including:
 * - Default locale/language
 * - Regional date/time/number formats
 * - Time zone
 * - Currency preferences
 */

import { z } from 'zod';

/**
 * Supported locales
 */
export enum Locale {
  EN_US = 'en-US',
  ES_ES = 'es-ES',
  FR_FR = 'fr-FR',
  DE_DE = 'de-DE',
  EN_GB = 'en-GB',
  EN_AU = 'en-AU',
  EN_CA = 'en-CA',
  FR_CA = 'fr-CA',
}

/**
 * Date format preferences
 */
export enum DateFormat {
  US = 'MM/DD/YYYY', // United States
  EU = 'DD/MM/YYYY', // Europe, AU, most of world
  ISO = 'YYYY-MM-DD', // ISO 8601
  LONG = 'MMMM D, YYYY', // Long format
}

/**
 * Time format preferences
 */
export enum TimeFormat {
  TWELVE_HOUR = '12h', // 12-hour with AM/PM
  TWENTY_FOUR_HOUR = '24h', // 24-hour
}

/**
 * Number format preferences
 */
export enum NumberFormat {
  US = '1,234.56', // US/UK: comma thousands, period decimal
  EU = '1.234,56', // EU: period thousands, comma decimal
  SPACE = '1 234,56', // French: space thousands, comma decimal
}

/**
 * Currency preferences
 */
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  AUD = 'AUD',
  CAD = 'CAD',
}

/**
 * Tenant preferences schema
 */
export const TenantPreferencesSchema = z.object({
  tenantId: z.string().uuid('Tenant ID must be a valid UUID'),

  // Localization preferences
  defaultLocale: z.nativeEnum(Locale).default(Locale.EN_US),
  fallbackLocale: z.nativeEnum(Locale).default(Locale.EN_US),
  supportedLocales: z.array(z.nativeEnum(Locale)).default([Locale.EN_US]),

  // Format preferences
  dateFormat: z.nativeEnum(DateFormat).default(DateFormat.US),
  timeFormat: z.nativeEnum(TimeFormat).default(TimeFormat.TWELVE_HOUR),
  numberFormat: z.nativeEnum(NumberFormat).default(NumberFormat.US),

  // Regional settings
  timeZone: z.string().default('America/New_York'),
  currency: z.nativeEnum(Currency).default(Currency.USD),

  // User preferences override
  allowUserOverride: z.boolean().default(true),

  // Translation settings
  autoTranslate: z.boolean().default(false),
  translationQuality: z.enum(['human', 'machine', 'hybrid']).default('machine'),

  // Metadata
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type TenantPreferences = z.infer<typeof TenantPreferencesSchema>;

/**
 * Tenant preferences creation input
 */
export const TenantPreferencesCreateSchema = TenantPreferencesSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type TenantPreferencesCreate = z.infer<typeof TenantPreferencesCreateSchema>;

/**
 * Tenant preferences update input
 */
export const TenantPreferencesUpdateSchema = z.object({
  tenantId: z.string().uuid(),
  defaultLocale: z.nativeEnum(Locale).optional(),
  fallbackLocale: z.nativeEnum(Locale).optional(),
  supportedLocales: z.array(z.nativeEnum(Locale)).optional(),
  dateFormat: z.nativeEnum(DateFormat).optional(),
  timeFormat: z.nativeEnum(TimeFormat).optional(),
  numberFormat: z.nativeEnum(NumberFormat).optional(),
  timeZone: z.string().optional(),
  currency: z.nativeEnum(Currency).optional(),
  allowUserOverride: z.boolean().optional(),
  autoTranslate: z.boolean().optional(),
  translationQuality: z.enum(['human', 'machine', 'hybrid']).optional(),
  updatedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type TenantPreferencesUpdate = z.infer<typeof TenantPreferencesUpdateSchema>;

/**
 * Locale to region mapping
 */
export const LOCALE_TO_REGION = {
  [Locale.EN_US]: 'US',
  [Locale.ES_ES]: 'EU',
  [Locale.FR_FR]: 'EU',
  [Locale.DE_DE]: 'EU',
  [Locale.EN_GB]: 'EU',
  [Locale.EN_AU]: 'AU',
  [Locale.EN_CA]: 'CA',
  [Locale.FR_CA]: 'CA',
} as const;

/**
 * Default preferences by region
 */
export const DEFAULT_PREFERENCES_BY_REGION = {
  US: {
    defaultLocale: Locale.EN_US,
    dateFormat: DateFormat.US,
    timeFormat: TimeFormat.TWELVE_HOUR,
    numberFormat: NumberFormat.US,
    timeZone: 'America/New_York',
    currency: Currency.USD,
  },
  EU: {
    defaultLocale: Locale.EN_GB,
    dateFormat: DateFormat.EU,
    timeFormat: TimeFormat.TWENTY_FOUR_HOUR,
    numberFormat: NumberFormat.EU,
    timeZone: 'Europe/London',
    currency: Currency.EUR,
  },
  AU: {
    defaultLocale: Locale.EN_AU,
    dateFormat: DateFormat.EU,
    timeFormat: TimeFormat.TWELVE_HOUR,
    numberFormat: NumberFormat.US,
    timeZone: 'Australia/Sydney',
    currency: Currency.AUD,
  },
  CA: {
    defaultLocale: Locale.EN_CA,
    dateFormat: DateFormat.US,
    timeFormat: TimeFormat.TWELVE_HOUR,
    numberFormat: NumberFormat.US,
    timeZone: 'America/Toronto',
    currency: Currency.CAD,
  },
} as const;

/**
 * Validate tenant preferences
 */
export function validateTenantPreferences(data: unknown): TenantPreferences {
  const parsed = TenantPreferencesSchema.parse(data);

  // Ensure defaultLocale is in supportedLocales
  if (!parsed.supportedLocales.includes(parsed.defaultLocale)) {
    throw new Error(
      `Default locale '${parsed.defaultLocale}' must be included in supported locales`
    );
  }

  // Ensure fallbackLocale is in supportedLocales
  if (!parsed.supportedLocales.includes(parsed.fallbackLocale)) {
    throw new Error(
      `Fallback locale '${parsed.fallbackLocale}' must be included in supported locales`
    );
  }

  return parsed;
}

/**
 * Create tenant preferences with regional defaults
 */
export function createTenantPreferencesForRegion(
  tenantId: string,
  region: 'US' | 'EU' | 'AU' | 'CA',
  overrides?: Partial<TenantPreferencesCreate>
): TenantPreferences {
  const defaults = DEFAULT_PREFERENCES_BY_REGION[region];

  const preferences: TenantPreferencesCreate = {
    tenantId,
    ...defaults,
    supportedLocales: [defaults.defaultLocale],
    fallbackLocale: defaults.defaultLocale,
    allowUserOverride: true,
    autoTranslate: false,
    translationQuality: 'machine',
    ...overrides,
  };

  return validateTenantPreferences({
    ...preferences,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Get format string for date based on preferences
 */
export function getDateFormatString(prefs: TenantPreferences): string {
  return prefs.dateFormat;
}

/**
 * Get format string for time based on preferences
 */
export function getTimeFormatString(prefs: TenantPreferences): string {
  return prefs.timeFormat === TimeFormat.TWELVE_HOUR ? 'hh:mm A' : 'HH:mm';
}

/**
 * Get format string for date-time based on preferences
 */
export function getDateTimeFormatString(prefs: TenantPreferences): string {
  return `${getDateFormatString(prefs)} ${getTimeFormatString(prefs)}`;
}

/**
 * Get Intl.NumberFormat options based on preferences
 */
export function getNumberFormatOptions(prefs: TenantPreferences): Intl.NumberFormatOptions {
  const locale = prefs.defaultLocale;

  return {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };
}

/**
 * Get Intl.DateTimeFormat options based on preferences
 */
export function getDateTimeFormatOptions(prefs: TenantPreferences): Intl.DateTimeFormatOptions {
  return {
    timeZone: prefs.timeZone,
    hour12: prefs.timeFormat === TimeFormat.TWELVE_HOUR,
  };
}

/**
 * Database migration helper
 */
export function generateTenantPreferencesMigration(): string {
  return `
-- Migration: Add Tenant Preferences for I18n
-- B113B-INTL-009
-- Generated: ${new Date().toISOString()}

-- Create enum types
CREATE TYPE locale AS ENUM (
  'en-US', 'es-ES', 'fr-FR', 'de-DE',
  'en-GB', 'en-AU', 'en-CA', 'fr-CA'
);

CREATE TYPE date_format AS ENUM ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MMMM D, YYYY');
CREATE TYPE time_format AS ENUM ('12h', '24h');
CREATE TYPE number_format AS ENUM ('1,234.56', '1.234,56', '1 234,56');
CREATE TYPE currency AS ENUM ('USD', 'EUR', 'GBP', 'AUD', 'CAD');
CREATE TYPE translation_quality AS ENUM ('human', 'machine', 'hybrid');

-- Create tenant_preferences table
CREATE TABLE IF NOT EXISTS tenant_preferences (
  tenant_id UUID PRIMARY KEY,

  -- Localization preferences
  default_locale locale NOT NULL DEFAULT 'en-US',
  fallback_locale locale NOT NULL DEFAULT 'en-US',
  supported_locales locale[] NOT NULL DEFAULT ARRAY['en-US']::locale[],

  -- Format preferences
  date_format date_format NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format time_format NOT NULL DEFAULT '12h',
  number_format number_format NOT NULL DEFAULT '1,234.56',

  -- Regional settings
  time_zone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
  currency currency NOT NULL DEFAULT 'USD',

  -- User preferences override
  allow_user_override BOOLEAN NOT NULL DEFAULT TRUE,

  -- Translation settings
  auto_translate BOOLEAN NOT NULL DEFAULT FALSE,
  translation_quality translation_quality NOT NULL DEFAULT 'machine',

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  notes TEXT,

  -- Constraints
  CONSTRAINT default_locale_in_supported CHECK (default_locale = ANY(supported_locales)),
  CONSTRAINT fallback_locale_in_supported CHECK (fallback_locale = ANY(supported_locales))
);

-- Indexes
CREATE INDEX idx_tenant_preferences_default_locale ON tenant_preferences(default_locale);
CREATE INDEX idx_tenant_preferences_time_zone ON tenant_preferences(time_zone);

-- Audit trigger for updated_at
CREATE OR REPLACE FUNCTION update_tenant_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_preferences_updated_at_trigger
  BEFORE UPDATE ON tenant_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_preferences_updated_at();

-- Insert example preferences
INSERT INTO tenant_preferences (
  tenant_id,
  default_locale,
  supported_locales,
  date_format,
  time_format,
  number_format,
  time_zone,
  currency,
  notes
) VALUES
  (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid,
    'en-US',
    ARRAY['en-US']::locale[],
    'MM/DD/YYYY',
    '12h',
    '1,234.56',
    'America/New_York',
    'USD',
    'US tenant - default settings'
  ),
  (
    'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'::uuid,
    'de-DE',
    ARRAY['de-DE', 'en-GB']::locale[],
    'DD/MM/YYYY',
    '24h',
    '1.234,56',
    'Europe/Berlin',
    'EUR',
    'EU tenant - German with English fallback'
  ),
  (
    'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f'::uuid,
    'en-AU',
    ARRAY['en-AU']::locale[],
    'DD/MM/YYYY',
    '12h',
    '1,234.56',
    'Australia/Sydney',
    'AUD',
    'AU tenant - Australian English'
  )
ON CONFLICT (tenant_id) DO NOTHING;

COMMENT ON TABLE tenant_preferences IS 'Tenant-level internationalization and format preferences';
COMMENT ON COLUMN tenant_preferences.default_locale IS 'Default locale for all tenant users';
COMMENT ON COLUMN tenant_preferences.fallback_locale IS 'Fallback locale when translations are missing';
COMMENT ON COLUMN tenant_preferences.supported_locales IS 'List of locales supported by this tenant';
COMMENT ON COLUMN tenant_preferences.allow_user_override IS 'Allow individual users to override tenant locale settings';
`;
}

/**
 * Example usage
 */
export const USAGE_EXAMPLES = `
# Tenant Preferences Usage Examples

## Create US tenant preferences
\`\`\`typescript
const usPrefs = createTenantPreferencesForRegion(
  'tenant-123',
  'US'
);
\`\`\`

## Create EU tenant with multiple locales
\`\`\`typescript
const euPrefs = createTenantPreferencesForRegion(
  'tenant-456',
  'EU',
  {
    defaultLocale: Locale.DE_DE,
    supportedLocales: [Locale.DE_DE, Locale.FR_FR, Locale.EN_GB],
    fallbackLocale: Locale.EN_GB,
  }
);
\`\`\`

## Format date according to tenant preferences
\`\`\`typescript
import { format } from 'date-fns';

const dateStr = getDateFormatString(prefs);
const formatted = format(new Date(), dateStr);
\`\`\`
`;

