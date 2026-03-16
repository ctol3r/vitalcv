import { graphiteTheme } from './graphite';
import { darkTheme } from './dark';
import { lightTheme } from './light';
import { midnightTheme } from './midnight';

export * from './types';
export { darkTheme, graphiteTheme, lightTheme, midnightTheme };

export const vdsThemes = {
  light: lightTheme,
  dark: darkTheme,
  midnight: midnightTheme,
  graphite: graphiteTheme,
} as const;

export type VdsThemeName = keyof typeof vdsThemes;
