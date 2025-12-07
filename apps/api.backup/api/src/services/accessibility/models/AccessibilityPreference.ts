/**
 * B242A-ACC-001: AccessibilityPreference model
 *
 * Type definitions for accessibility preferences stored in the database.
 */

export interface AccessibilityPreferenceData {
  id: string;
  userId: string;
  highContrast: boolean;
  textSizeScale: number;
  enableCaptions: boolean;
  reduceMotion: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccessibilityPreferenceInput {
  userId: string;
  highContrast?: boolean;
  textSizeScale?: number;
  enableCaptions?: boolean;
  reduceMotion?: boolean;
}

export interface UpdateAccessibilityPreferenceInput {
  highContrast?: boolean;
  textSizeScale?: number;
  enableCaptions?: boolean;
  reduceMotion?: boolean;
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES = {
  highContrast: false,
  textSizeScale: 1.0,
  enableCaptions: false,
  reduceMotion: false,
} as const;

