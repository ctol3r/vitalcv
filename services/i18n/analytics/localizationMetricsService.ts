/**
 * B252B-I18N-019: LocalizationMetricsService
 *
 * Collects metrics:
 * - Number of translations per language
 * - Untranslated keys
 * - Usage counts for languages
 * Generates reports for admin dashboard
 */

import { PrismaClient } from '@prisma/client';

export interface LanguageMetrics {
  languageCode: string;
  languageName: string;
  totalKeys: number;
  translatedKeys: number;
  untranslatedKeys: number;
  completionPercentage: number;
  approvedTranslations: number;
  draftTranslations: number;
}

export interface TranslationKeyMetrics {
  key: string;
  defaultMessage: string;
  translatedLanguages: string[];
  untranslatedLanguages: string[];
  totalLanguages: number;
  completionPercentage: number;
}

export interface UsageMetrics {
  languageCode: string;
  usageCount: number;
  lastUsed?: Date;
}

export interface LocalizationReport {
  summary: {
    totalLanguages: number;
    totalKeys: number;
    overallCompletion: number;
    totalTranslations: number;
  };
  languageMetrics: LanguageMetrics[];
  keyMetrics: TranslationKeyMetrics[];
  usageMetrics: UsageMetrics[];
  untranslatedKeys: Array<{
    key: string;
    defaultMessage: string;
    missingLanguages: string[];
  }>;
}

/**
 * LocalizationMetricsService
 *
 * Service for collecting and reporting localization metrics
 */
export class LocalizationMetricsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get metrics for all languages
   */
  async getLanguageMetrics(): Promise<LanguageMetrics[]> {
    // Get all enabled languages
    const languages = await this.prisma.translationLanguage.findMany({
      where: { enabled: true },
    });

    // Get all translation keys
    const allKeys = await this.prisma.translationKeyB252A.findMany();

    const metrics: LanguageMetrics[] = [];

    for (const language of languages) {
      // Get translation values for this language
      const translationValues = await this.prisma.translationValue.findMany({
        where: { languageId: language.id },
      });

      const approvedCount = translationValues.filter(
        (tv) => tv.status === 'APPROVED'
      ).length;
      const draftCount = translationValues.filter((tv) => tv.status === 'DRAFT').length;

      const translatedKeys = translationValues.length;
      const untranslatedKeys = allKeys.length - translatedKeys;
      const completionPercentage =
        allKeys.length > 0 ? (translatedKeys / allKeys.length) * 100 : 0;

      metrics.push({
        languageCode: language.languageCode,
        languageName: language.name,
        totalKeys: allKeys.length,
        translatedKeys,
        untranslatedKeys,
        completionPercentage: Math.round(completionPercentage * 100) / 100,
        approvedTranslations: approvedCount,
        draftTranslations: draftCount,
      });
    }

    return metrics;
  }

  /**
   * Get metrics for translation keys
   */
  async getKeyMetrics(): Promise<TranslationKeyMetrics[]> {
    // Get all keys
    const keys = await this.prisma.translationKeyB252A.findMany();

    // Get all enabled languages
    const languages = await this.prisma.translationLanguage.findMany({
      where: { enabled: true },
    });

    const metrics: TranslationKeyMetrics[] = [];

    for (const key of keys) {
      // Get translation values for this key
      const translationValues = await this.prisma.translationValue.findMany({
        where: { translationKeyId: key.id },
        include: {
          language: true,
        },
      });

      const translatedLanguages = translationValues.map((tv) => tv.language.languageCode);
      const untranslatedLanguages = languages
        .filter((lang) => !translatedLanguages.includes(lang.languageCode))
        .map((lang) => lang.languageCode);

      const completionPercentage =
        languages.length > 0 ? (translatedLanguages.length / languages.length) * 100 : 0;

      metrics.push({
        key: key.key,
        defaultMessage: key.defaultMessage,
        translatedLanguages,
        untranslatedLanguages,
        totalLanguages: languages.length,
        completionPercentage: Math.round(completionPercentage * 100) / 100,
      });
    }

    return metrics;
  }

  /**
   * Get untranslated keys
   */
  async getUntranslatedKeys(languageCode?: string): Promise<
    Array<{
      key: string;
      defaultMessage: string;
      missingLanguages: string[];
    }>
  > {
    // Get all keys
    const keys = await this.prisma.translationKeyB252A.findMany();

    // Get languages to check
    const languages = languageCode
      ? await this.prisma.translationLanguage.findMany({
          where: { languageCode, enabled: true },
        })
      : await this.prisma.translationLanguage.findMany({
          where: { enabled: true },
        });

    const untranslated: Array<{
      key: string;
      defaultMessage: string;
      missingLanguages: string[];
    }> = [];

    for (const key of keys) {
      // Get translation values for this key
      const translationValues = await this.prisma.translationValue.findMany({
        where: { translationKeyId: key.id },
        include: {
          language: true,
        },
      });

      const translatedLanguageCodes = translationValues.map(
        (tv) => tv.language.languageCode
      );
      const missingLanguages = languages
        .filter((lang) => !translatedLanguageCodes.includes(lang.languageCode))
        .map((lang) => lang.languageCode);

      if (missingLanguages.length > 0) {
        untranslated.push({
          key: key.key,
          defaultMessage: key.defaultMessage,
          missingLanguages,
        });
      }
    }

    return untranslated;
  }

  /**
   * Get usage metrics (if tracking is implemented)
   * This would require additional tracking infrastructure
   */
  async getUsageMetrics(): Promise<UsageMetrics[]> {
    // This would typically query usage logs or analytics
    // For now, return empty array as placeholder
    // In production, this would track language usage from UserLocaleSetting or usage logs
    const languages = await this.prisma.translationLanguage.findMany({
      where: { enabled: true },
    });

    // Get usage from UserLocaleSetting (simplified)
    const usageData: UsageMetrics[] = [];

    for (const language of languages) {
      const userCount = await this.prisma.userLocaleSetting.count({
        where: { languageId: language.id },
      });

      usageData.push({
        languageCode: language.languageCode,
        usageCount: userCount,
      });
    }

    return usageData.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Generate comprehensive localization report
   */
  async generateReport(): Promise<LocalizationReport> {
    const languageMetrics = await this.getLanguageMetrics();
    const keyMetrics = await this.getKeyMetrics();
    const usageMetrics = await this.getUsageMetrics();
    const untranslatedKeys = await this.getUntranslatedKeys();

    // Calculate summary
    const totalLanguages = languageMetrics.length;
    const totalKeys = keyMetrics.length;
    const totalTranslations = languageMetrics.reduce(
      (sum, lm) => sum + lm.translatedKeys,
      0
    );
    const overallCompletion =
      totalLanguages > 0 && totalKeys > 0
        ? languageMetrics.reduce((sum, lm) => sum + lm.completionPercentage, 0) /
          totalLanguages
        : 0;

    return {
      summary: {
        totalLanguages,
        totalKeys,
        overallCompletion: Math.round(overallCompletion * 100) / 100,
        totalTranslations,
      },
      languageMetrics,
      keyMetrics,
      usageMetrics,
      untranslatedKeys,
    };
  }

  /**
   * Get metrics for a specific language
   */
  async getLanguageMetricsByCode(languageCode: string): Promise<LanguageMetrics | null> {
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      return null;
    }

    const allMetrics = await this.getLanguageMetrics();
    return allMetrics.find((m) => m.languageCode === languageCode) || null;
  }
}

