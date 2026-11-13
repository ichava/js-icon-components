import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { ignores, typescript } from './config/eslint.base.js';

export default tseslint.config(ignores, { ignores: ['.cache/**', 'vendor/**'] }, typescript, {
  // The install scripts are plain JavaScript: `prepare` runs before anything is compiled.
  files: ['scripts/**/*.mjs'],
  extends: [js.configs.recommended],
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
});
