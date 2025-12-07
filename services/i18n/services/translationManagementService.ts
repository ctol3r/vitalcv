/**
 * B241A-I18N-003: TranslationManagementService
 *
 * CRUD operations for translation keys and entries
 * Supports batch import/export (JSON, CSV)
 * Integrates with external translation providers
 * Logs operations
 */

import { PrismaClient, TranslationEntryStatus } from '@prisma/client';
import { parse, unparse } from 'papaparse';
import { TranslationKeyService } from '../models/TranslationKey';
import { TranslationEntryService } from '../models/TranslationEntry';

export interface BatchImportItem {
  context: string;
  defaultText: string;
  locale: string;
  text: string;
  status?: TranslationEntryStatus;
}

export interface BatchExportItem {
  context: string;
  defaultText: string;
  locale: string;
  text: string;
  version: number;
  status: TranslationEntryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalTranslationProvider {
  name: string;
  translate(text: string, fromLocale: string, toLocale: string): Promise<string>;
}

/**
 * TranslationManagementService
 *
 * Comprehensive service for managing translations with batch operations
 */
export class TranslationManagementService {
  private keyService: TranslationKeyService;
  private entryService: TranslationEntryService;

  constructor(
    private prisma: PrismaClient,
    private externalProviders: ExternalTranslationProvider[] = [],
    private logger?: { info: (msg: string, meta?: any) => void; error: (msg: string, meta?: any) => void }
  ) {
    this.keyService = new TranslationKeyService(prisma);
    this.entryService = new TranslationEntryService(prisma);
  }

  /**
   * Create a translation key
   */
  async createKey(context: string, defaultText: string) {
    this.logger?.info('Creating translation key', { context });
    return this.keyService.createKey({ context, defaultText });
  }

  /**
   * Create a translation entry
   */
  async createEntry(
    keyId: string,
    locale: string,
    text: string,
    createdBy: string,
    status: TranslationEntryStatus = TranslationEntryStatus.DRAFT
  ) {
    this.logger?.info('Creating translation entry', { keyId, locale });
    return this.entryService.createEntry({
      keyId,
      locale,
      text,
      createdBy,
      status,
    });
  }

  /**
   * Get translation for a key and locale (with fallback)
   */
  async getTranslation(
    context: string,
    locale: string
  ): Promise<string | null> {
    const key = await this.keyService.getKeyByContext(context);
    if (!key) {
      return null;
    }

    // Try to get approved translation
    const entry = await this.entryService.getLatestApproved(key.id, locale);
    if (entry) {
      return entry.text;
    }

    // Fallback to default text
    return key.defaultText;
  }

  /**
   * Update translation entry
   */
  async updateEntry(
    entryId: string,
    text?: string,
    status?: TranslationEntryStatus
  ) {
    this.logger?.info('Updating translation entry', { entryId });

    if (text) {
      await this.entryService.updateText(entryId, text);
    }

    if (status) {
      await this.entryService.updateStatus(entryId, status);
    }

    return this.entryService.getEntryById(entryId);
  }

  /**
   * Delete translation key
   */
  async deleteKey(keyId: string) {
    this.logger?.info('Deleting translation key', { keyId });
    return this.keyService.deleteKey(keyId);
  }

  /**
   * Delete translation entry
   */
  async deleteEntry(entryId: string) {
    this.logger?.info('Deleting translation entry', { entryId });
    return this.entryService.deleteEntry(entryId);
  }

  /**
   * Batch import translations from JSON
   */
  async importFromJSON(
    data: BatchImportItem[],
    createdBy: string
  ): Promise<{ keysCreated: number; entriesCreated: number; errors: string[] }> {
    this.logger?.info('Importing translations from JSON', { count: data.length });

    let keysCreated = 0;
    let entriesCreated = 0;
    const errors: string[] = [];

    for (const item of data) {
      try {
        // Get or create key
        const key = await this.keyService.getOrCreateKey({
          context: item.context,
          defaultText: item.defaultText,
        });

        if (!key) {
          errors.push(`Failed to create key: ${item.context}`);
          continue;
        }

        // Check if key was just created
        const existingKey = await this.keyService.getKeyByContext(item.context);
        if (!existingKey || existingKey.createdAt.getTime() === key.createdAt.getTime()) {
          keysCreated++;
        }

        // Create entry
        await this.entryService.createEntry({
          keyId: key.id,
          locale: item.locale,
          text: item.text,
          createdBy,
          status: item.status ?? TranslationEntryStatus.DRAFT,
        });
        entriesCreated++;
      } catch (error: any) {
        errors.push(`Error importing ${item.context} (${item.locale}): ${error.message}`);
      }
    }

    return { keysCreated, entriesCreated, errors };
  }

