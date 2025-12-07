/**
 * B242A-ACC-002: AccessibilitySettingsService
 *
 * Manages user accessibility preferences with CRUD operations,
 * applies default settings, and updates session cookies.
 */

import prisma from '../../../graphql/prisma_client';
import {
  AccessibilityPreferenceData,
  CreateAccessibilityPreferenceInput,
  UpdateAccessibilityPreferenceInput,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
} from '../models/AccessibilityPreference';
import { Response } from 'express';

export class AccessibilitySettingsService {
  /**
   * Get accessibility preferences for a user, creating defaults if none exist
   */
  async getPreferences(userId: string): Promise<AccessibilityPreferenceData> {
    let preference = await prisma.accessibilityPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      // Create default preferences
      preference = await this.createPreferences({
        userId,
        ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      });
    }

    return preference;
  }

  /**
   * Create accessibility preferences for a user
   */
  async createPreferences(
    input: CreateAccessibilityPreferenceInput
  ): Promise<AccessibilityPreferenceData> {
    const data = {
      userId: input.userId,
      highContrast: input.highContrast ?? DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast,
      textSizeScale: input.textSizeScale ?? DEFAULT_ACCESSIBILITY_PREFERENCES.textSizeScale,
      enableCaptions: input.enableCaptions ?? DEFAULT_ACCESSIBILITY_PREFERENCES.enableCaptions,
      reduceMotion: input.reduceMotion ?? DEFAULT_ACCESSIBILITY_PREFERENCES.reduceMotion,
    };

    const preference = await prisma.accessibilityPreference.upsert({
      where: { userId: input.userId },
      create: data,
      update: data,
    });

    return preference;
  }

  /**
   * Update accessibility preferences for a user
   */
  async updatePreferences(
    userId: string,
    input: UpdateAccessibilityPreferenceInput
  ): Promise<AccessibilityPreferenceData> {
    const preference = await prisma.accessibilityPreference.update({
      where: { userId },
      data: {
        ...(input.highContrast !== undefined && { highContrast: input.highContrast }),
        ...(input.textSizeScale !== undefined && { textSizeScale: input.textSizeScale }),
        ...(input.enableCaptions !== undefined && { enableCaptions: input.enableCaptions }),
        ...(input.reduceMotion !== undefined && { reduceMotion: input.reduceMotion }),
      },
    });

    return preference;
  }

  /**
   * Delete accessibility preferences for a user
   */
  async deletePreferences(userId: string): Promise<void> {
    await prisma.accessibilityPreference.delete({
      where: { userId },
    }).catch(() => {
      // Ignore if preferences don't exist
    });
  }

  /**
   * Apply accessibility preferences to session cookies
   * This allows frontend to read preferences without additional API calls
   */
  applyPreferencesToCookies(
    res: Response,
    preferences: AccessibilityPreferenceData
  ): void {
    // Set individual cookies for each preference
    res.cookie('accessibility_highContrast', preferences.highContrast.toString(), {
      httpOnly: false, // Allow JavaScript to read
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    res.cookie('accessibility_textSizeScale', preferences.textSizeScale.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    res.cookie('accessibility_enableCaptions', preferences.enableCaptions.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    res.cookie('accessibility_reduceMotion', preferences.reduceMotion.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  /**
   * Get preferences and apply to cookies in one call
   */
  async getAndApplyPreferences(userId: string, res: Response): Promise<AccessibilityPreferenceData> {
    const preferences = await this.getPreferences(userId);
    this.applyPreferencesToCookies(res, preferences);
    return preferences;
  }
}

export const accessibilitySettingsService = new AccessibilitySettingsService();

