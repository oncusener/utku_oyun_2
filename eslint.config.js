// Flat config. `eslint-config-expo` brings the React, React Hooks and
// React Native rules that actually matter here; `eslint-config-prettier`
// switches off everything that would argue with the formatter.
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expo,
  prettier,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'android/**',
      'ios/**',
      'public/**',
    ],
  },
  {
    rules: {
      // The ads module talks to an optional native SDK whose types only exist
      // when that SDK resolved; `any` there is the honest annotation.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