  /**
   * Batch import translations from CSV
   */
  async importFromCSV(
    csvContent: string,
    createdBy: string
  ): Promise<{ keysCreated: number; entriesCreated: number; errors: string[] }> {
    this.logger?.info('Importing translations from CSV');

    const parsed = parse<BatchImportItem>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parse errors: ${parsed.errors.map((e) => e.message).join(', ')}`);
    }

    return this.importFromJSON(parsed.data, createdBy);
  }

  /**
   * Export translations to JSON
   */
  async exportToJSON(locale?: string): Promise<BatchExportItem[]> {
    this.logger?.info('Exporting translations to JSON', { locale });

    const keys = await this.keyService.listKeys(0, 10000);
    const exports: BatchExportItem[] = [];

    for (const key of keys) {
      const entries = locale
        ? await this.entryService.listEntriesByLocale(locale)
        : await this.entryService.listEntriesByKey(key.id);

      const relevantEntries = entries.filter((e) => e.keyId === key.id);

      if (relevantEntries.length === 0) {
        // Include key with default text if no entries
        exports.push({
          context: key.context,
          defaultText: key.defaultText,
          locale: '',
          text: key.defaultText,
          version: 0,
          status: TranslationEntryStatus.APPROVED,
          createdAt: key.createdAt.toISOString(),
          updatedAt: key.updatedAt.toISOString(),
        });
      } else {
        for (const entry of relevantEntries) {
          exports.push({
            context: key.context,
            defaultText: key.defaultText,
            locale: entry.locale,
            text: entry.text,
            version: entry.version,
            status: entry.status,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
          });
        }
      }
    }

    return exports;
  }

  /**
   * Export translations to CSV
   */
  async exportToCSV(locale?: string): Promise<string> {
    this.logger?.info('Exporting translations to CSV', { locale });

    const data = await this.exportToJSON(locale);
    return unparse(data);
  }

  /**
   * Translate using external provider
   */
  async translateWithProvider(
    text: string,
    fromLocale: string,
    toLocale: string,
    providerName?: string
  ): Promise<string> {
    this.logger?.info('Translating with external provider', {
      fromLocale,
      toLocale,
      providerName,
    });

    const provider = providerName
      ? this.externalProviders.find((p) => p.name === providerName)
      : this.externalProviders[0];

    if (!provider) {
      throw new Error('No translation provider available');
    }

    return provider.translate(text, fromLocale, toLocale);
  }

  /**
   * Auto-translate missing translations using external provider
   */
  async autoTranslateMissing(
    keyId: string,
    fromLocale: string,
    toLocale: string,
    createdBy: string,
    providerName?: string
  ): Promise<{ entryId: string; text: string } | null> {
    // Get source translation
    const sourceEntry = await this.entryService.getLatestApproved(keyId, fromLocale);
    if (!sourceEntry) {
      return null;
    }

    // Check if translation already exists
    const existing = await this.entryService.getLatestApproved(keyId, toLocale);
    if (existing) {
      return null; // Already translated
    }

    // Translate using provider
    const translatedText = await this.translateWithProvider(
      sourceEntry.text,
      fromLocale,
      toLocale,
      providerName
    );

    // Create entry as draft
    const entry = await this.entryService.createEntry({
      keyId,
      locale: toLocale,
      text: translatedText,
      createdBy,
      status: TranslationEntryStatus.DRAFT,
    });

    return { entryId: entry.id, text: entry.text };
  }
}

