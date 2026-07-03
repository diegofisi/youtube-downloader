# Stash's real architecture

Vertical slicing + screaming architecture on both sides. Frontend layer rule
(literal header of `eslint.config.js`): `core ← shared ← features ← app ← main`.

## Frontend tree (`src/`)

```
src/
├── main.ts                        # composition root: applyStaticI18n() + initShell() + init of each slice
├── app/
│   └── shell.ts                   # titlebar, nav sidebar, TITLES/NAV, router{navigate,setBadge}, session banner
├── core/                          # domain-free infra (imports nothing from the app)
│   ├── bus/event-bus.ts           # typed AppEvents bus (on/emit)
│   ├── i18n.ts                    # t(es,en), getLang/setLang, applyStaticI18n (data-en/-ph/-title)
│   ├── theme.ts                   # THEMES dark/light → CSS vars on <html>; localStorage 'stash-theme'
│   └── tauri/
│       ├── client.ts              # invoke + onEvent (the only real gate to @tauri-apps)
│       └── window.ts              # minimize/toggleMaximize/close
├── shared/
│   ├── lib/                       # pure, no DOM: html.ts (esc), format.ts (fmtDuration/fmtSize/timeAgo/fmtDate)
│   └── ui/                        # dom.ts ($), icons.ts (I), toast, modal, controls, gradients,
│                                  # media-card, paged-loader, anchored-menu, dl-actions (documented exception)
├── styles/stash.css               # reset + fonts + animations + .hov/.acc-btn/.view/.seg/.chips
└── features/
    ├── download/    index.ts · download.api.ts · download.types.ts · opts-model.ts(+test)
    │                └── ui/ descargar.ts (orchestrator) · preview-render.ts · video-opts-modal.ts · recent-links.ts
    ├── preview/     index.ts · preview.api.ts · preview.types.ts        (no ui: download renders it)
    ├── queue/       index.ts · queue.state.ts(+test, DOM-free scheduler) · ui/queue-view.ts
    ├── session/     index.ts · session.api.ts · session.state.ts · session.types.ts
    ├── library/     index.ts · library.api.ts · library.types.ts · ui/library-view.ts
    ├── settings/    index.ts · settings.api.ts · settings.types.ts · ui/settings-view.ts
    ├── setup/       index.ts · setup.api.ts · setup.types.ts · ui/onboarding.ts
    ├── search/      index.ts · ui/search-view.ts                        (no api: uses the preview facade)
    └── youtube-account/ index.ts · ui/account-view.ts · ui/account-card.ts
```

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

**Frontend** (everything optional except `index.ts`):

| File | Role | Rule |
|---|---|---|
| `index.ts` | Public facade | The ONLY thing importable from outside the slice |
| `{slice}.api.ts` | Gate to the backend | The only file in the slice allowed to use `invoke`/`onEvent` |
| `{slice}.types.ts` | Contract types | TS mirror of the Rust models |
| `{slice}.state.ts` / `opts-model.ts` | State and logic WITHOUT DOM | Testable in a node environment; the view subscribes (`subscribe/notify` in queue) |
| `ui/*.ts` | Render + DOM wiring | Exports `init{Name}()`; imports the state, never the other way around |
| `*.test.ts` | Tests next to the code | See testing.md |

**Backend:**

| File | Role |
|---|---|
| `models.rs` | Serde structs of the contract (plus internal groupers like `NewEntry`) |
| `service.rs` | All the logic; `Result<T, String>` — error strings are user-facing UI text and stay in Spanish (see conventions.md); `#[cfg(test)] mod tests` at the end |
| `commands.rs` | Thin `#[tauri::command]` wrappers: resolve `app_dir`, delegate, `spawn_blocking` when heavy |
| `mod.rs` | `pub mod commands; pub mod models; mod service;` — `pub mod service` ONLY if another slice consumes it (session, settings) |

Existing cross-slice Rust dependencies (the only ones): download/preview → `session::service` (cookies),
download/library → `settings::service` (folder). Everything else shares via `core::*`.

## Import rules (enforced by `eslint.config.js`)

| From | ALLOWED into | FORBIDDEN |
|---|---|---|
| `core` | (nothing from the app) | everything else |
| `shared` | `core`, `shared` | `features`, `app` (exception: `dl-actions.ts` → `features/*/index.ts`) |
| `features` | `core`, `shared`, its own slice, other slices' `features/*/index.ts` | another slice's internals, `app`, `main` |
| `app` | `core`, `shared`, `app`, `features/*/index.ts` | slice internals |
| `main` | `core`, `shared`, `app`, `features/*/index.ts` | — |

