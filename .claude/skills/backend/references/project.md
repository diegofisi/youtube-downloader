# Project binding — YouTube Downloader

**Replace or delete this file when reusing this skill in another project.** Everything
below binds the generic doctrine of this skill to THIS repo (YouTube Downloader: a desktop YouTube
downloader built on Tauri 2 + Rust + yt-dlp/ffmpeg). Nothing here is doctrine — it is the
project's live data: real names, the FE↔BE contract, and the decision log.

## Placeholder bindings

| Placeholder in doctrine | YouTube Downloader value |
|---|---|
| `{tool}` / `{Tool}Cmd` | yt-dlp / `YtdlpCmd` (`core/ytdlp.rs`) |
| process registry | `DownloadRegistry` (`core/process.rs`) |
| bundled helper binaries | ffmpeg, deno (`.ffmpeg_location().deno_runtime()` on the builder) |
| auth file | `cookies.txt` (`.cookies(&session::get_cookies_path(app_dir))` — only if the file exists; yt-dlp receives a per-run copy) |
| product-copy language | Spanish (es) — openers "No se pudo …" / "Error …", action hints like "Verifica que la configuración inicial se completó correctamente." |
| model slices for Workflow A | `library` or `settings` |
| heavy-command models | `download/commands.rs::start_download`, `library/commands.rs::delete_history_file` |
| log prefixes | `[download]`, `[login]`, `[silent-login]`, `[library]` |

## Verification commands

```
pnpm run check                 # tsc --noEmit + eslint src + cargo check
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings   # or: pnpm run check:rust
cd src-tauri && cargo test
```

## Real backend tree (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                        # Builder: manage(DownloadRegistry) + plugins + generate_handler! + kill_all on close
├── core/
│   ├── fsx.rs                     # write_atomic (tmp + rename)
│   ├── models.rs                  # ProgressData (download-progress event)
│   ├── paths.rs                   # app_dir (dev: <project>/.dev-data; release: AppData), find_executable
│   ├── process.rs                 # DownloadRegistry (Tauri State) + hide_console + kill_process
│   └── ytdlp.rs                   # YtdlpCmd (builder) + parse_percent + parse_field
└── features/
    ├── download/  commands · service · models          (private service: `mod service;`)
    ├── library/   commands · service · models          (private service)
    ├── preview/   commands · service · models          (private service)
    ├── session/   commands · service · models · webview (PUBLIC service: cookies for download/preview)
    ├── settings/  commands · service · models          (PUBLIC service: download folder for download/library)
    └── setup/     commands · service · models          (private service)
