/**
 * B252A-I18N-003: TranslationValue model
 *
 * Defines translations: id, translationKeyId (FK), languageId (FK),
 * value (string), status (draft/approved), updatedAt
 * Includes migration and tests
 */

import {
  PrismaClient,
  TranslationValue as PrismaTranslationValue,
  TranslationValueStatus,
} from '@prisma/client';

export interface TranslationValueInput {
  translationKeyId: string;
  languageId: string;
  value: string;
  status?: TranslationValueStatus;
}

export interface TranslationValueOutput {
  id: string;
  translationKeyId: string;
  languageId: string;
  value: string;
  status: TranslationValueStatus;
  updatedAt: Date;
}

/**
 * TranslationValueService
 *
 * Manages translation values for keys and languages
 */
export class TranslationValueService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new translation value
   */
  async createValue(input: TranslationValueInput): Promise<TranslationValueOutput> {
    const value = await this.prisma.translationValue.create({
      data: {
        translationKeyId: input.translationKeyId,
        languageId: input.languageId,
        value: input.value,
        status: input.status ?? TranslationValueStatus.DRAFT,
      },
    });

    return this.mapToOutput(value);
  }

  /**
   * Get a translation value by ID
   */
  async getValueById(id: string): Promise<TranslationValueOutput | null> {
    const value = await this.prisma.translationValue.findUnique({
      where: { id },
    });

    return value ? this.mapToOutput(value) : null;
  }

  /**
   * Get a translation value by key and language
   */
  async getValueByKeyAndLanguage(
    translationKeyId: string,
    languageId: string
  ): Promise<TranslationValueOutput | null> {
    const value = await this.prisma.translationValue.findUnique({
      where: {
        translationKeyId_languageId: {
          translationKeyId,
          languageId,
        },
      },
    });

    return value ? this.mapToOutput(value) : null;
  }

  /**
   * Update a translation value
   */
  async updateValue(
    id: string,
    input: Partial<Pick<TranslationValueInput, 'value' | 'status'>>
  ): Promise<TranslationValueOutput> {
    const value = await this.prisma.translationValue.update({
      where: { id },
      data: {
        ...(input.value && { value: input.value }),
        ...(input.status !== undefined && { status: input.status }),
      },
    });

    return this.mapToOutput(value);
  }

  /**
   * Update translation value status
   */
  async updateStatus(
    id: string,
    status: TranslationValueStatus
  ): Promise<TranslationValueOutput> {
    const value = await this.prisma.translationValue.update({
      where: { id },
      data: { status },
    });

    return this.mapToOutput(value);
  }

  /**
   * Delete a translation value
   */
  async deleteValue(id: string): Promise<boolean> {
    try {
      await this.prisma.translationValue.delete({
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
   * List all values for a translation key
   */
  async listValuesByKey(translationKeyId: string): Promise<TranslationValueOutput[]> {
    const values = await this.prisma.translationValue.findMany({
      where: { translationKeyId },
      orderBy: { updatedAt: 'desc' },
    });

    return values.map((v) => this.mapToOutput(v));
  }

  /**
   * List all values for a language
   */
  async listValuesByLanguage(languageId: string): Promise<TranslationValueOutput[]> {
    const values = await this.prisma.translationValue.findMany({
      where: { languageId },
      orderBy: { updatedAt: 'desc' },
    });

    return values.map((v) => this.mapToOutput(v));
  }

  /**
   * List values by status
   */
  async listValuesByStatus(status: TranslationValueStatus): Promise<TranslationValueOutput[]> {
    const values = await this.prisma.translationValue.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' },
    });

    return values.map((v) => this.mapToOutput(v));
  }

  /**
   * Get or create a translation value (upsert by key and language)
   */
  async getOrCreateValue(input: TranslationValueInput): Promise<TranslationValueOutput> {
    const value = await this.prisma.translationValue.upsert({
      where: {
        translationKeyId_languageId: {
          translationKeyId: input.translationKeyId,
          languageId: input.languageId,
        },
      },
      create: {
        translationKeyId: input.translationKeyId,
        languageId: input.languageId,
        value: input.value,
        status: input.status ?? TranslationValueStatus.DRAFT,
      },
      update: {
        value: input.value,
        status: input.status ?? TranslationValueStatus.DRAFT,
      },
    });

    return this.mapToOutput(value);
  }

  private mapToOutput(value: PrismaTranslationValue): TranslationValueOutput {
    return {
      id: value.id,
      translationKeyId: value.translationKeyId,
      languageId: value.languageId,
      value: value.value,
      status: value.status,
      updatedAt: value.updatedAt,
    };
  }
}