Literal lint messages (these strings live in `eslint.config.js` and are in Spanish — leave them as-is):
*"De otro feature solo puede importarse su index.ts (fachada pública)"*,
*"El acceso a Tauri va encapsulado: usa el *.api.ts del slice (o core/tauri/*)"*,
*"invoke/onEvent solo se consumen desde los *.api.ts de cada slice"*.
Also: `no-floating-promises: error` and `_` as the prefix for unused parameters.

## Composition roots

- **FE `main.ts`** (real order): `applyStaticI18n()` → `initShell()` → `void initSession()` →
  `initQueueView()` → `initDescargar()` → `initSearch()` → `initAccount()` → `initLibrary()` →
  `void initSettings()` → `void initOnboarding()`. Async inits are prefixed with `void`.
- **BE `main.rs`**: `.manage(DownloadRegistry::default())` → plugins (dialog/shell/fs) →
  `generate_handler![...]` (20 commands) → `on_window_event`: when `main` is destroyed, `kill_all()`
  (never leave orphaned yt-dlp/ffmpeg processes).

## Event bus (real table)

| Event | Payload | Emitter(s) | Listener(s) |
|---|---|---|---|
| `session:expired` | void | session.state (refreshSession) | shell (shows banner) |
| `session:connected` | void | session.state | shell (hides banner) |
| `session:changed` | void | session.state (refresh/doLogout) | account-view (repaints card/grid) |
| `theme:changed` | void | shell (toggle), settings-view | shell (repaints sun/moon icon) |
| `nav:changed` | `{view}` | shell.navigate | descargar, library-view, search-view, account-view (refresh on entry) |
| `nav:goto` | `{view}` | descargar, dl-actions | shell (navigates) |
| `download:completed` | `{url,title,format,videoId?}` | queue.state | descargar (marks "already downloaded"), library-view (reloads) |
| `queue:count` | `{active}` | queue.state (emitCount) | shell (queue badge) |
| `descargar:prefill` | `{urls}` | dl-actions | descargar (fills textarea + analyzes) |

## Decision Log

| # | Decision | Why (the code's real rationale) |
|---|---|---|
| D1 | **Typed bus instead of cross imports** | "Decouples slices: one slice emits and others react without importing each other. Breaks the preview↔queue↔session cycles" (event-bus.ts). Also avoids `features → app`: navigation is `nav:goto`. |
| D2 | **DownloadRegistry as Tauri State (no statics)** | Replaces 3 statics with double bookkeeping. Closes the cancel/spawn race: `cancel()` marks+kills and `set_pid()` kills if already cancelled, all under THE SAME lock — "either cancel sees the PID, or spawn sees the cancel" (core/process.rs). |
| D3 | **`error_kind: Option<String>` ("auth"\|"cache"\|"other") instead of thiserror/enums** | At this scale there is ONE consumer (the queue) branching into 3 cases, and the error travels to the frontend as a String anyway. `preview/service.rs` leaves an explicit TODO: unify into `{message, kind}` ONLY when the preview frontend branches by kind. |
| D4 | **Avatar as a base64 data URL** | The webview cannot load `yt3.ggpht.com` on its own (origin/referer); the backend downloads the image and injects it as `data:` with fallback to the raw URL (session/service.rs). |
| D5 | **PINNED dependency versions** | yt-dlp `2026.03.17`, deno `v2.9.1`, ffmpeg 7.1 series — concrete tags, not `releases/latest`: "so the app doesn't break when a new version changes behavior we haven't tested. Update deliberately" (setup/service.rs). |
| D6 | **`--encoding utf-8` ALWAYS (in `YtdlpCmd::build()`)** | When writing to a pipe on Windows, the yt-dlp exe drops characters outside the codepage (Japanese titles): paths/JSON would arrive degraded and not match the real files (core/ytdlp.rs). |
| D7 | **Cookies from `youtube.com` only in the account_menu header** | Mixing in google.com's makes YouTube degrade the response: sometimes no photo, sometimes no account — "verified empirically" (session/service.rs). Note: session VALIDATION also requires the auth cookie on `.youtube.com` (browser exports carry SAPISID only on `.google.com`). |
| D8 | **History as JSON (cap 500) with `write_atomic`** | Household scale; tmp+rename guarantees a crash never leaves the JSON half-written. SQLite only if it grows. |
| D9 | **No framework: innerHTML + rebind, inline styles with CSS vars** | The entire palette lives in `core/theme.ts` as CSS vars; switching themes repaints no components. No reactive state: each view repaints its list and rewires via `data-*`. |
| D10 | **`dl-actions.ts` as accepted debt** | Shares the download flow between Search and My YouTube from `shared/`, entering ONLY through facades. Moving it to `app/` would break "features don't import app". A dedicated ESLint rule fences it in (eslint.config.js). |
| D11 | **`spawn_blocking` for everything heavy** | tokio's blocking pool has hundreds of threads: a long download doesn't freeze `analyze_urls`, login, etc. (download/commands.rs). |
