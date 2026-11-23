import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Architecture boundaries are enforced here (see docs/architecture.md):
 * - engine: pure rules and algorithms; no rendering, DOM, content, instances, application or client code.
 * - content: data definitions; may depend on engine contracts only.
 * - instances: world instance setup (scenarios); may depend on engine and content.
 * - app: use-case orchestration; never on rendering or client code.
 */
const layerRule = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

/**
 * Mandatory code size limits (see DEVELOPMENT.md, "Code quality rules"). Every line counts,
 * including blank lines and comments. Generated output and dependencies are excluded through `.gitignore`.
 */
const sizeLimits = {
  'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: false, skipComments: false, IIFEs: true }],
};

export default tseslint.config(
  // Files ignored by Git (generated output, dependencies, disposable local files) are never linted.
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Inline `eslint-disable` comments are rejected so quality checks cannot be bypassed locally.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      ...sizeLimits,
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: { globals: {} },
    rules: layerRule([
      { group: ['three', 'three/*'], message: 'The engine must not depend on rendering.' },
      {
        group: ['**/client/**', '**/app/**', '**/content/**', '**/instances/**'],
        message: 'The engine must not depend on outer layers.',
      },
    ]),
  },
  {
    files: ['src/content/**/*.ts'],
    rules: layerRule([
      { group: ['three', 'three/*'], message: 'Content must not depend on rendering.' },
      { group: ['**/client/**', '**/app/**', '**/instances/**'], message: 'Content must not depend on outer layers.' },
    ]),
  },
  {
    files: ['src/instances/**/*.ts'],
    rules: layerRule([
      { group: ['three', 'three/*'], message: 'World instances must not depend on rendering.' },
      { group: ['**/client/**', '**/app/**'], message: 'World instances must not depend on outer layers.' },
    ]),
  },
  {
    files: ['src/app/**/*.ts'],
    rules: layerRule([
      { group: ['three', 'three/*'], message: 'Application services must not depend on rendering.' },
      { group: ['**/client/**'], message: 'Application services must not depend on the client.' },
    ]),
  },
  {
    files: ['tests/**/*.ts', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Must stay last: disables stylistic rules that conflict with Prettier.
  prettier,
);
