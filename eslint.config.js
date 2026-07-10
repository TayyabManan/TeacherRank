import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Downgrade every jsx-a11y recommended rule from "error" to "warn" — a11y is
// informative on an existing codebase, not a merge blocker (yet).
const a11yWarn = Object.fromEntries(
  Object.keys(jsxA11y.configs.recommended.rules).map((rule) => [rule, 'warn']),
);

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.claude/**', // Claude Code worktrees — stale copies of the project, not source
      'database/**',
      'scripts/**',
      'api/**',
      'public/**',
      'supabase/**', // Deno edge functions — different runtime/globals, linted separately
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },

  // Base JS + TypeScript recommended (NOT type-checked, to keep lint fast; the
  // standalone `tsc --noEmit` is the type gate).
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Hooks: rules-of-hooks catches real bugs -> error; deps -> warn.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Accessibility: informative, not blocking.
      ...a11yWarn,

      // Fast-refresh hygiene for Vite HMR.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Soften the noisy TS rules so the existing codebase isn't all-red.
      // These are quality signals, not correctness bugs.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },

  // Test + setup files: relax further (mocks legitimately use `any`, empty fns).
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
