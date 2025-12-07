/**
 * B246B-DES-016: Storybook integration & setup
 *
 * Integrate Storybook for visual testing of all components.
 * Configure themes toggle within Storybook.
 * Add stories for all design system components.
 * Uses addons (controls, a11y).
 * Add build script.
 */

import type { StorybookConfig } from '@storybook/react-vite';
import { ThemeProvider } from '../theme/ThemeProvider';
import { lightTheme, darkTheme } from '../theme/themes';
import React from 'react';

const config: StorybookConfig = {
  stories: [
    '../**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../../apps/web/src/components/**/*.stories.@(js|jsx|ts|tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-controls',
    '@storybook/addon-viewport',
    '@storybook/addon-backgrounds',
    {
      name: '@storybook/addon-styling',
      options: {
        // PostCSS for Tailwind
        postCss: {
          implementation: require('postcss'),
        },
      },
    },
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  // Decorator to wrap stories with ThemeProvider
  decorators: [
    (Story, context) => {
      const themeMode = context.globals.theme || 'light';
      const theme = themeMode === 'dark' ? darkTheme : lightTheme;

      return React.createElement(
        ThemeProvider,
        {
          defaultTheme: themeMode,
          defaultCustomTheme: theme,
        },
        React.createElement(Story)
      );
    },
  ],
  // Global types for theme switcher
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'system', title: 'System', icon: 'computer' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default config;

