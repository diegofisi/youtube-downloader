# Stash's real backend architecture

Vertical slicing + screaming architecture on both sides of the app. This file covers the
Rust/Tauri side. Frontend architecture (React slices, layers, state) lives in the
`stash-frontend` skill — do not duplicate it here.

## Backend tree (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                        # Builder: manage(DownloadRegistry) + plugins + generate_handler! + kill_all on close
├── core/                          # "Cross-cutting infrastructure (no domain). Every feature consumes it."
│   ├── fsx.rs                     # write_atomic (tmp + rename)
│   ├── models.rs                  # ProgressData (download-progress event)
│   ├── paths.rs                   # app_dir(dev/release), find_executable, has_binary
│   ├── process.rs                 # DownloadRegistry (Tauri State) + hide_console + kill_process
│   └── ytdlp.rs                   # YtdlpCmd (builder) + parse_percent + parse_field
└── features/                      # "Each folder = one capability."
    ├── download/  commands · service · models          (private service: `mod service;`)
    ├── library/   commands · service · models          (private service)
    ├── preview/   commands · service · models          (private service)
    ├── session/   commands · service · models · webview (PUBLIC service: cookies for download/preview)
    ├── settings/  commands · service · models          (PUBLIC service: download folder for download/library)
    └── setup/     commands · service · models          (private service)
```

## Canonical anatomy of a slice

| File | Role |
|---|---|
| `models.rs` | Serde structs of the contract (plus internal groupers like `NewEntry`) |
| `service.rs` | All the logic; `Result<T, String>` — error strings are user-facing product copy in the app's default language (see error-handling.md); `#[cfg(test)] mod tests` at the end |
| `commands.rs` | Thin `#[tauri::command]` wrappers: resolve `app_dir`, delegate, `spawn_blocking` when heavy |
| `mod.rs` | `pub mod commands; pub mod models; mod service;` — `pub mod service` ONLY if another slice consumes it (session, settings) |

Existing cross-slice Rust dependencies (the only ones): download/preview → `session::service` (cookies),
download/library → `settings::service` (folder). Everything else shares via `core::*`.

## Composition root (`main.rs`)

`.manage(DownloadRegistry::default())` → plugins (dialog/shell/fs) →
`generate_handler![...]` (20 commands) → `on_window_event`: when `main` is destroyed, `kill_all()`
(never leave orphaned yt-dlp/ffmpeg processes).

## Decision Log (backend)

Original IDs are kept; the missing numbers were frontend decisions that died with the
vanilla-TS UI in the React cutover (the React ones live in stash-frontend).

| # | Decision | Why (the code's real rationale) |
|---|---|---|
| D2 | **DownloadRegistry as Tauri State (no statics)** | Replaces 3 statics with double bookkeeping. Closes the cancel/spawn race: `cancel()` marks+kills and `set_pid()` kills if already cancelled, all under THE SAME lock — "either cancel sees the PID, or spawn sees the cancel" (core/process.rs). |
| D3 | **`error_kind: Option<String>` ("auth"\|"cache"\|"other") instead of thiserror/enums** | At this scale there is ONE consumer (the queue) branching into 3 cases, and the error travels to the frontend as a String anyway. `preview/service.rs` leaves an explicit TODO: unify into `{message, kind}` ONLY when the preview frontend branches by kind. |
| D4 | **Avatar as a base64 data URL** | The webview cannot load `yt3.ggpht.com` on its own (origin/referer); the backend downloads the image and injects it as `data:` with fallback to the raw URL (session/service.rs). |
| D5 | **PINNED dependency versions** | yt-dlp `2026.03.17`, deno `v2.9.1`, ffmpeg 7.1 series — concrete tags, not `releases/latest`: "so the app doesn't break when a new version changes behavior we haven't tested. Update deliberately" (setup/service.rs). |
| D6 | **`--encoding utf-8` ALWAYS (in `YtdlpCmd::build()`)** | When writing to a pipe on Windows, the yt-dlp exe drops characters outside the codepage (Japanese titles): paths/JSON would arrive degraded and not match the real files (core/ytdlp.rs). |
| D7 | **Cookies from `youtube.com` only in the account_menu header** | Mixing in google.com's makes YouTube degrade the response: sometimes no photo, sometimes no account — "verified empirically" (session/service.rs). Note: session VALIDATION also requires the auth cookie on `.youtube.com` (browser exports carry SAPISID only on `.google.com`). |
| D8 | **History as JSON (cap 500) with `write_atomic`** | Household scale; tmp+rename guarantees a crash never leaves the JSON half-written. SQLite only if it grows. |
| D11 | **`spawn_blocking` for everything heavy** | tokio's blocking pool has hundreds of threads: a long download doesn't freeze `analyze_urls`, login, etc. (download/commands.rs). |
