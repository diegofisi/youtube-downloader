# Convenciones de naming, commits, fachadas y tests

## Tabla de naming (todo verificado en el repo)

| Cosa | Convención | Ejemplos reales |
|---|---|---|
| Archivos TS | kebab-case | `media-card.ts`, `queue-view.ts`, `video-opts-modal.ts`, `event-bus.ts` |
| Archivos de slice FE | `{slice}.api.ts` / `{slice}.types.ts` / `{slice}.state.ts` | `session.state.ts`, `download.api.ts` (excepción: `opts-model.ts` es el modelo de download) |
| Vistas | `ui/{nombre}-view.ts` o descriptivo | `library-view.ts`, `descargar.ts`, `onboarding.ts` |
| Archivos Rust | fijos por slice | `commands.rs`, `service.rs`, `models.rs` (+ `webview.rs` en session) |
| Comandos Tauri | snake_case `verbo_sustantivo` | `start_download`, `get_session_status`, `delete_history_file` |
| Eventos Tauri | kebab-case | `download-progress`, `cookies-extracted`, `setup-progress` |
| Eventos de bus | `dominio:accion` | `session:expired`, `nav:goto`, `download:completed`, `descargar:prefill` |
| Funciones TS | camelCase; wrappers de comando = camelCase del comando | `startDownload`, `getSessionStatus`; init de vista = `init{Nombre}` |
| Ids DOM | kebab-case con prefijo de vista | `search-input`, `yt-more`, `ov-done`, `set-quality` (tabla completa en ui-patterns.md) |
| `data-group` de chips | camelCase | `setQuality`, `ovMode`, `quality` |
| localStorage | prefijo `stash.` para claves nuevas | `stash.lang`, `stash.recentLinks` — legado sin punto que NO renombrar: `stash-theme`, `stash-onboarded` |
| Clases CSS utilitarias | cortas, globales en stash.css | `.hov`, `.acc-btn`, `.view`/`.is-active`, `.seg`, `.chips`, `.nav-btn` |
| Constantes | SCREAMING_SNAKE | `RADIO_CAP`, `AUTH_ERROR_MSG`, `BROWSER_UA`, `STATUS_META`, `PAGE` |
| Slices | inglés, singular o dominio | `download`, `preview`, `queue`, `session`, `library`, `settings`, `setup`, `search`, `youtube-account` |

## Commits (estilo real del git log)

`tipo(scope): descripción` — **en español y SIN tildes** (el log usa "descripcion", "nucleo",
"tamanos"). Tipos vistos: `feat`, `fix`, `refactor`, `chore`, `test` (combinables: `chore,test(fase4):`,
`fix,refactor(fase1):`). Scope = slice o fase:

```
feat(session): logout real + deteccion de sesion caducada + fix Mi YouTube
fix(preview): radios/Mix -> tope 25; playlists reales -> sin tope
refactor(fase3): cortes de god-files, dedupe de vistas y nucleo Rust unificado
```
Cuerpo (si lo hay): bullets con `-`, densos, citando números ("descargar.ts 754->265") y el porqué.

## Fachadas (`index.ts`): qué exportar y qué no

Exportar el MÍNIMO que otros consumen; la fachada es el contrato entre slices.

```ts
// features/queue/index.ts — fachada real completa:
export { enqueue, setConcurrency } from './queue.state';
export type { EnqueueItem } from './queue.state';
export { initQueueView } from './ui/queue-view';
```

| SÍ exportar | NO exportar |
|---|---|
| `init{Name}` (lo consume main.ts) | Funciones internas del state (`pump`, `notify`, `handleAuthFailure`) |
| Funciones de api/state que otro slice usa (`enqueue`, `getCookieMode`, `analyzeUrls`, `addHistory`) | Helpers de render (`renderList`, `paint…`) |
| Tipos del contrato (`EnqueueItem`, `VideoMeta`, `AppConfig`, `DownloadOptions`) | Módulos internos completos (`account-card` "NO se exporta por la fachada: solo lo consume account-view") |
| Re-export de tipos necesarios río abajo (`UnlistenFn` desde setup: los consumidores no pueden tocar core/tauri/client) | Estado mutable crudo (queue expone `getItems(): readonly QItem[]`, no el array) |

Un slice puede tener fachada mínima (`search/index.ts` exporta solo `initSearch`).

## Estilo de tests

**TypeScript (vitest):**
- Junto al código: `{modulo}.test.ts`. Nombres de `describe`/`it` EN ESPAÑOL, describiendo
  comportamiento: `it('rechaza URL ya encolada o activa')`, `describe('begin() (anti-race)')`.
- Se mockean las FACHADAS de otros slices, nunca los internos:
  `vi.mock('../download', () => ({ startDownload: mocks.startDownload }))` con `vi.hoisted`.
- Módulos con estado global → `vi.resetModules()` en `beforeEach` + import dinámico
  (`await import('./queue.state')`); o limpieza puntual en `afterEach` (overrides de opts-model).
- Helpers con nombre español: `flush()`, `descargaEterna()`, `cargarCola()`, `pagina()`, `linea()`.
- Tests de DOM: viven en `ui/` (proyecto jsdom de vitest.config.ts) y/o marcan
  `// @vitest-environment jsdom` con una línea explicando por qué necesitan DOM.

**Rust:**
- `#[cfg(test)] mod tests { use super::*; … }` AL FINAL del mismo archivo.
- Nombres de test en español con snake_case:
  `fn build_fuerza_encoding_utf8_y_cierra_con_doble_guion_antes_de_la_url()`.
- Secciones separadas con `// ---------- nombre ----------`.
- Helpers/fixtures locales al mod tests: `fn linea(...)`, `struct TempDir` con `Drop`, `fn opciones(...)`.

Ver testing.md para qué merece test y qué no.
