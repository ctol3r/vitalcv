/**
 * B252A-I18N-002: TranslationLanguage model
 *
 * Schema: id, languageCode (e.g., 'en', 'es-ES'), name, nativeName,
 * direction (ltr/rtl), enabled (bool), createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, TranslationLanguage as PrismaTranslationLanguage, TextDirection } from '@prisma/client';

export interface TranslationLanguageInput {
  languageCode: string; // e.g., 'en', 'es-ES'
  name: string; // English name
  nativeName: string; // Native name
  direction?: TextDirection;
  enabled?: boolean;
}

export interface TranslationLanguageOutput {
  id: string;
  languageCode: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TranslationLanguageService
 *
 * Manages translation languages
 */
export class TranslationLanguageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new translation language
   */
  async createLanguage(input: TranslationLanguageInput): Promise<TranslationLanguageOutput> {
    const language = await this.prisma.translationLanguage.create({
      data: {
        languageCode: input.languageCode,
        name: input.name,
        nativeName: input.nativeName,
        direction: input.direction ?? TextDirection.LTR,
        enabled: input.enabled ?? true,
      },
    });

    return this.mapToOutput(language);
  }

  /**
   * Get a language by ID
   */
  async getLanguageById(id: string): Promise<TranslationLanguageOutput | null> {
    const language = await this.prisma.translationLanguage.findUnique({
      where: { id },
    });

    return language ? this.mapToOutput(language) : null;
  }

  /**
   * Get a language by language code
   */
  async getLanguageByCode(languageCode: string): Promise<TranslationLanguageOutput | null> {
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    return language ? this.mapToOutput(language) : null;
  }

  /**
   * Update a language
   */
  async updateLanguage(
    id: string,
    input: Partial<TranslationLanguageInput>
  ): Promise<TranslationLanguageOutput> {
    const language = await this.prisma.translationLanguage.update({
      where: { id },
      data: {
        ...(input.languageCode && { languageCode: input.languageCode }),
        ...(input.name && { name: input.name }),
        ...(input.nativeName && { nativeName: input.nativeName }),
        ...(input.direction !== undefined && { direction: input.direction }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      },
    });

    return this.mapToOutput(language);
  }

  /**
   * Delete a language
   */
  async deleteLanguage(id: string): Promise<boolean> {
    try {
      await this.prisma.translationLanguage.delete({
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
   * List all languages with pagination
   */
  async listLanguages(
    skip: number = 0,
    take: number = 100,
    enabledOnly: boolean = false
  ): Promise<TranslationLanguageOutput[]> {
    const languages = await this.prisma.translationLanguage.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      skip,
      take,
      orderBy: { languageCode: 'asc' },
    });

    return languages.map((l) => this.mapToOutput(l));
  }

  /**
   * Get or create a language (upsert by language code)
   */
  async getOrCreateLanguage(input: TranslationLanguageInput): Promise<TranslationLanguageOutput> {
    const language = await this.prisma.translationLanguage.upsert({
      where: { languageCode: input.languageCode },
      create: {
        languageCode: input.languageCode,
        name: input.name,
        nativeName: input.nativeName,
        direction: input.direction ?? TextDirection.LTR,
        enabled: input.enabled ?? true,
      },
      update: {
        name: input.name,
        nativeName: input.nativeName,
        direction: input.direction ?? TextDirection.LTR,
        enabled: input.enabled ?? true,
      },
    });

    return this.mapToOutput(language);
  }

  private mapToOutput(language: PrismaTranslationLanguage): TranslationLanguageOutput {
    return {
      id: language.id,
      languageCode: language.languageCode,
      name: language.name,
      nativeName: language.nativeName,
      direction: language.direction,
      enabled: language.enabled,
      createdAt: language.createdAt,
      updatedAt: language.updatedAt,
    };
  }
}

