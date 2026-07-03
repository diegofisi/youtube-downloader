# FE↔BE contract: Tauri commands and events

## Full table of current commands

Params = keys of the object passed to `invoke` (real JS case). Wrapper = function in the slice's `*.api.ts`.

| Command | Params (JS) | Returns | Wrapper |
|---|---|---|---|
| `open_youtube_login` | — | void | `session.api.ts::openYouTubeLogin` |
| `refresh_session_silent` | — | `boolean` | `session.api.ts::refreshSessionSilent` |
| `get_session_status` | — | `'none'\|'expired'\|'connected'` | `session.api.ts::getSessionStatus` |
| `get_account_info` | — | `AccountInfo \| null` | `session.api.ts::getAccountInfo` |
| `logout` | — | void | `session.api.ts::logoutSession` |
| `open_downloads_folder` | — | void | `settings.api.ts::openDownloadsFolder` |
| `get_download_folder` | — | `string` | `settings.api.ts::getDownloadFolder` |
| `set_download_folder` | `{folder}` | `string` | `settings.api.ts::changeDownloadFolder` |
| `get_settings` | — | `AppConfig` (snake_case, legacy) | `settings.api.ts::getSettings` |
| `set_settings` | `{defaultQuality, defaultContainer, defaultAudioFormat, defaultConcurrency, defaultMode?, defaultTemplate?, defaultSubtitles?, defaultThumbnail?, clearLinksAfterPreview?}` | void | `settings.api.ts::setSettings` |
| `start_download` | `{url, options: DownloadOptions}` | `DownloadResult` | `download.api.ts::startDownload` |
| `cancel_download` | `{url: string \| null}` | `boolean` | `download.api.ts::cancelDownload` |
| `analyze_urls` | `{urls, start?, end?}` (1-based range → `--playlist-items`) | `AnalyzedEntry[]` | `preview.api.ts::analyzeUrls` |
| `get_history` | — | `LibraryEntry[]` | `library.api.ts::getHistory` |
| `add_history` | `{url, title, format, videoId, thumbnail, duration, filePath}` (null when absent) | `LibraryEntry` | `library.api.ts::addHistory` |
| `remove_history_item` | `{id}` | void | `library.api.ts::removeHistoryItem` |
| `delete_history_file` | `{id}` | `'trash'\|'permanent'\|'no_file'` | `library.api.ts::deleteHistoryFile` |
| `clear_history` | — | void | `library.api.ts::clearHistory` |
| `open_history_folder` | `{folder}` | void | `library.api.ts::openHistoryFolder` |
| `check_dependencies` | — | `DependencyStatus` | `setup.api.ts::checkDependencies` |
| `download_dependencies` | — | void | `setup.api.ts::downloadDependencies` |

## Serde rules (contract case)

1. **Flat command args**: Tauri converts camelCase (JS) ↔ snake_case (Rust) on its own.
   `invoke('add_history', { videoId })` arrives as `video_id: Option<String>`. Nothing extra needed.
2. **NEW structs**: always `#[serde(rename_all = "camelCase")]` (model: `DownloadOptions`, `AccountInfo`).
   Targeted renames when the struct doesn't have it wholesale: `#[serde(rename = "errorKind")]` in `DownloadResult`.
3. **snake_case legacy is UNTOUCHABLE without a migration**: `AppConfig` (the TS uses `download_folder`,
   `default_quality`, `clear_links_after_preview`…) and `VideoMeta`/`PlaylistMeta` (`view_count`,
   `size_bytes`, `playlist_count`, `is_playlist`). Changing their case breaks the frontend AND
   persisted files (`config.json`). `AppConfig` also has a back-compat contract: every field carries
   `#[serde(default = "…")]` plus tests verifying an old config deserializes (settings/models.rs).
4. Optional output fields: `#[serde(skip_serializing_if = "Option::is_none")]` → in TS they are `field?: T`.

## Tauri events (backend → frontend)

