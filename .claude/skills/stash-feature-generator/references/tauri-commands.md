# Contrato FE↔BE: comandos y eventos Tauri

## Tabla completa de comandos actuales

Params = clave del objeto pasado a `invoke` (case JS real). Wrapper = función en el `*.api.ts` del slice.

| Comando | Params (JS) | Retorno | Wrapper |
|---|---|---|---|
| `open_youtube_login` | — | void | `session.api.ts::openYouTubeLogin` |
| `refresh_session_silent` | — | `boolean` | `session.api.ts::refreshSessionSilent` |
| `get_session_status` | — | `'none'\|'expired'\|'connected'` | `session.api.ts::getSessionStatus` |
| `get_account_info` | — | `AccountInfo \| null` | `session.api.ts::getAccountInfo` |
| `logout` | — | void | `session.api.ts::logoutSession` |
| `open_downloads_folder` | — | void | `settings.api.ts::openDownloadsFolder` |
| `get_download_folder` | — | `string` | `settings.api.ts::getDownloadFolder` |
| `set_download_folder` | `{folder}` | `string` | `settings.api.ts::changeDownloadFolder` |
| `get_settings` | — | `AppConfig` (snake_case, legado) | `settings.api.ts::getSettings` |
| `set_settings` | `{defaultQuality, defaultContainer, defaultAudioFormat, defaultConcurrency, defaultMode?, defaultTemplate?, defaultSubtitles?, defaultThumbnail?, clearLinksAfterPreview?}` | void | `settings.api.ts::setSettings` |
| `start_download` | `{url, options: DownloadOptions}` | `DownloadResult` | `download.api.ts::startDownload` |
| `cancel_download` | `{url: string \| null}` | `boolean` | `download.api.ts::cancelDownload` |
| `analyze_urls` | `{urls, start?, end?}` (rango 1-based → `--playlist-items`) | `AnalyzedEntry[]` | `preview.api.ts::analyzeUrls` |
| `get_history` | — | `LibraryEntry[]` | `library.api.ts::getHistory` |
| `add_history` | `{url, title, format, videoId, thumbnail, duration, filePath}` (null si no hay) | `LibraryEntry` | `library.api.ts::addHistory` |
| `remove_history_item` | `{id}` | void | `library.api.ts::removeHistoryItem` |
| `delete_history_file` | `{id}` | `'trash'\|'permanent'\|'no_file'` | `library.api.ts::deleteHistoryFile` |
| `clear_history` | — | void | `library.api.ts::clearHistory` |
| `open_history_folder` | `{folder}` | void | `library.api.ts::openHistoryFolder` |
| `check_dependencies` | — | `DependencyStatus` | `setup.api.ts::checkDependencies` |
| `download_dependencies` | — | void | `setup.api.ts::downloadDependencies` |

## Reglas serde (case del contrato)

1. **Args planos del comando**: Tauri convierte solo camelCase (JS) ↔ snake_case (Rust).
   `invoke('add_history', { videoId })` llega a `video_id: Option<String>`. No hace falta nada.
2. **Structs NUEVOS**: siempre `#[serde(rename_all = "camelCase")]` (modelo: `DownloadOptions`, `AccountInfo`).
   Renames puntuales cuando el struct no lo tiene entero: `#[serde(rename = "errorKind")]` en `DownloadResult`.
3. **Legado snake_case INTOCABLE sin migración**: `AppConfig` (el TS usa `download_folder`,
   `default_quality`, `clear_links_after_preview`…) y `VideoMeta`/`PlaylistMeta` (`view_count`,
   `size_bytes`, `playlist_count`, `is_playlist`). Cambiarles el case rompe frontend Y archivos
   persistidos (`config.json`). Además `AppConfig` tiene contrato de retro-compat: cada campo con
   `#[serde(default = "…")]` y tests que verifican que un config viejo deserializa (settings/models.rs).
4. Campos opcionales de salida: `#[serde(skip_serializing_if = "Option::is_none")]` → en TS son `campo?: T`.

## Eventos Tauri (backend → frontend)

| Evento | Payload | Emisor | Wrapper FE |
|---|---|---|---|
| `download-progress` | `ProgressData {percent, speed, eta, status, url}` | download/service (hilo lector de stdout) | `download.api.ts::onProgress` |
| `preview-progress` | tupla `(done, total)` — **LEGADO, no imitar**: los eventos nuevos llevan struct | preview/commands (por URL analizada) | `preview.api.ts::onPreviewProgress` |
| `cookies-extracted` | `bool` | session/commands (login y login silencioso) | `session.api.ts::onCookiesExtracted` |
| `setup-progress` | `SetupProgress {step, percent, message}` | setup/service (emit_progress) | `setup.api.ts::onSetupProgress` |

