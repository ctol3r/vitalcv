/**
 * B241A-I18N-002: TranslationEntry model
 *
 * Represents a translation for a specific locale and key.
 * Fields: id, keyId, locale (e.g., en-US), text, createdBy, createdAt, updatedAt
 * Supports versioning and status (draft/approved)
 */

import {
  PrismaClient,
  TranslationEntry as PrismaTranslationEntry,
  TranslationEntryStatus,
} from '@prisma/client';

export interface TranslationEntryInput {
  keyId: string;
  locale: string; // e.g., "en-US", "es-ES"
  text: string;
  version?: number;
  status?: TranslationEntryStatus;
  createdBy: string; // User ID
}

export interface TranslationEntryOutput {
  id: string;
  keyId: string;
  locale: string;
  text: string;
  version: number;
  status: TranslationEntryStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TranslationEntryService
 *
 * Manages translation entries with versioning and approval workflow
 */
export class TranslationEntryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new translation entry
   */
  async createEntry(input: TranslationEntryInput): Promise<TranslationEntryOutput> {
    // Get the latest version for this key+locale combination
    const latest = await this.prisma.translationEntry.findFirst({
      where: {
        keyId: input.keyId,
        locale: input.locale,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latest ? latest.version + 1 : 1;

    const entry = await this.prisma.translationEntry.create({
      data: {
        keyId: input.keyId,
        locale: input.locale,
        text: input.text,
        version: input.version ?? nextVersion,
        status: input.status ?? TranslationEntryStatus.DRAFT,
        createdBy: input.createdBy,
      },
    });

    return this.mapToOutput(entry);
  }

  /**
   * Get a translation entry by ID
   */
  async getEntryById(id: string): Promise<TranslationEntryOutput | null> {
    const entry = await this.prisma.translationEntry.findUnique({
      where: { id },
    });

    return entry ? this.mapToOutput(entry) : null;
  }

  /**
   * Get the latest approved translation for a key and locale
   */
  async getLatestApproved(
    keyId: string,
    locale: string
  ): Promise<TranslationEntryOutput | null> {
    const entry = await this.prisma.translationEntry.findFirst({
      where: {
        keyId,
        locale,
        status: TranslationEntryStatus.APPROVED,
      },
      orderBy: { version: 'desc' },
    });

    return entry ? this.mapToOutput(entry) : null;
  }

  /**
   * Get the latest translation (any status) for a key and locale
   */
  async getLatest(
    keyId: string,
    locale: string
  ): Promise<TranslationEntryOutput | null> {
    const entry = await this.prisma.translationEntry.findFirst({
      where: {
        keyId,
        locale,
      },
      orderBy: { version: 'desc' },
    });

    return entry ? this.mapToOutput(entry) : null;
  }

  /**
   * Update translation entry status
   */
  async updateStatus(
    id: string,
    status: TranslationEntryStatus
  ): Promise<TranslationEntryOutput> {
    const entry = await this.prisma.translationEntry.update({
      where: { id },
      data: { status },
    });

    return this.mapToOutput(entry);
  }

  /**
   * Update translation entry text
   */
  async updateText(
    id: string,
    text: string
  ): Promise<TranslationEntryOutput> {
    const entry = await this.prisma.translationEntry.update({
      where: { id },
      data: { text },
    });

    return this.mapToOutput(entry);
  }

  /**
   * List all entries for a key
   */
  async listEntriesByKey(keyId: string): Promise<TranslationEntryOutput[]> {
    const entries = await this.prisma.translationEntry.findMany({
      where: { keyId },
      orderBy: [{ locale: 'asc' }, { version: 'desc' }],
    });

    return entries.map((e) => this.mapToOutput(e));
  }

  /**
   * List all entries for a locale
   */
  async listEntriesByLocale(locale: string): Promise<TranslationEntryOutput[]> {
    const entries = await this.prisma.translationEntry.findMany({
      where: { locale },
      orderBy: [{ keyId: 'asc' }, { version: 'desc' }],
    });

    return entries.map((e) => this.mapToOutput(e));
  }

  /**
   * List entries by status
   */
  async listEntriesByStatus(
    status: TranslationEntryStatus
  ): Promise<TranslationEntryOutput[]> {
    const entries = await this.prisma.translationEntry.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map((e) => this.mapToOutput(e));
  }

  /**
   * Delete a translation entry
   */
  async deleteEntry(id: string): Promise<boolean> {
    try {
      await this.prisma.translationEntry.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  private mapToOutput(entry: PrismaTranslationEntry): TranslationEntryOutput {
    return {
      id: entry.id,
      keyId: entry.keyId,
      locale: entry.locale,
      text: entry.text,
      version: entry.version,
      status: entry.status,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}

