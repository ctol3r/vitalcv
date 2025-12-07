/**
 * B252B-I18N-018: LanguagePackImportExportService
 *
 * Imports/exports language packs:
 * - Exports all translations for a language into JSON or CSV
 * - Imports translation files
 * - Updates TranslationValue records
 */

import { PrismaClient, TranslationValueStatus } from '@prisma/client';
import { parse, unparse } from 'papaparse';

export interface LanguagePackExport {
  languageCode: string;
  version: string;
  exportedAt: string;
  translations: Array<{
    key: string;
    value: string;
    status: TranslationValueStatus;
  }>;
}

export interface LanguagePackImport {
  languageCode: string;
  translations: Array<{
    key: string;
    value: string;
    status?: TranslationValueStatus;
  }>;
}

export interface ImportResult {
  keysCreated: number;
  valuesCreated: number;
  valuesUpdated: number;
  errors: string[];
}

/**
 * LanguagePackImportExportService
 *
 * Service for importing and exporting language packs
 */
export class LanguagePackImportExportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Export language pack to JSON
   */
  async exportToJSON(languageCode: string, version: string = '1.0.0'): Promise<LanguagePackExport> {
    // Get language
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      throw new Error(`Language not found: ${languageCode}`);
    }

    // Get all translation values for this language
    const translationValues = await this.prisma.translationValue.findMany({
      where: {
        languageId: language.id,
      },
      include: {
        translationKey: true,
      },
    });

    // Build export data
    const translations = translationValues.map((tv) => ({
      key: tv.translationKey.key,
      value: tv.value,
      status: tv.status,
    }));

    const exportData: LanguagePackExport = {
      languageCode,
      version,
      exportedAt: new Date().toISOString(),
      translations,
    };

    return exportData;
  }

  /**
   * Export language pack to CSV
   */
  async exportToCSV(languageCode: string, version: string = '1.0.0'): Promise<string> {
    const exportData = await this.exportToJSON(languageCode, version);

    // Convert to CSV format
    const csvData = exportData.translations.map((t) => ({
      key: t.key,
      value: t.value,
      status: t.status,
    }));

    return unparse(csvData, {
      header: true,
    });
  }

  /**
   * Import language pack from JSON
   */
  async importFromJSON(
    importData: LanguagePackImport,
    createdBy?: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      keysCreated: 0,
      valuesCreated: 0,
      valuesUpdated: 0,
      errors: [],
    };

    // Get or create language
    let language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode: importData.languageCode },
    });

    if (!language) {
      // Create language if it doesn't exist
      language = await this.prisma.translationLanguage.create({
        data: {
          languageCode: importData.languageCode,
          name: importData.languageCode,
          nativeName: importData.languageCode,
        },
      });
    }

    // Process each translation
    for (const translation of importData.translations) {
      try {
        // Get or create translation key
        let translationKey = await this.prisma.translationKeyB252A.findUnique({
          where: { key: translation.key },
        });

        if (!translationKey) {
          translationKey = await this.prisma.translationKeyB252A.create({
            data: {
              key: translation.key,
              defaultMessage: translation.value,
            },
          });
          result.keysCreated++;
        }

        // Create or update translation value
        const existingValue = await this.prisma.translationValue.findUnique({
          where: {
            translationKeyId_languageId: {
              translationKeyId: translationKey.id,
              languageId: language.id,
            },
          },
        });

        if (existingValue) {
          await this.prisma.translationValue.update({
            where: { id: existingValue.id },
            data: {
              value: translation.value,
              status: translation.status || TranslationValueStatus.DRAFT,
            },
          });
          result.valuesUpdated++;
        } else {
          await this.prisma.translationValue.create({
            data: {
              translationKeyId: translationKey.id,
              languageId: language.id,
              value: translation.value,
              status: translation.status || TranslationValueStatus.DRAFT,
            },
          });
          result.valuesCreated++;
        }
      } catch (error: any) {
        result.errors.push(`Error importing ${translation.key}: ${error.message}`);
      }
    }

    // Save language pack record
    await this.prisma.languagePack.create({
      data: {
        languageId: language.id,
        version: '1.0.0',
        exportedAt: new Date(),
        data: importData as any,
      },
    });

    return result;
  }

  /**
   * Import language pack from CSV
   */
  async importFromCSV(
    csvContent: string,
    languageCode: string,
    createdBy?: string
  ): Promise<ImportResult> {
    // Parse CSV
    const parsed = parse<{ key: string; value: string; status?: string }>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      throw new Error(
        `CSV parse errors: ${parsed.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Convert to import format
    const importData: LanguagePackImport = {
      languageCode,
      translations: parsed.data.map((row) => ({
        key: row.key,
        value: row.value,
        status:
          row.status === 'APPROVED'
            ? TranslationValueStatus.APPROVED
            : TranslationValueStatus.DRAFT,
      })),
    };

    return this.importFromJSON(importData, createdBy);
  }

  /**
   * Get language pack versions
   */
  async getLanguagePackVersions(languageCode: string): Promise<Array<{ version: string; exportedAt: Date }>> {
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      return [];
    }

    const packs = await this.prisma.languagePack.findMany({
      where: { languageId: language.id },
      select: {
        version: true,
        exportedAt: true,
      },
      orderBy: { exportedAt: 'desc' },
    });

    return packs.map((p) => ({
      version: p.version,
      exportedAt: p.exportedAt,
    }));
  }

  /**
   * Get language pack by version
   */
  async getLanguagePack(languageCode: string, version: string): Promise<LanguagePackExport | null> {
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      return null;
    }

    const pack = await this.prisma.languagePack.findFirst({
      where: {
        languageId: language.id,
        version,
      },
    });

    if (!pack) {
      return null;
    }

    return pack.data as LanguagePackExport;
  }
}

