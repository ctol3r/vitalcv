import { themeTokens } from '@/design-system/styles';

export const themeColors = themeTokens.colors;

export type ThemeColorScale = typeof themeColors;
export type ThemeColorMode = keyof ThemeColorScale;
export type ThemeColorToken = keyof ThemeColorScale['light'];
