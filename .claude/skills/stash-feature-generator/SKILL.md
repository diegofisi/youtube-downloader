---
name: stash-feature-generator
description: >
  Generates new code in Stash (Tauri 2 + vanilla TS, vertical slices) following
  the repo's REAL architecture and conventions. Use when asked to add a new
  feature, a new Tauri command, a new view or section, a new event, "generate
  module", "add command/view/feature/slice" — including the Spanish trigger
  phrases "nueva feature", "nuevo comando", "nueva vista", "añadir sección",
  "nuevo evento" — or any change that crosses the frontend↔backend boundary.
---

# Stash Feature Generator

Examples > prose: every pattern below exists in the code; copy the cited example instead of inventing. Spanish for UI texts and user-facing error messages; English for code, file names, and code comments (concise, max 1-2 lines).

## References

| File | When to read it |
|---|---|
| `references/architecture.md` | Before creating a slice or moving code between layers. Real trees, ESLint rules, bus, decision log. |
| `references/tauri-commands.md` | Before touching a Tauri command or event. Full FE↔BE contract table, serde, spawn_blocking, YtdlpCmd. |
| `references/ui-patterns.md` | Before writing any view or component. innerHTML+rebind, shared components, id prefixes, CSS vars. |
| `references/error-handling.md` | Errors, toasts, `error_kind`, the queue's auth flow. |
| `references/i18n.md` | Any new visible text. |
| `references/conventions.md` | Naming, comments, commits, facades, test style. |
| `references/testing.md` | Before writing tests (what to test and with which patterns). |

## Workflow A — New Tauri command

Full chain (use `library` or `settings` as the model slice):

