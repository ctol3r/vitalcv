/**
 * B252A-I18N-004: LanguagePack model
 *
 * Stores collections of translations for a specific language:
 * id, languageId (FK), version (string), exportedAt (datetime),
 * data (JSON), createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, LanguagePack as PrismaLanguagePack } from '@prisma/client';

export interface LanguagePackInput {
  languageId: string;
  version: string; // Version string (e.g., "1.0.0")
  exportedAt: Date;
  data: Record<string, any>; // JSON data containing translations
}

export interface LanguagePackOutput {
  id: string;
  languageId: string;
  version: string;
  exportedAt: Date;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LanguagePackService
 *
 * Manages language packs - exported collections of translations
 */
export class LanguagePackService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new language pack
   */
  async createPack(input: LanguagePackInput): Promise<LanguagePackOutput> {
    const pack = await this.prisma.languagePack.create({
      data: {
        languageId: input.languageId,
        version: input.version,
        exportedAt: input.exportedAt,
        data: input.data as any,
      },
    });

    return this.mapToOutput(pack);
  }

  /**
   * Get a language pack by ID
   */
  async getPackById(id: string): Promise<LanguagePackOutput | null> {
    const pack = await this.prisma.languagePack.findUnique({
      where: { id },
    });

    return pack ? this.mapToOutput(pack) : null;
  }

  /**
   * Get the latest language pack for a language
   */
  async getLatestPack(languageId: string): Promise<LanguagePackOutput | null> {
    const pack = await this.prisma.languagePack.findFirst({
      where: { languageId },
      orderBy: { exportedAt: 'desc' },
    });

    return pack ? this.mapToOutput(pack) : null;
  }

  /**
   * Get a language pack by language and version
   */
  async getPackByLanguageAndVersion(
    languageId: string,
    version: string
  ): Promise<LanguagePackOutput | null> {
    const pack = await this.prisma.languagePack.findFirst({
      where: {
        languageId,
        version,
      },
      orderBy: { exportedAt: 'desc' },
    });

    return pack ? this.mapToOutput(pack) : null;
  }

  /**
   * Update a language pack
   */
  async updatePack(
    id: string,
    input: Partial<Pick<LanguagePackInput, 'version' | 'exportedAt' | 'data'>>
  ): Promise<LanguagePackOutput> {
    const pack = await this.prisma.languagePack.update({
      where: { id },
      data: {
        ...(input.version && { version: input.version }),
        ...(input.exportedAt && { exportedAt: input.exportedAt }),
        ...(input.data && { data: input.data as any }),
      },
    });

    return this.mapToOutput(pack);
  }

  /**
   * Delete a language pack
   */
  async deletePack(id: string): Promise<boolean> {
    try {
      await this.prisma.languagePack.delete({
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
   * List all language packs for a language
   */
  async listPacksByLanguage(languageId: string): Promise<LanguagePackOutput[]> {
    const packs = await this.prisma.languagePack.findMany({
      where: { languageId },
      orderBy: { exportedAt: 'desc' },
    });

    return packs.map((p) => this.mapToOutput(p));
  }

  /**
   * List all language packs with pagination
   */
  async listPacks(
    skip: number = 0,
    take: number = 100
  ): Promise<LanguagePackOutput[]> {
    const packs = await this.prisma.languagePack.findMany({
      skip,
      take,
      orderBy: { exportedAt: 'desc' },
    });

    return packs.map((p) => this.mapToOutput(p));
  }

  private mapToOutput(pack: PrismaLanguagePack): LanguagePackOutput {
    return {
      id: pack.id,
      languageId: pack.languageId,
      version: pack.version,
      exportedAt: pack.exportedAt,
      data: pack.data as Record<string, any>,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
    };
  }
}