Nombres en **kebab-case**. Patrón del wrapper y del consumidor:

```ts
// {slice}.api.ts — único sitio que ve core/tauri/client
export function on{X}(cb: (data: {Payload}) => void): Promise<UnlistenFn> {
  return onEvent<{Payload}>('{event-name}', cb);
}

// consumidor (vista): suscribir, y LIBERAR el unlisten al terminar
const unlisten = await on{X}((p) => { /* … */ });
try { /* trabajo */ } finally { unlisten(); }   // descargar.ts::analyze
// o en un flujo largo: guardar `unlisten` y llamarlo en el finally/limpieza (settings-view.ts::btn-repair)
```

## `spawn_blocking`: cuándo y cómo

Comando `async` + `tauri::async_runtime::spawn_blocking` cuando el cuerpo bloquea:
proceso externo (`start_download`, `analyze_urls`), `reqwest::blocking`
(`get_account_info`, `download_dependencies`), o FS/COM lento (`delete_history_file`, papelera).

```rust
#[tauri::command]
pub async fn {cmd}(app: AppHandle, url: String, options: {Opts}) -> Result<{Out}, String> {
    let app_dir = paths::app_dir(&app);
    // spawn_blocking usa el pool bloqueante de tokio (cientos de hilos), así una
    // descarga larga NO ocupa un worker del runtime async (que congelaría analyze_urls,
    // login, etc.).                     ← comentario real; consérvalo en los nuevos
    tauri::async_runtime::spawn_blocking(move || {
        // State<> no puede moverse a un hilo bloqueante: recuperar del handle.
        let registry = app.state::<DownloadRegistry>();
        service::{fn}(&app, &registry, &app_dir, &url, &options)
    })
    .await
    .map_err(|e| format!("Error interno en el hilo de {…}: {}", e))
}
```

Comandos síncronos rápidos (leer un JSON, borrar un archivo pequeño) se quedan `fn` normales.

## `YtdlpCmd`: TODA invocación nueva de yt-dlp pasa por el builder

`core/ytdlp.rs`. `build()` añade SIEMPRE `--encoding utf-8` (bug de codepage de Windows) y cierra
con `-- <url>` (una URL que empiece por `-` no se interpreta como flag). El llamador solo declara
sus flags y sus condiciones:

```rust
let mut builder = YtdlpCmd::new(app_dir, url)
    .arg("-J").arg("--flat-playlist")      // flags propios
    .no_warnings().no_update()
    .ffmpeg_location().deno_runtime();     // binarios bundled si existen
if {condicion_de_cookies} {
    builder = builder.cookies(&session::get_cookies_path(app_dir)); // solo si el archivo existe
}
let out = builder.build().output()…        // u .spawn() si hay que registrar el PID
```
Única excepción existente: `clear_ytdlp_cache` (no opera sobre una URL). Parseo de progreso:
`ytdlp::parse_percent` / `ytdlp::parse_field`.

## `DownloadRegistry`: procesos cancelables

Cualquier proceso que el usuario pueda cancelar sigue el ciclo (download/service.rs):

```rust
registry.begin(url);                       // en la entrada del flujo
let child = builder.build().spawn()…;
registry.set_pid(url, child.id());         // si ya estaba cancelado, set_pid lo mata bajo el lock
// … esperar/leer …
registry.clear_pid(url);                   // proceso terminó pero el flujo sigue (reintento)
if registry.is_cancelled(url) { /* abortar antes de cada nuevo spawn */ }
registry.finish(url);                      // SIEMPRE al final (éxito o fallo)
```
`cancel_download(url: Option<String>)` → `registry.cancel(url.as_deref())`: None cancela todo.
En Windows se mata con `taskkill /F /T` (incluye el ffmpeg hijo). `hide_console()` en todo `Command` nuevo.

## Persistencia JSON

Siempre `core::fsx::write_atomic(&path, content)` (tmp + rename): un corte a mitad nunca deja
`config.json` / `history.json` / `cookies.txt` corruptos. Lectura tolerante:
`serde_json::from_str(&content).unwrap_or_default()` (settings/library) — un archivo corrupto
degrada a defaults, no rompe la app.
