/**
 * GDPR DSAR Export with Localization
 * B113B-INTL-006: Localized field labels per user locale
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = Router();
const prisma = new PrismaClient();

// Supported locales
type Locale = 'en' | 'es' | 'fr' | 'de';

// Load localization files
const localeCache = new Map<Locale, any>();

function loadLocale(locale: Locale): any {
  if (localeCache.has(locale)) {
    return localeCache.get(locale);
  }

  try {
    const localeFile = readFileSync(
      join(__dirname, '../../../../../../locales', locale, 'dsar.json'),
      'utf-8'
    );
    const parsed = JSON.parse(localeFile);
    localeCache.set(locale, parsed);
    return parsed;
  } catch (error) {
    console.warn(`Failed to load locale ${locale}, falling back to en`);
    // Fallback to English
    if (locale !== 'en') {
      return loadLocale('en');
    }
    throw error;
  }
}

function getLocalizedLabel(locale: Locale, key: string): string {
  try {
    const localeData = loadLocale(locale);
    const keys = key.split('.');
    let value: any = localeData;

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key; // Fallback to key if not found
  } catch (error) {
    return key; // Fallback to key on error
  }
}

interface DSARExportOptions {
  userId: string;
  locale?: Locale;
  format?: 'json' | 'csv' | 'pdf';
  includeAccessLogs?: boolean;
  includeAuditLogs?: boolean;
}

async function generateDSARExport(options: DSARExportOptions): Promise<{
  data: any;
  locale: Locale;
}> {
  const locale = options.locale || 'en';
  const t = (key: string) => getLocalizedLabel(locale, key);

  // Fetch user data
  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    include: {
      credentials: true,
      npiClaims: true,
      verifications: options.includeAccessLogs,
      accessLogs: options.includeAccessLogs,
      consentRecords: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Build localized export structure
  const exportData = {
    [t('dsar.export.title')]: t('dsar.export.description'),
    [t('dsar.export.generatedAt')]: new Date().toISOString(),
    [t('dsar.export.requestId')]: `DSAR-${Date.now()}`,

    [t('dsar.sections.summary')]: {
      [t('dsar.fields.userId')]: user.id,
      [t('dsar.fields.email')]: user.email,
      [t('dsar.fields.name')]: user.name,
      [t('dsar.fields.phone')]: user.phone || 'N/A',
      [t('dsar.fields.npi')]: user.npiClaims[0]?.npi || 'N/A',
    },

    [t('dsar.sections.personalData')]: {
      [t('dsar.fields.userId')]: user.id,
      [t('dsar.fields.email')]: user.email,
      [t('dsar.fields.name')]: user.name,
      [t('dsar.fields.metadata')]: user.metadata || {},
    },

    [t('dsar.sections.professionalData')]: {
      [t('dsar.fields.credentials')]: user.credentials.map((cred) => ({
        [t('dsar.fields.credentialId')]: cred.id,
        [t('dsar.fields.credentialType')]: cred.type,
        [t('dsar.fields.issuer')]: cred.issuer,
        [t('dsar.fields.issuedAt')]: cred.issuedAt,
        [t('dsar.fields.expiresAt')]: cred.expiresAt,
        [t('dsar.fields.status')]: cred.status,
      })),
    },
  };

  // Include access logs if requested
  if (options.includeAccessLogs && user.accessLogs) {
    exportData[t('dsar.sections.activityHistory')] = {
      [t('dsar.fields.accessLogs')]: user.accessLogs.map((log: any) => ({
        [t('dsar.fields.accessedAt')]: log.accessedAt,
        [t('dsar.fields.accessedBy')]: log.accessedBy,
        [t('dsar.fields.action')]: log.action,
        [t('dsar.fields.resource')]: log.resource,
        [t('dsar.fields.ipAddress')]: log.ipAddress,
      })),
    };
  }

  // Include consent records
  if (user.consentRecords) {
    exportData[t('dsar.fields.consentRecords')] = user.consentRecords.map((consent: any) => ({
      [t('dsar.fields.consentId')]: consent.id,
      [t('dsar.fields.consentType')]: consent.type,
      [t('dsar.fields.grantedAt')]: consent.grantedAt,
      [t('dsar.fields.revokedAt')]: consent.revokedAt || 'N/A',
      [t('dsar.fields.scope')]: consent.scope,
    }));
  }

  return { data: exportData, locale };
}

/**
 * POST /gdpr/export
 * Generate DSAR export with localized field labels
 */
