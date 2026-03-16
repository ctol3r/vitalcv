/**
 * STUB: Web lint configuration.
 * TODO: Align with monorepo lint conventions.
 */

module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    '@next/next/no-img-element': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
  overrides: [
    {
      files: [
        'components/intelligence-ops/**/*.tsx',
        'design-system/components/**/*.tsx',
        'design-system/layouts/**/*.tsx',
        'design-system/patterns/**/*.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "Literal[value=/(#(?:[0-9a-fA-F]{3,8})|rgb\\(|rgba\\(|hsl\\(|hsla\\(|oklab\\(|oklch\\(|color\\()/]",
            message:
              'no-hex-color-in-components: use VDS tokens or theme variables instead of hardcoded color literals.',
          },
          {
            selector:
              "TemplateElement[value.raw=/(#(?:[0-9a-fA-F]{3,8})|rgb\\(|rgba\\(|hsl\\(|hsla\\(|oklab\\(|oklch\\(|color\\()/]",
            message:
              'no-hex-color-in-components: use VDS tokens or theme variables instead of hardcoded color literals.',
          },
        ],
      },
    },
  ],
};