```

Existing cross-slice Rust dependencies (the only ones): download/preview →
`session::service` (cookies), download/library → `settings::service` (folder). Everything
else shares via `core::*`. `on_window_event`: when `main` is destroyed, `kill_all()` —
never leave orphaned yt-dlp/ffmpeg processes.

## FE↔BE contract: full command table

Params = keys of the object the frontend passes to the invoke adapter (real JS case).

| Command | Params (JS) | Returns |
|---|---|---|
| `open_youtube_login` | — | void |
| `refresh_session_silent` | — | `boolean` |
| `get_session_status` | — | `'none'\|'expired'\|'connected'` |
| `get_account_info` | — | `AccountInfo \| null` |
| `logout` | — | void |
| `open_downloads_folder` | — | void |
| `get_download_folder` | — | `string` |
| `set_download_folder` | `{folder}` | `string` |
| `get_settings` | — | `AppConfig` (snake_case, legacy) |
| `set_settings` | `{defaultQuality, defaultContainer, defaultAudioFormat, defaultConcurrency, defaultMode?, defaultTemplate?, defaultSubtitles?, defaultThumbnail?, clearLinksAfterPreview?}` | void |
| `start_download` | `{url, options: DownloadOptions}` | `DownloadResult` |
| `cancel_download` | `{url: string \| null}` | `boolean` |
| `analyze_urls` | `{urls, start?, end?}` (1-based range → `--playlist-items`) | `AnalyzedEntry[]` |
| `get_history` | — | `LibraryEntry[]` |
| `add_history` | `{url, title, format, videoId, thumbnail, duration, filePath}` (null when absent) | `LibraryEntry` |
| `remove_history_item` | `{id}` | void |
| `delete_history_file` | `{id}` | `'trash'\|'permanent'\|'no_file'` |
| `clear_history` | — | void |
| `open_history_folder` | `{folder}` | void |
| `check_dependencies` | — | `DependencyStatus` |
| `download_dependencies` | — | void |

## Tauri events (backend → frontend)

| Event | Payload | Emitter (Rust) |
|---|---|---|
| `download-progress` | `ProgressData {percent, speed, eta, status, url}` | download/service (stdout reader thread) |
| `preview-progress` | `(done, total)` tuple — **LEGACY, do not imitate**: new events carry a struct | preview/commands (per analyzed URL) |
| `cookies-extracted` | `bool` | session/commands (login and silent login) |
| `setup-progress` | `SetupProgress {step, percent, message}` | setup/service (emit_progress) |

## Legacy serde exceptions (snake_case, UNTOUCHABLE without a migration)

- `AppConfig` — the TS uses `download_folder`, `default_quality`,
  `clear_links_after_preview`… Also a back-compat contract: every field carries
  `#[serde(default = "…")]` plus tests verifying an old config deserializes
  (settings/models.rs). Changing its case breaks the frontend AND persisted `config.json`.
- `VideoMeta` / `PlaylistMeta` — `view_count`, `size_bytes`, `playlist_count`, `is_playlist`.

camelCase models to copy for NEW structs: `DownloadOptions`, `AccountInfo`. Targeted
rename example: `#[serde(rename = "errorKind")]` in `DownloadResult`.

## `error_kind` binding (download failure classification)

`DownloadResult` carries `errorKind?: 'auth' | 'cache' | 'other' | 'cancelled'`. Classification
lives in `core/ytdlp.rs::classify_error` over yt-dlp's `ERROR:` lines (only `ERROR:` lines
count; the rest of stderr is noise). Preview strips the user's search query from the line
before classifying (`preview/service.rs::without_query_text`):

| kind | Patterns (lowercase) | Reaction |
|---|---|---|
| `auth` | "sign in to confirm", "members-only", "cookies are no longer valid", "please sign in", "not a bot", "login required", "login details are needed", "http error 401" | Fixed `AUTH_ERROR_MSG` message. The frontend queue pauses the batch and attempts a silent session reconnect (frontend skill). `auth` takes priority over `cache`. |
| `cache` | "http error 403", "forbidden", fragment+403 | The BACKEND clears yt-dlp's cache (`--rm-cache-dir`) and retries ONCE, checking `is_cancelled` before respawning |
| `other` / None | everything else | Regular error: the message travels to the frontend as-is |
| `cancelled` | registry says the user cancelled | Fixed "Descarga cancelada" message; the queue ignores results of cancelled/paused items |

Contract invariant: an `auth` failure returns as a RESOLVED `DownloadResult` with
`errorKind: 'auth'` (not a rejected promise) — the queue's pause/silent-reconnect/resume
semantics depend on it.

`analyze_urls` never rejects per URL either: a failed URL comes back as an id-less
`VideoMeta` whose `availability` is `"error: <ERROR line>"` or, when `classify_error`
says auth, `"error:auth: <ERROR line>"` (legacy `VideoMeta` gets no new field; the class
travels in the prefix — parsed by `src/shared/lib/analyze-entry-error.ts`).

Cookies: every yt-dlp run gets a per-run COPY of `cookies.txt` (`YtdlpCmd::cookies` →
`TempCookies`, deleted when the `YtdlpRun` drops) because yt-dlp rewrites the `--cookies`
file on exit and would clobber a freshly renewed session. Keep the `YtdlpRun` alive until
the process has exited.

