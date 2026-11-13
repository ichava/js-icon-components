// Canonical: ichava/js-ui-kernel config/eslint.base.js. Copies must be byte-identical;
// `npm run check:config-drift` fails on drift. Repository-specific blocks (vendored
// paths, import restrictions) belong in each repository's eslint.config.js, after these.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths no repository lints: build output, dependencies, static assets, tool configs. */
export const ignores = {
  ignores: [
    'dist/**',
    'dist-ssr/**',
    'node_modules/**',
    'public/**',
    'e2e/**',
    '*.config.{js,ts}',
    'coverage/**',
  ],
};

/**
 * The TypeScript block every repository shares. tsc --strict already guards types and
 * unused locals; this adds what tsc cannot see.
 */
export const typescript = {
  files: ['**/*.{ts,tsx}'],
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  languageOptions: {
    ecmaVersion: 2022,
    globals: { ...globals.browser, ...globals.node },
  },
  rules: {
    // tsc's noUnusedLocals already covers unused; keep as a warn with _-escape hatch.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // The packages deliberately use a few `any`/`{}`-ish casts at framework seams.
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

/**
 * The React block, for the React packages only. The plugins are passed in rather than
 * imported, so this file loads in a repository that has no React tooling installed.
 *
 * @param {{ reactHooks: any, reactRefresh: any }} plugins
 */
export function react({ reactHooks, reactRefresh }) {
  return {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // rules-of-hooks + deps are the real value; deps is already warn. The v6
      // perf/refresh advisories fire on intentional patterns (sync loading flags,
      // storage rehydration, hooks beside components), so they stay warnings.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  };
}