router.post('/export', async (req: Request, res: Response) => {
  const {
    userId,
    locale = 'en',
    format = 'json',
    includeAccessLogs = true,
    includeAuditLogs = false,
  } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
    });
  }

  try {
    const { data, locale: resolvedLocale } = await generateDSARExport({
      userId,
      locale,
      format,
      includeAccessLogs,
      includeAuditLogs,
    });

    // Log export event
    await prisma.auditEvent.create({
      data: {
        type: 'DSAR_EXPORT',
        data: {
          userId,
          locale: resolvedLocale,
          format,
          timestamp: new Date().toISOString(),
        },
      },
    });

    if (format === 'json') {
      return res.json({
        success: true,
        data,
        locale: resolvedLocale,
      });
    } else if (format === 'csv') {
      // Convert to CSV (simplified)
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dsar-export-${userId}.csv`);
      return res.send(csv);
    } else {
      // For PDF and other formats, return JSON for now
      return res.json({
        success: true,
        data,
        locale: resolvedLocale,
        message: 'PDF export coming soon',
      });
    }
  } catch (error: any) {
    console.error('DSAR export error:', error);
    return res.status(500).json({
      error: 'Failed to generate export',
      message: error.message,
    });
  }
});

/**
 * GET /gdpr/export/:userId
 * Generate DSAR export with query params
 */
router.get('/export/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const locale = (req.query.locale as Locale) || 'en';
  const format = (req.query.format as 'json' | 'csv') || 'json';

  try {
    const { data, locale: resolvedLocale } = await generateDSARExport({
      userId,
      locale,
      format,
      includeAccessLogs: true,
      includeAuditLogs: false,
    });

    // Log export event
    await prisma.auditEvent.create({
      data: {
        type: 'DSAR_EXPORT',
        data: {
          userId,
          locale: resolvedLocale,
          format,
          timestamp: new Date().toISOString(),
        },
      },
    });

    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=dsar-export-${userId}.csv`);
      return res.send(csv);
    }

    return res.json({
      success: true,
      data,
      locale: resolvedLocale,
    });
  } catch (error: any) {
    console.error('DSAR export error:', error);
    return res.status(500).json({
      error: 'Failed to generate export',
      message: error.message,
    });
  }
});

/**
 * Helper function to convert JSON to CSV
 */
function convertToCSV(data: any): string {
  const rows: string[] = [];

  function flatten(obj: any, prefix = ''): any {
    const result: any = {};
    for (const key in obj) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flatten(value, newKey));
      } else if (Array.isArray(value)) {
        result[newKey] = JSON.stringify(value);
      } else {
        result[newKey] = value;
      }
    }
    return result;
  }

  const flattened = flatten(data);
  const headers = Object.keys(flattened);

  rows.push(headers.join(','));
  rows.push(headers.map(h => flattened[h]).join(','));

  return rows.join('\n');
}

/**
 * Test endpoint to verify localization
 */
router.get('/test-locale/:locale', (req: Request, res: Response) => {
  const locale = req.params.locale as Locale;

  try {
    const localeData = loadLocale(locale);
    return res.json({
      locale,
      data: localeData,
      test: {
        personalInfo: getLocalizedLabel(locale, 'dsar.fields.personalInfo'),
        credentials: getLocalizedLabel(locale, 'dsar.fields.credentials'),
        status: getLocalizedLabel(locale, 'dsar.fields.status'),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to load locale',
      message: error.message,
    });
  }
});

export default router;