Documented `.unwrap()` exception: `paths::app_dir` in release falls back to temp with an
`eprintln!` instead of panicking.

## `YtdlpCmd` specifics

`build()` ALWAYS appends `--encoding utf-8` and closes with `-- <url>`. The only existing
exception to "everything goes through the builder": `clear_ytdlp_cache` (does not operate
on a URL). Progress parsing: `ytdlp::parse_percent` / `ytdlp::parse_field`. Cancel kill on
Windows: `taskkill /F /T` (includes the child ffmpeg); `hide_console()` on every new
`Command`.

## Decision log (backend)

Original IDs are kept; the missing numbers were frontend decisions that died with the
vanilla-TS UI in the React cutover (the React ones live in the frontend skill's binding).

| # | Decision | Why (the code's real rationale) |
|---|---|---|
| D2 | **DownloadRegistry as Tauri State (no statics)** | Replaces 3 statics with double bookkeeping. Closes the cancel/spawn race: `cancel()` marks+kills and `set_pid()` kills if already cancelled, all under THE SAME lock — "either cancel sees the PID, or spawn sees the cancel" (core/process.rs). Entries are keyed by the frontend's run id (`<item>:<runSeq>`, `start_download`/`cancel_download` param `runId`), registered in the command before `spawn_blocking`; a cancel for an unknown id leaves a tombstone that its own `begin()` consumes, so it can never hit another run. |
| D3 | **`error_kind: Option<String>` ("auth"\|"cache"\|"other"\|"cancelled") instead of thiserror/enums** | The error travels to the frontend as a String anyway. Preview reuses the same classifier and reports the class through the `availability` prefix (see `error_kind` binding) so legacy `VideoMeta` stays untouched. |
| D4 | **Avatar as a base64 data URL** | The webview cannot load `yt3.ggpht.com` on its own (origin/referer); the backend downloads the image and injects it as `data:` with fallback to the raw URL (session/service.rs). |
| D5 | **PINNED dependency versions** | yt-dlp `2026.03.17`, deno `v2.9.1`, ffmpeg 7.1 series — concrete tags, not `releases/latest`: "so the app doesn't break when a new version changes behavior we haven't tested. Update deliberately" (setup/service.rs). |
| D6 | **`--encoding utf-8` ALWAYS (in `YtdlpCmd::build()`)** | When writing to a pipe on Windows, the yt-dlp exe drops characters outside the codepage (Japanese titles): paths/JSON would arrive degraded and not match the real files (core/ytdlp.rs). |
| D7 | **Cookies from `youtube.com` only in the account_menu header** | Mixing in google.com's makes YouTube degrade the response: sometimes no photo, sometimes no account — "verified empirically" (session/service.rs). Note: session VALIDATION also requires the auth cookie on `.youtube.com` (browser exports carry SAPISID only on `.google.com`). |
| D8 | **History as JSON (cap 500) with `write_atomic`** | Household scale; tmp+rename guarantees a crash never leaves the JSON half-written. SQLite only if it grows. |
| D11 | **`spawn_blocking` for everything heavy** | tokio's blocking pool has hundreds of threads: a long download doesn't freeze `analyze_urls`, login, etc. (download/commands.rs). |

## Test inventory (today)

Embedded Rust tests in: `core/ytdlp.rs`, `download/service.rs`, `session/service.rs`,
`settings/models.rs`. Concrete fragile-parts examples: `parse_percent`/`parse_field` over
real yt-dlp lines; `parse_netscape` (Netscape cookies, `#HttpOnly_`, insufficient fields);
`classify_error` (every auth pattern, case-insensitive, auth>cache priority);
`YtdlpCmd::build` via `Command::get_args`; `AppConfig` back-compat; `template_with_suffix`,
`path_with_suffix`, `expected_final_paths`, `sapisidhash` (format). Existing tests predate
the English-name rule and keep their original names — do not mass-rename.
