// Layer boundaries for the React vertical slices: shared ← features ← shell ← main.
// Cross-feature imports go only through the 3 facade index.ts files; Tauri stays
// behind the shared/lib facade. Full doctrine: the frontend skill.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';

const SANCTIONED_FACADES = ['queue', 'session', 'download'];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { boundaries, 'react-hooks': reactHooks },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
      'boundaries/elements': [
        // First match wins — shell must precede shared.
        { type: 'main', mode: 'file', pattern: 'src/main.tsx' },
        { type: 'shell', pattern: 'src/shared/routes' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
      ],
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: 'Import forbidden by the architecture (${file.type} -> ${dependency.type}).',
          rules: [
            { from: { type: 'shared' }, allow: { to: { type: 'shared' } } },
            { from: { type: 'shell' }, allow: { to: { type: ['shared', 'shell'] } } },
            {
              from: { type: 'shell' },
              allow: { to: { type: 'features', internalPath: '(index.ts|pages/*.tsx)' } },
            },
            { from: { type: 'features' }, allow: { to: { type: 'shared' } } },
            {
              from: { type: 'features' },
              allow: { to: { type: 'shell', internalPath: 'app-path.ts' } },
            },
            {
              from: { type: 'features' },
              allow: {
                to: SANCTIONED_FACADES.map((feature) => ({
                  type: 'features',
                  captured: { feature },
                  internalPath: 'index.ts',
                })),
              },
              message:
                'Cross-feature imports: only @/features/(queue|session|download) via their index.ts facade. Anything else: local hook.',
            },
            { from: { type: 'main' }, allow: { to: { type: ['shared', 'shell', 'features'] } } },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/lib/tauri', '@tauri-apps/*', '@tauri-apps/*/*'],
              message:
                'Tauri access is encapsulated: only api/[endpoint]/ and stores/ may use invoke/onEvent (via @/shared/lib/tauri).',
            },
          ],
        },
      ],
    },
  },
  // Tauri-encapsulation exceptions: the facade, the event hook, window helpers,
  // and each feature's api/ and stores/ layers.
  {
    files: [
      'src/shared/lib/tauri.ts',
      'src/shared/lib/window.ts',
      'src/shared/hooks/useTauriEvent.ts',
      'src/features/**/api/**/*.{ts,tsx}',
      'src/features/**/stores/**/*.{ts,tsx}',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
);