| Event | Payload | Emitter | FE wrapper |
|---|---|---|---|
| `download-progress` | `ProgressData {percent, speed, eta, status, url}` | download/service (stdout reader thread) | `download.api.ts::onProgress` |
| `preview-progress` | `(done, total)` tuple — **LEGACY, do not imitate**: new events carry a struct | preview/commands (per analyzed URL) | `preview.api.ts::onPreviewProgress` |
| `cookies-extracted` | `bool` | session/commands (login and silent login) | `session.api.ts::onCookiesExtracted` |
| `setup-progress` | `SetupProgress {step, percent, message}` | setup/service (emit_progress) | `setup.api.ts::onSetupProgress` |

Names in **kebab-case**. Wrapper and consumer pattern:

```ts
// {slice}.api.ts — the only place that sees core/tauri/client
export function on{X}(cb: (data: {Payload}) => void): Promise<UnlistenFn> {
  return onEvent<{Payload}>('{event-name}', cb);
}

// consumer (view): subscribe, and RELEASE the unlisten when done
const unlisten = await on{X}((p) => { /* … */ });
try { /* work */ } finally { unlisten(); }   // descargar.ts::analyze
// or in a long flow: store `unlisten` and call it in the finally/cleanup (settings-view.ts::btn-repair)
```

## `spawn_blocking`: when and how

`async` command + `tauri::async_runtime::spawn_blocking` whenever the body blocks:
external process (`start_download`, `analyze_urls`), `reqwest::blocking`
(`get_account_info`, `download_dependencies`), or slow FS/COM (`delete_history_file`, trash).

```rust
#[tauri::command]
pub async fn {cmd}(app: AppHandle, url: String, options: {Opts}) -> Result<{Out}, String> {
    let app_dir = paths::app_dir(&app);
    // spawn_blocking uses tokio's blocking pool (hundreds of threads): a long download
    // never ties up an async worker (which would freeze analyze_urls, login, etc.).
    //                                  ← keep this comment (in English) in new heavy commands
    tauri::async_runtime::spawn_blocking(move || {
        // State<> cannot move into a blocking thread: recover it from the handle.
        let registry = app.state::<DownloadRegistry>();
        service::{fn}(&app, &registry, &app_dir, &url, &options)
    })
    .await
    .map_err(|e| format!("Error interno en el hilo de {…}: {}", e))  // user-facing: Spanish
}
```

Fast synchronous commands (reading a JSON, deleting a small file) stay plain `fn`.

## `YtdlpCmd`: EVERY new yt-dlp invocation goes through the builder

`core/ytdlp.rs`. `build()` ALWAYS appends `--encoding utf-8` (Windows codepage bug) and closes
with `-- <url>` (a URL starting with `-` is not parsed as a flag). The caller only declares
its flags and its conditions:

```rust
let mut builder = YtdlpCmd::new(app_dir, url)
    .arg("-J").arg("--flat-playlist")      // caller's own flags
    .no_warnings().no_update()
    .ffmpeg_location().deno_runtime();     // bundled binaries if present
if {cookies_condition} {
    builder = builder.cookies(&session::get_cookies_path(app_dir)); // only if the file exists
}
let out = builder.build().output()…        // or .spawn() when the PID must be registered
```
The only existing exception: `clear_ytdlp_cache` (does not operate on a URL). Progress parsing:
`ytdlp::parse_percent` / `ytdlp::parse_field`.

## `DownloadRegistry`: cancelable processes

Any process the user can cancel follows the cycle (download/service.rs):

```rust
registry.begin(url);                       // at the entry of the flow
let child = builder.build().spawn()…;
registry.set_pid(url, child.id());         // if already cancelled, set_pid kills it under the lock
// … wait/read …
registry.clear_pid(url);                   // process ended but the flow continues (retry)
if registry.is_cancelled(url) { /* abort before each new spawn */ }
registry.finish(url);                      // ALWAYS at the end (success or failure)
```
`cancel_download(url: Option<String>)` → `registry.cancel(url.as_deref())`: None cancels everything.
On Windows the kill is `taskkill /F /T` (includes the child ffmpeg). `hide_console()` on every new `Command`.

## JSON persistence

Always `core::fsx::write_atomic(&path, content)` (tmp + rename): a mid-write crash never leaves
`config.json` / `history.json` / `cookies.txt` corrupted. Tolerant reads:
`serde_json::from_str(&content).unwrap_or_default()` (settings/library) — a corrupt file
degrades to defaults instead of breaking the app.
