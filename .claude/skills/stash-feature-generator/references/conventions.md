# Naming, comments, commits, facades and test conventions

## Naming table (all verified in the repo)

| Thing | Convention | Real examples |
|---|---|---|
| TS files | kebab-case | `media-card.ts`, `queue-view.ts`, `video-opts-modal.ts`, `event-bus.ts` |
| FE slice files | `{slice}.api.ts` / `{slice}.types.ts` / `{slice}.state.ts` | `session.state.ts`, `download.api.ts` (exception: `opts-model.ts` is download's model) |
| Views | `ui/{name}-view.ts` or descriptive | `library-view.ts`, `descargar.ts`, `onboarding.ts` |
| Rust files | fixed per slice | `commands.rs`, `service.rs`, `models.rs` (+ `webview.rs` in session) |
| Tauri commands | snake_case `verb_noun` | `start_download`, `get_session_status`, `delete_history_file` |
| Tauri events | kebab-case | `download-progress`, `cookies-extracted`, `setup-progress` |
| Bus events | `domain:action` | `session:expired`, `nav:goto`, `download:completed`, `descargar:prefill` |
| TS functions | camelCase; command wrappers = camelCase of the command | `startDownload`, `getSessionStatus`; view init = `init{Name}` |
| DOM ids | kebab-case with view prefix | `search-input`, `yt-more`, `ov-done`, `set-quality` (full table in ui-patterns.md) |
| Chip `data-group` | camelCase | `setQuality`, `ovMode`, `quality` |
| localStorage | `stash.` prefix for new keys | `stash.lang`, `stash.recentLinks` — dotless legacy NOT to rename: `stash-theme`, `stash-onboarded` |
| Utility CSS classes | short, global in stash.css | `.hov`, `.acc-btn`, `.view`/`.is-active`, `.seg`, `.chips`, `.nav-btn` |
| Constants | SCREAMING_SNAKE | `RADIO_CAP`, `AUTH_ERROR_MSG`, `BROWSER_UA`, `STATUS_META`, `PAGE` |
| Slices | English, singular or domain | `download`, `preview`, `queue`, `session`, `library`, `settings`, `setup`, `search`, `youtube-account` |

## Code comments (TS and Rust)

**In English, concise, max 1-2 lines.** Explain the why, not the what; no comment is better
than a redundant one. This applies to `//`, `/* */`, and doc comments alike.

UI-facing strings are NOT comments and follow their own rules:
- Rust error messages returned to the frontend (`Result<T, String>`) are user-visible text:
  they stay in **Spanish** until backend i18n exists (see error-handling.md).
- Frontend texts keep the `t(es, en)` / `data-en*` system exactly as documented in i18n.md.

## Commits (real git-log style)

`type(scope): description` — **in Spanish and WITHOUT accents** (the log uses "descripcion",
"nucleo", "tamanos"). This convention is intentionally kept in Spanish — do not switch it to
English. Types seen: `feat`, `fix`, `refactor`, `chore`, `test` (combinable: `chore,test(fase4):`,
`fix,refactor(fase1):`). Scope = slice or phase:

```
feat(session): logout real + deteccion de sesion caducada + fix Mi YouTube
fix(preview): radios/Mix -> tope 25; playlists reales -> sin tope
refactor(fase3): cortes de god-files, dedupe de vistas y nucleo Rust unificado
```
Body (when present): `-` bullets, dense, citing numbers ("descargar.ts 754->265") and the why.

## Facades (`index.ts`): what to export and what not

Export the MINIMUM others consume; the facade is the contract between slices.

```ts
// features/queue/index.ts — the complete real facade:
export { enqueue, setConcurrency } from './queue.state';
export type { EnqueueItem } from './queue.state';
export { initQueueView } from './ui/queue-view';
```

| DO export | Do NOT export |
|---|---|
| `init{Name}` (consumed by main.ts) | Internal state functions (`pump`, `notify`, `handleAuthFailure`) |
| api/state functions another slice uses (`enqueue`, `getCookieMode`, `analyzeUrls`, `addHistory`) | Render helpers (`renderList`, `paint…`) |
| Contract types (`EnqueueItem`, `VideoMeta`, `AppConfig`, `DownloadOptions`) | Whole internal modules (`account-card` is "NOT exported through the facade: only account-view consumes it") |
| Re-exports of types needed downstream (`UnlistenFn` from setup: consumers cannot touch core/tauri/client) | Raw mutable state (queue exposes `getItems(): readonly QItem[]`, not the array) |

A slice may have a minimal facade (`search/index.ts` exports only `initSearch`).

## Test style

**TypeScript (vitest):**
- Next to the code: `{module}.test.ts`. `describe`/`it` names IN SPANISH, describing
  behavior: `it('rechaza URL ya encolada o activa')`, `describe('begin() (anti-race)')`.
- Mock other slices' FACADES, never their internals:
  `vi.mock('../download', () => ({ startDownload: mocks.startDownload }))` with `vi.hoisted`.
- Modules with global state → `vi.resetModules()` in `beforeEach` + dynamic import
  (`await import('./queue.state')`); or targeted cleanup in `afterEach` (opts-model overrides).
- Helpers with Spanish names: `flush()`, `descargaEterna()`, `cargarCola()`, `pagina()`, `linea()`.
- DOM tests: live in `ui/` (vitest.config.ts's jsdom project) and/or mark
  `// @vitest-environment jsdom` with a one-line English comment explaining why they need the DOM.

**Rust:**
- `#[cfg(test)] mod tests { use super::*; … }` AT THE END of the same file.
- Test names in Spanish with snake_case:
  `fn build_fuerza_encoding_utf8_y_cierra_con_doble_guion_antes_de_la_url()`.
- Sections separated with `// ---------- name ----------`.
- Helpers/fixtures local to the tests mod: `fn linea(...)`, `struct TempDir` with `Drop`, `fn opciones(...)`.

See testing.md for what deserves a test and what doesn't.
