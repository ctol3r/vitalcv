/**
 * B252A-I18N-009: UserLocaleSetting model
 *
 * Stores user preferences: id, userId, languageId (FK), countryId (FK),
 * timezoneId (FK), currencyCode (string), dateFormat (string),
 * numberFormat (string), createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, UserLocaleSetting as PrismaUserLocaleSetting } from '@prisma/client';

export interface UserLocaleSettingInput {
  userId: string;
  languageId?: string;
  countryId?: string;
  timezoneId?: string;
  currencyCode?: string; // Currency code string
  dateFormat?: string; // Date format string
  numberFormat?: string; // Number format string
}

export interface UserLocaleSettingOutput {
  id: string;
  userId: string;
  languageId: string | null;
  countryId: string | null;
  timezoneId: string | null;
  currencyCode: string | null;
  dateFormat: string | null;
  numberFormat: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserLocaleSettingService
 *
 * Manages user locale settings
 */
export class UserLocaleSettingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new user locale setting
   */
  async createSetting(input: UserLocaleSettingInput): Promise<UserLocaleSettingOutput> {
    const setting = await this.prisma.userLocaleSetting.create({
      data: {
        userId: input.userId,
        languageId: input.languageId,
        countryId: input.countryId,
        timezoneId: input.timezoneId,
        currencyCode: input.currencyCode,
        dateFormat: input.dateFormat,
        numberFormat: input.numberFormat,
      },
    });

    return this.mapToOutput(setting);
  }

  /**
   * Get a user locale setting by ID
   */
  async getSettingById(id: string): Promise<UserLocaleSettingOutput | null> {
    const setting = await this.prisma.userLocaleSetting.findUnique({
      where: { id },
    });

    return setting ? this.mapToOutput(setting) : null;
  }

  /**
   * Get a user locale setting by user ID
   */
  async getSettingByUserId(userId: string): Promise<UserLocaleSettingOutput | null> {
    const setting = await this.prisma.userLocaleSetting.findUnique({
      where: { userId },
    });

    return setting ? this.mapToOutput(setting) : null;
  }

  /**
   * Update a user locale setting
   */
  async updateSetting(
    id: string,
    input: Partial<Omit<UserLocaleSettingInput, 'userId'>>
  ): Promise<UserLocaleSettingOutput> {
    const setting = await this.prisma.userLocaleSetting.update({
      where: { id },
      data: {
        ...(input.languageId !== undefined && { languageId: input.languageId }),
        ...(input.countryId !== undefined && { countryId: input.countryId }),
        ...(input.timezoneId !== undefined && { timezoneId: input.timezoneId }),
        ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode }),
        ...(input.dateFormat !== undefined && { dateFormat: input.dateFormat }),
        ...(input.numberFormat !== undefined && { numberFormat: input.numberFormat }),
      },
    });

    return this.mapToOutput(setting);
  }

  /**
   * Update a user locale setting by user ID
   */
  async updateSettingByUserId(
    userId: string,
    input: Partial<Omit<UserLocaleSettingInput, 'userId'>>
  ): Promise<UserLocaleSettingOutput> {
    const setting = await this.prisma.userLocaleSetting.update({
      where: { userId },
      data: {
        ...(input.languageId !== undefined && { languageId: input.languageId }),
        ...(input.countryId !== undefined && { countryId: input.countryId }),
        ...(input.timezoneId !== undefined && { timezoneId: input.timezoneId }),
        ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode }),
        ...(input.dateFormat !== undefined && { dateFormat: input.dateFormat }),
        ...(input.numberFormat !== undefined && { numberFormat: input.numberFormat }),
      },
    });

    return this.mapToOutput(setting);
  }

  /**
   * Delete a user locale setting
   */
  async deleteSetting(id: string): Promise<boolean> {
    try {
      await this.prisma.userLocaleSetting.delete({
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
   * Get or create a user locale setting (upsert by user ID)
   */
  async getOrCreateSetting(input: UserLocaleSettingInput): Promise<UserLocaleSettingOutput> {
    const setting = await this.prisma.userLocaleSetting.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        languageId: input.languageId,
        countryId: input.countryId,
        timezoneId: input.timezoneId,
        currencyCode: input.currencyCode,
        dateFormat: input.dateFormat,
        numberFormat: input.numberFormat,
      },
      update: {
        languageId: input.languageId,
        countryId: input.countryId,
        timezoneId: input.timezoneId,
        currencyCode: input.currencyCode,
        dateFormat: input.dateFormat,
        numberFormat: input.numberFormat,
      },
    });

    return this.mapToOutput(setting);
  }

  private mapToOutput(setting: PrismaUserLocaleSetting): UserLocaleSettingOutput {
    return {
      id: setting.id,
      userId: setting.userId,
      languageId: setting.languageId,
      countryId: setting.countryId,
      timezoneId: setting.timezoneId,
      currencyCode: setting.currencyCode,
      dateFormat: setting.dateFormat,
      numberFormat: setting.numberFormat,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }
}

