// Enforcement de la arquitectura del frontend (CONTEXT.md §4):
//   core ← shared ← features ← app ← main
//   - core no importa nada de la app.
//   - shared solo importa core + shared.
//   - features importan core/shared/su propio slice; de OTROS slices solo su index.ts.
//   - features no importan app/ (navegación vía bus 'nav:goto').
//   - invoke / @tauri-apps solo en *.api.ts (y en core/tauri/*, que es la fachada).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        // Resuelve imports relativos .ts y los alias @core/@shared/@features/@app (tsconfig paths).
        typescript: { alwaysTryTypes: true },
      },
      'boundaries/elements': [
        { type: 'main', mode: 'file', pattern: 'src/main.ts' },
        { type: 'app', pattern: 'src/app' },
        { type: 'core', pattern: 'src/core' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
      ],
    },
    rules: {
      // Promesas sueltas: origen típico de errores silenciosos en handlers de UI.
      '@typescript-eslint/no-floating-promises': 'error',

      // Convención del proyecto: prefijo _ para parámetros intencionalmente sin usar.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Capas: solo se importa "hacia abajo" (los imports internos de un mismo
      // elemento no se comprueban). Entre slices de features solo se permite la
      // fachada pública (index.ts) vía internalPath.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: 'Import prohibido por la arquitectura (${file.type} -> ${dependency.type}). Ver CONTEXT.md §4.',
          rules: [
            // core no importa nada de la app (sin regla => todo denegado).
            { from: { type: 'shared' }, allow: { to: { type: ['core', 'shared'] } } },
            { from: { type: 'features' }, allow: { to: { type: ['core', 'shared'] } } },
            {
              from: { type: 'features' },
              allow: { to: { type: 'features', internalPath: 'index.ts' } },
              message: 'De otro feature solo puede importarse su index.ts (fachada pública). Ver CONTEXT.md §4.',
            },
            { from: { type: 'app' }, allow: { to: { type: ['core', 'shared', 'app'] } } },
            { from: { type: 'app' }, allow: { to: { type: 'features', internalPath: 'index.ts' } } },
            { from: { type: 'main' }, allow: { to: { type: ['core', 'shared', 'app'] } } },
            { from: { type: 'main' }, allow: { to: { type: 'features', internalPath: 'index.ts' } } },
          ],
        },
      ],

      // Acceso a Tauri encapsulado: invoke/eventos solo desde *.api.ts vía core/tauri.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tauri-apps/*', '@tauri-apps/*/*'],
              message: 'El acceso a Tauri va encapsulado: usa el *.api.ts del slice (o core/tauri/*).',
            },
            {
              group: ['**/core/tauri/client', '@core/tauri/client'],
              message: 'invoke/onEvent solo se consumen desde los *.api.ts de cada slice.',
            },
          ],
        },
      ],
    },
  },

  // Excepciones al encapsulado de Tauri: la propia fachada (core/tauri/*) y la
  // única puerta al backend de cada slice (*.api.ts).
  {
    files: ['src/core/tauri/**/*.ts', 'src/**/*.api.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Deuda conocida y aceptada: dl-actions vive en shared/ pero orquesta fachadas
  // de features (queue/session/download/preview) para compartir el flujo de
  // descarga entre search y youtube-account. Moverlo a app/ rompería la regla
  // "features no importan app". Se le permite shared -> features, pero SOLO
  // entrando por el index.ts de cada slice.
  {
    files: ['src/shared/ui/dl-actions.ts'],
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: { type: 'shared' }, allow: { to: { type: ['core', 'shared'] } } },
            { from: { type: 'shared' }, allow: { to: { type: 'features', internalPath: 'index.ts' } } },
          ],
        },
      ],
    },
  },
);
