// Frontend architecture enforcement (React vertical slices — stash-frontend skill):
//   shared ← features ← shell (shared/routes) ← main
//   - shared/ never imports features (the routes shell is the app composition layer
//     and is the single exception: it mounts feature pages and app-level bridges).
//   - features import shared/ and their own slice only. Cross-feature imports are
//     FORBIDDEN except through a feature's index.ts facade, and ONLY for the
//     sanctioned app-level contracts:
//       '@/features/queue'    → useQueueStore + EnqueueItem (enqueue contract)
//       '@/features/session'  → session hooks (status/account/login/logout/reconnect)
//       '@/features/download' → useDownloadPrefill (prefill contract)
//     Everything else (deep paths like '@/features/queue/stores/...') must fail:
//     each feature owns its local API hooks (guideline §4.15).
//   - invoke/onEvent (Tauri) only from shared/lib/tauri.ts (facade), shared/lib/window.ts,
//     shared/hooks/useTauriEvent.ts and each feature's api/ and stores/ layers.
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
        // Resolves relative imports and the "@/" alias (tsconfig paths).
        typescript: { alwaysTryTypes: true },
      },
      'boundaries/elements': [
        // Order matters: first match wins (shell before shared).
        { type: 'main', mode: 'file', pattern: 'src/main.tsx' },
        { type: 'shell', pattern: 'src/shared/routes' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
      ],
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Floating promises: the usual source of silent failures in UI handlers.
      '@typescript-eslint/no-floating-promises': 'error',

      // Project convention: _ prefix for intentionally unused parameters.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Layer boundaries (see header comment for the full doctrine).
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            'Import forbidden by the architecture (${file.type} -> ${dependency.type}). See eslint.config.js header.',
          rules: [
            { from: { type: 'shared' }, allow: { to: { type: 'shared' } } },
            // Shell = composition layer: facades + lazy-loaded pages.
            { from: { type: 'shell' }, allow: { to: { type: ['shared', 'shell'] } } },
            {
              from: { type: 'shell' },
              allow: { to: { type: 'features', internalPath: '(index.ts|pages/*.tsx)' } },
            },
            { from: { type: 'features' }, allow: { to: { type: 'shared' } } },
            // Features may read route path constants, nothing else from the shell.
            {
              from: { type: 'features' },
              allow: { to: { type: 'shell', internalPath: 'app-path.ts' } },
            },
            // Sanctioned cross-feature contracts, facade-only (see header).
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
                'Cross-feature imports: only @/features/(queue|session|download) via their index.ts facade. Anything else: local hook (guideline §4.15).',
            },
            { from: { type: 'main' }, allow: { to: { type: ['shared', 'shell', 'features'] } } },
          ],
        },
      ],

      // Tauri access is encapsulated: invoke/onEvent only behind the facade.
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

  // Exceptions to the Tauri encapsulation: the facade itself, the event hook,
  // the window helpers, and each feature's api/stores layers.
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