1. **`src-tauri/src/features/{slice}/models.rs`** — input/output structs. NEW structs always:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")]
   pub struct {Thing} { pub file_path: Option<String>, /* arrives as filePath */ }
   ```
2. **`service.rs`** — ALL the logic. Typical signature: `pub fn {verb}(app_dir: &Path, ...) -> Result<{Thing}, String>` with user-facing messages in Spanish (`format!("No se pudo …: {}", e)`). No `tauri::` except `AppHandle` when it emits events.
3. **`commands.rs`** — THIN wrapper:
   ```rust
   #[tauri::command]
   pub fn {verb}_{noun}(app: AppHandle, {arg}: String) -> Result<{Thing}, String> {
       let app_dir = paths::app_dir(&app);
       service::{verb}(&app_dir, &{arg})
   }
   ```
   If the work is heavy (external process, `reqwest::blocking`, trash/COM): `async fn` + `tauri::async_runtime::spawn_blocking` — copy the pattern and comment from `download/commands.rs::start_download` or `library/commands.rs::delete_history_file`.
4. **`main.rs`** — add `{slice}::commands::{verb}_{noun}` to `tauri::generate_handler![…]`.
5. **`src/features/{slice}/{slice}.api.ts`** — the only place allowed to call `invoke` (the lint enforces it):
   ```ts
   export function {verbNoun}({arg}: string): Promise<{Thing}> {
     return invoke<{Thing}>('{verb}_{noun}', { {arg} });
   }
   ```
   Flat camelCase args: Tauri maps them to snake_case on its own (`videoId` → `video_id`).
6. **`{slice}.types.ts`** — TS mirror of the model, camelCase.
7. **`index.ts`** — export the wrapper ONLY if another slice/app needs it.
8. Verify (final checklist).

## Workflow B — New view/section

1. **`index.html`** — `<section class="view" data-view="{id}">` inside `<main>`. All ids carry the view's own prefix (`{pfx}-…`, see table in ui-patterns). Static texts in Spanish + `data-en` / `data-en-ph` / `data-en-title` carrying the English.
2. **`src/app/shell.ts`** — add the id to the `ViewId` union, an entry in `TITLES` (with `t(es, en)`) and one in `NAV` (icon from the `I` registry at 18px).
3. **Slice** `src/features/{slice}/ui/{slice}-view.ts` exporting `init{Name}(): void` — static buttons are wired ONCE in init; lists are repainted with innerHTML + rebind (see ui-patterns).
4. The slice's **`index.ts`** exports `init{Name}`.
5. **`src/main.ts`** — call `init{Name}()` (prefixed with `void` if async: `no-floating-promises` is an error).
6. Refresh on entering the view: `bus.on('nav:changed', ({ view }) => { if (view !== '{id}') return; … })` (pattern from `library-view.ts` / `descargar.ts`).

The view imports NOTHING from `app/`: to navigate it emits `bus.emit('nav:goto', { view: '…' })`.

## Workflow C — New event

| Case | Mechanism |
|---|---|
| FE slice → other FE slices / shell | Typed bus (`core/bus/event-bus.ts`) |
| Rust backend → frontend | Tauri event + wrapper in `{slice}.api.ts` |

**Bus:** add the key to `AppEvents` (name `domain:action`, e.g. `download:completed`), with a typed payload or `void`. Emitter: `bus.emit(...)`; listeners: `bus.on(...)`. Never loose strings outside that interface.

**Tauri:** kebab-case name (`download-progress`). The payload is ALWAYS a serde struct (`preview-progress` uses a `(done, total)` tuple — legacy, do NOT imitate). In Rust: `app.emit("{event-name}", {Payload} { … })`. In the api.ts:
```ts
export function on{X}(cb: (data: {Payload}) => void): Promise<UnlistenFn> {
  return onEvent<{Payload}>('{event-name}', cb);
}
```
The consumer keeps the unlisten and releases it (`descargar.ts::analyze`: `const unlisten = await onPreviewProgress(…)` … `finally { unlisten(); }`).

## Workflow D — Where does shared logic live?

| The logic… | Goes in |
|---|---|
| Touches the DOM and is generic (cards, menus, chips, toasts) | `shared/ui/` |
| Is pure, no DOM (formatting, escaping, hashes) | `shared/lib/` |
| Belongs to ONE slice's domain (option mappings, queue state…) | The owning slice; shared by exporting it through its `index.ts` |
| Orchestrates SEVERAL slices for views | Single existing exception: `shared/ui/dl-actions.ts` (debt documented in eslint.config.js). Do NOT create more; consider a bus event instead. |

## Final validation checklist

```
npm run check        # tsc --noEmit + eslint src + cargo check
npm run check:rust   # cargo check + cargo clippy -- -D warnings
npm test             # vitest run (node + jsdom projects)
cd src-tauri && cargo test
```
- [ ] New texts use `t(es, en)` (dynamic) or `data-en` (static).
- [ ] Every dynamic value interpolated into innerHTML goes through `esc()`.
- [ ] New command registered in `generate_handler!` and wrapped in its `.api.ts`.
- [ ] New DOM ids use their view's prefix.

## DO NOT

**The lint already catches these** (don't waste time trying):
- Importing `@tauri-apps/*` or `core/tauri/client` outside `*.api.ts` / `core/tauri/*`.
- Importing another slice's internals (only its `index.ts`).
- `features` → `app`, `shared` → `features` (except dl-actions), `core` → anything.
- Floating promises in handlers (`no-floating-promises`).

**The lint does NOT catch these** (manual discipline):
- Interpolating strings into innerHTML without `esc()`.
- New Tauri event payloads as tuples or bare values.
- New serde structs without `rename_all = "camelCase"` — and the reverse: "fixing" the legacy snake_case ones (`AppConfig`, `VideoMeta`) without a migration plan.
- `Record`s with translated texts as static values (use getters; see i18n.md).
- `addEventListener` inside a `paint()` that re-runs (accumulates listeners; use `.onclick`, see `video-opts-modal.ts`).
- Domain logic in `commands.rs` (it belongs in `service.rs`).
- Blocking work in an async command without `spawn_blocking`.
- New localStorage keys outside the `stash.` prefix.
- Invoking yt-dlp with a raw `Command::new`: use the `YtdlpCmd` builder (guarantees `--encoding utf-8` and `-- <url>`).
- Cancelable processes not registered in `DownloadRegistry`.
- Persisting JSON with a direct `fs::write`: use `core::fsx::write_atomic`.
