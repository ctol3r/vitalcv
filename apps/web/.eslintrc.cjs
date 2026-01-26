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
};
