/**
 * B252A-I18N-001: TranslationKey model
 *
 * Defines translation keys: id, key (unique string), defaultMessage (string),
 * description (optional), createdAt, updatedAt
 * Includes migration and tests ensuring key uniqueness
 */

import { PrismaClient, TranslationKeyB252A as PrismaTranslationKey } from '@prisma/client';

export interface TranslationKeyInput {
  key: string; // Unique string key
  defaultMessage: string;
  description?: string;
}

export interface TranslationKeyOutput {
  id: string;
  key: string;
  defaultMessage: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TranslationKeyService
 *
 * Manages translation keys - the central registry of all translatable strings
 */
export class TranslationKeyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new translation key
   */
  async createKey(input: TranslationKeyInput): Promise<TranslationKeyOutput> {
    const key = await this.prisma.translationKeyB252A.create({
      data: {
        key: input.key,
        defaultMessage: input.defaultMessage,
        description: input.description,
      },
    });

    return this.mapToOutput(key);
  }

  /**
   * Get a translation key by ID
   */
  async getKeyById(id: string): Promise<TranslationKeyOutput | null> {
    const key = await this.prisma.translationKeyB252A.findUnique({
      where: { id },
    });

    return key ? this.mapToOutput(key) : null;
  }

  /**
   * Get a translation key by key string
   */
  async getKeyByKey(key: string): Promise<TranslationKeyOutput | null> {
    const translationKey = await this.prisma.translationKeyB252A.findUnique({
      where: { key },
    });

    return translationKey ? this.mapToOutput(translationKey) : null;
  }

  /**
   * Update a translation key
   */
  async updateKey(
    id: string,
    input: Partial<TranslationKeyInput>
  ): Promise<TranslationKeyOutput> {
    const key = await this.prisma.translationKeyB252A.update({
      where: { id },
      data: {
        ...(input.key && { key: input.key }),
        ...(input.defaultMessage && { defaultMessage: input.defaultMessage }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    return this.mapToOutput(key);
  }

  /**
   * Delete a translation key (cascades to values)
   */
  async deleteKey(id: string): Promise<boolean> {
    try {
      await this.prisma.translationKeyB252A.delete({
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

  /**
   * List all translation keys with pagination
   */
  async listKeys(
    skip: number = 0,
    take: number = 100
  ): Promise<TranslationKeyOutput[]> {
    const keys = await this.prisma.translationKeyB252A.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => this.mapToOutput(k));
  }

  /**
   * Search translation keys by key pattern
   */
  async searchKeys(pattern: string): Promise<TranslationKeyOutput[]> {
    const keys = await this.prisma.translationKeyB252A.findMany({
      where: {
        key: {
          contains: pattern,
          mode: 'insensitive',
        },
      },
      orderBy: { key: 'asc' },
    });

    return keys.map((k) => this.mapToOutput(k));
  }

  /**
   * Get or create a translation key (upsert by key)
   */
  async getOrCreateKey(input: TranslationKeyInput): Promise<TranslationKeyOutput> {
    const key = await this.prisma.translationKeyB252A.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        defaultMessage: input.defaultMessage,
        description: input.description,
      },
      update: {
        defaultMessage: input.defaultMessage,
        description: input.description,
      },
    });

    return this.mapToOutput(key);
  }

  private mapToOutput(key: PrismaTranslationKey): TranslationKeyOutput {
    return {
      id: key.id,
      key: key.key,
      defaultMessage: key.defaultMessage,
      description: key.description,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }
}
