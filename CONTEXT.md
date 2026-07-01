# CONTEXT — YouTube Downloader → "Stash"

> **Documento vivo y fuente de verdad del proyecto.** Léelo antes de tocar código.
> Se actualiza: §6 al cambiar un comando/evento, §10 al tomar una decisión, §8 y §12 al cerrar cada fase.
> Diseño de referencia: [DESIGN-BRIEF.md](DESIGN-BRIEF.md) · diseño visual en Claude Design (proyecto "YouTube Downloader Redesign", archivo `Stash.dc.html`).

---

## 1. Visión

Convertir un descargador básico de 2 pasos en **"Stash"**: una app de escritorio completa para YouTube con **sesión real de la cuenta**, **preview de lo que se va a descargar** (miniatura, canal, duración, disponibilidad, tamaño estimado), **opciones plenas** (calidad / solo-audio / subtítulos / contenedor), y **cola + biblioteca** modernas, bajo una UI con **sidebar** y secciones.

**Regla de oro:** en cada fase la app debe **compilar (`tsc` + `cargo`) y arrancar (`tauri`)**; nunca se rompen setup, cookies ni descarga. Migración incremental, un slice a la vez.

**Marca/estilo:** acento **`#7C6BF0`** (violeta) — NO el naranja del mockup ni el `#7c3aed` actual. Tema oscuro + claro con toggle. Idioma UI: **español**.

---

## 2. Estado actual (auditoría del repo)

**Backend (`src-tauri/src/`)** — organizado por CAPA (`commands/`, `services/`, `models/`):
- Comandos: `check_cookies`, `load_cookies`, `open_youtube_login`, `open_downloads_folder`, `get/set_download_folder`, `start_download`, `cancel_download`, `check_dependencies`, `download_dependencies`.
- Descarga (`download_service.rs`): formato **fijo** `bestvideo[ext=mp4]+bestaudio[ext=m4a]/best`, merge MP4, plantilla `-o` **hardcodeada**. Progreso parseado de stdout; estado `processing` al detectar `[Merger]`; cancelar por PID (`taskkill`/`kill`); **sin evento de 100%** (se infiere por exit code). Concurrencia gestionada en el **frontend**.
- Cookies/login (`cookies.rs`, `cookie_service.rs`): WebView extrae cookies (incl. HttpOnly) → `cookies.txt`; emite `cookies-extracted`.
- Config (`config_service.rs`): solo `download_folder` en `config.json`.
- Setup (`setup_service.rs`): descarga yt-dlp+ffmpeg+deno, emite `setup-progress`.
- **Duplicación**: `app_dir` y `find_executable` repetidos; args de yt-dlp incrustados; `ACTIVE_PROCESSES` como `static Mutex`.

**Frontend (`src/`)** — TS vanilla + Vite, **sin router ni secciones**. Página única de 2 pasos. Componentes capturan `getElementById` a nivel de módulo (no reinstanciables). `services/tauri-api.ts` mezcla dominios. Cola **solo en memoria** (se pierde al recargar). CSS único (~776 líneas), tema oscuro fijo, acento `#7c3aed`. SVGs inline duplicados (~6×). Ventana **fija 780×700, no redimensionable**.

---

## 3. Arquitectura objetivo — principios

- **Screaming architecture**: el primer nivel de `features/` **grita el dominio** (download, preview, queue…), no el framework.
- **Vertical slice**: cada feature es una rebanada autocontenida (UI + estado + lógica + acceso backend). Se comunica con otras solo por su **API pública** (`index.ts` / `mod.rs`).
- **`core/`** = infraestructura transversal sin dominio. **`shared/`** = UI/utilidades reutilizables (solo front).
- **Dirección de dependencias**: `core` ← `shared` ← `features` ← `app/main`. Nunca al revés. Un slice **no** importa internos de otro.

---

## 4. Arquitectura Frontend (`src/`)

```
src/
├── main.ts                      # composition root: estilos + tema + setup.whenReady() + app-shell
├── app/                         # shell (no es dominio)
│   ├── app-shell.ts             # sidebar + <main data-outlet> + toast-host
│   ├── router.ts / routes.ts    # hash router; Section -> factory (lazy import)
│   ├── sidebar/                 # nav 5 secciones
│   └── session-banner.ts        # banner global "sesión caducada"
├── core/                        # infra sin dominio (no importa shared/features)
│   ├── tauri/{client,events,event-map}.ts   # invoke tipado + bus tipado sobre listen()
│   ├── store/{store,computed}.ts            # createStore<T>(): observable mínimo
│   ├── ui/{component,dom,lifecycle}.ts       # defineComponent / el() / onCleanup
│   ├── bus/event-bus.ts         # pub/sub in-app tipado (desacopla slices)
│   └── result.ts                # Result<T,E> / AppError
├── shared/                      # design system reutilizable (no importa features)
│   ├── ui/                      # button, modal, toast, badge, thumbnail, avatar, icon(registry), skeleton…
│   ├── styles/{tokens,themes,base,index}.css
│   └── format/{duration,bytes,date,count}.ts
└── features/                    # EL DOMINIO
    ├── setup/          # [HOY] onboarding/deps
    ├── session/        # [HOY+] cookies/login/estado (getCookieMode, sessionStore)
    ├── preview/        # [NUEVO] pegar URLs -> metadatos -> tarjetas + playlists
    ├── download-options/ # [MIX] panel calidad/audio/subs/plantilla/carpeta (optionsStore)
    ├── queue/          # [MIX] scheduler concurrencia + items + reordenar/pausar
    ├── youtube-account/# [NUEVO] avatar + listas + membresías
    ├── library/        # [NUEVO] historial/biblioteca
    └── settings/       # [MIX] tema + defaults + componentes
```

**Contrato por slice:** `ui/` (render+eventos DOM) · `model/*.store.ts` (estado+lógica, no toca `invoke`) · `<slice>.api.ts` (única puerta al backend) · `<slice>.types.ts` · `index.ts` (public API).

**Comunicación entre slices:**
- **Import de public API** cuando la relación es dirigida y estable (ej. `queue` usa `session.getCookieMode()` y `download-options.optionsStore`). Si A→B, B no importa A.
- **Event bus (`core/bus`)** para fan-out/desacople: `session:expired`, `preview:enqueue-requested(items,options)`, `download:completed(item)`. Corta ciclos preview↔queue↔session.
- **Stores como solo-lectura** cross-slice: solo el dueño muta.

**Patrones (vanilla, sin framework):** `createStore<T>()` observable; `defineComponent(props,ctx)` con `onCleanup` (montable/desmontable al navegar); `router` hash con lazy import y `destroy()` al salir. Estado que sobrevive a navegación vive en stores singleton, no en la vista. "Descargar" es una **vista compuesta** (preview + download-options) montada en `app/`.

**Enforcement:** alias `@core/@shared/@features/@app` + `eslint-plugin-boundaries` (imports solo "hacia abajo"; fuera de un slice solo su `index.ts`).

---

## 5. Arquitectura Backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                      # Builder: manage(state) + invoke_handler (agrega handlers de cada feature)
├── core/                        # infraestructura transversal (NO grita dominio)
│   ├── paths.rs                 # app_dir() dev/prod + find_executable() (unifica duplicados)
│   ├── ytdlp/{runner,json,progress}.rs  # spawn+flags comunes (deno/ffmpeg/cookies/--no-update); parse -J; parse progreso
│   ├── process/registry.rs      # ProcessRegistry (generaliza ACTIVE_PROCESSES): kill/kill_all por TaskId
│   ├── events.rs                # nombres de eventos como constantes + emit tipado
│   ├── persistence.rs           # load/save<T> JSON atómico (tmp+rename)
│   ├── error.rs                 # AppError -> String
│   └── models.rs                # tipos compartidos (Availability, ThumbnailSet, ProgressData…)
└── features/
    ├── setup/       # check_dependencies, download_dependencies
    ├── session/     # check_cookies, load_cookies, open_youtube_login, logout, get_session_status (+ webview.rs)
    ├── preview/     # analyze_urls, get_video_metadata, list_formats, estimate_size, expand_playlist (+ mapper.rs)
    ├── download/    # start_download, cancel_download (+ options.rs -> to_ytdlp_args)
    ├── queue/       # enqueue, get_queue, pause/resume, reorder, set_priority, set_concurrency, retry/remove (state.rs = managed)
    ├── youtube_account/ # get_account_info, list_subscriptions/watch_later/liked/playlists/memberships
    ├── library/     # get_history, search_library, remove_history_item, open_file (store.rs -> history.json/sqlite)
    └── settings/    # get/set_settings, get/set_download_folder, open_downloads_folder (AppConfig ampliado)
```

**Reglas:** `features/*` → `core/*` (nunca al revés). `queue` puede depender de `download::{service,options}` (orquesta descargas). El resto de features comparten tipos por `core::models`, no se importan entre sí. `main.rs` usa `tauri::State<Arc<Mutex<…>>>` (managed state) en vez de `static Mutex`.

---

## 6. Contratos: comandos y eventos

### Comandos (● existe · ◆ cambia · ✦ nuevo)
- ● setup: `check_dependencies() -> DependencyStatus`, `download_dependencies()`
- ● session: `check_cookies() -> CookieResult`, `load_cookies(path)`, `open_youtube_login()`; ✦ `get_session_status() -> SessionStatus`, `logout()`
- ✦ preview: `analyze_urls(urls) -> Vec<AnalyzedEntry>`, `get_video_metadata(url) -> VideoMeta`, `expand_playlist(url,range?) -> PlaylistMeta`, `list_formats(url) -> Vec<FormatInfo>`, `estimate_size(url,options) -> SizeEstimate`
- ◆ download: `start_download(url, options: DownloadOptions) -> DownloadResult` (antes `cookie_mode`); ● `cancel_download(url?)`
- ✦ queue: `enqueue(items)`, `get_queue()`, `pause_download(id)`, `resume_download(id)`, `reorder_queue(ids)`, `set_priority(id,p)`, `set_concurrency(n)`, `retry_item(id)`, `remove_item(id)`
- ✦ youtube_account: `get_account_info()`, `list_subscriptions()`, `list_watch_later()`, `list_liked()`, `list_account_playlists()`, `list_memberships()`
- ✦ library: `get_history(query?)`, `search_library(q)`, `remove_history_item(id)`, `open_file(path)`
- ◆ settings: `get_settings() -> AppConfig`, `set_settings(cfg)`; ● `get/set_download_folder`, `open_downloads_folder`

### Eventos
- ● `download-progress` (◆ añadir `item_id`), `cookies-extracted`, `setup-progress`
- ✦ `download-completed{item_id,file_path,video_id}`, `download-failed{item_id,error}`, `download-cancelled{item_id}`, `queue-updated{snapshot}`, `preview-progress{done,total}`, `account-updated{info}`

---

## 7. Modelo de descarga (`DownloadOptions`)

```rust
struct DownloadOptions {
  mode: DownloadMode,            // Video | AudioOnly
  quality: VideoQuality,         // Auto | Max | P2160 | P1440 | P1080 | P720 | P480 | P360
  container: Container,          // Mp4 | Mkv | Webm
  audio_format: Option<AudioFormat>,  // Mp3 | M4a | Opus
  audio_bitrate: Option<u32>,    // kbps
  subtitles: SubtitleOptions,    // {enabled, langs, auto_generated, embed}
  embed_thumbnail/metadata/chapters: bool,
  sponsorblock: SponsorBlockMode,// Off | Mark | Remove
  trim: Option<TimeRange>,       // download-sections
  playlist_range: Option<String>,// --playlist-items "1-10,15"
  output_template: Option<String>,
  cookie_mode: CookieMode,       // None | File
}
```
`to_ytdlp_args()` centraliza la traducción (hoy hardcodeada en `download_service.rs:88`). El `runner` añade lo transversal (`--ffmpeg-location`, `--extractor-args deno`, `--no-update`, `--newline --progress`, `--cookies`, `--continue` al reanudar).

---

## 8. Roadmap por fases

| Fase | Objetivo | Entregables clave | Esfuerzo | Estado |
|---|---|---|---|---|
| **0 · Fundación** | Nueva cáscara sin romper nada | Refactor a vertical-slice (FE+BE core/), router+sidebar 5 secciones, **design tokens `#7C6BF0`** + tema claro/oscuro, ventana redimensionable + titlebar custom, toasts | L | 🟡 En curso |
| **1 · Paridad** | Cablear lo existente en la UI nueva | Descargar (URLs+carpeta), Cola (migrar scheduler), Mi YouTube mínima (login + **arreglar botón colgado**), Ajustes mínima (carpeta/concurrencia/tema) | M | ⬜ Pendiente |
| **2 · Preview** | "Ver antes de descargar" | `analyze_urls`/`get_video_metadata` (`--dump-json`/`--flat-playlist`), tarjetas + badges disponibilidad + tamaño estimado, playlists expandibles, selección | L | ⬜ Pendiente |
| **3 · Opciones** | Control pleno de formato | `DownloadOptions` + `to_ytdlp_args`, `list_formats`, panel calidad/audio/subs/contenedor/plantilla + override por-video | L | ⬜ Pendiente |
| **4 · Biblioteca** | Historial persistente + duplicados | Persistencia (JSON→SQLite), evento `download-completed`, sección biblioteca (buscar/abrir/borrar), marcar "ya descargado" | L | ⬜ Pendiente |
| **5 · Cola avanzada** | Gestión rica y resiliente | Pausar/reanudar (kill+`--continue`), reordenar/prioridad, persistir cola, (opc.) concurrencia en Rust | M/L | ⬜ Pendiente |
| **6 · Mi YouTube** | Explorar/descargar desde la cuenta | `get_account_info` (avatar/handle), listas (`:ytsubs`/`:ytwatchlater`/`:ytfav`/playlists), membresías, banner reconexión | L (riesgo alto) | ⬜ Pendiente |
| **7 · Ajustes + pulido** | Cerrar producto | `AppConfig` ampliado, "actualizar componentes" (`yt-dlp -U`), notificaciones escritorio, onboarding rediseñado, skeletons/motion | M | ⬜ Pendiente |

**Dependencias:** 0 → 1 → **2 (palanca central)** → {3, 4, 6}; 4 → 5; 7 consume defaults de 3–5.
- Chips de calidad reales dependen de `list_formats` (F3). Duplicados en preview dependen de biblioteca (F4). Mi YouTube (F6) depende de login (F1) + preview (F2).

---

## 9. Feasibilidad (resumen)

**v1 (viable, bajo riesgo):** metadatos (`-J`), formatos, tamaño estimado (`filesize_approx`/`tbr×dur`), disponibilidad (`availability` + parseo de `ERROR:`), calidad (`-f`), audio (`-x`), contenedor (`--merge-output-format`), subtítulos (`--write/embed-subs`), embeds, SponsorBlock, recorte (`--download-sections`), rango (`--playlist-items`), plantilla (`-o`), historial (JSON), ajustes.

**Riesgo alto / v2:** **pausa real** (yt-dlp no pausa; kill+`--continue` falla en merge/HLS) · **cuenta** (alias `:ytsubs`… frágiles, cambian sin aviso; membresías lo peor). Enfoque recomendado cuenta: **cookies+yt-dlp** (cero fricción) con degradado elegante; OAuth/Data API como opción v2.

---

## 10. Decisiones (ADR ligero)

Formato: `#· fecha · decisión · estado`. Estados: propuesta / aceptada / revertida.

1. 2026-06-30 · **Acento `#7C6BF0`** (violeta), no el naranja del mockup. · **aceptada** (usuario).
2. 2026-06-30 · **Vertical slice + screaming architecture** en FE y BE. · **aceptada** (usuario).
3. 2026-06-30 · Mantener **vanilla TS sin framework** (mini-runtime en `core/ui`). · propuesta.
4. 2026-06-30 · Ventana **redimensionable + titlebar custom** (abandonar 780×700 fijo). · **aceptada** (usuario). Implementado en Fase 0: `1100×760`, min `940×640`, `decorations:false` + permisos `core:window:*`.
5. 2026-06-30 · **Cuenta vía cookies+yt-dlp** (no OAuth) en v1, con degradado. · propuesta — requiere confirmación.
6. 2026-06-30 · **Historial: JSON primero**, migrar a SQLite si crece. · propuesta — requiere confirmación.
7. 2026-06-30 · **Pausa = kill + `--continue`** (best-effort en v1). · propuesta — requiere confirmación.
8. 2026-06-30 · Añadir **evento `download-completed`** explícito (para biblioteca/notif.). · propuesta.

**Decisiones a resolver antes de F4/F6:** #5 (cuenta), #6 (storage), #4 (ventana), #7 (pausa).

---

## 11. Convenciones

- Idioma UI: español. Commits: `tipo: descripción` (feat/fix/refactor/chore).
- Rama de trabajo: `dev`. Compat: `start_download` acepta `options` (no romper cola en cada fase).
- **Añadir un comando Tauri:** definir en `features/<f>/commands.rs`, registrar en `main.rs`, exponer wrapper en `features/<f>/<f>.api.ts`, tipos en ambos lados.
- **Añadir una sección:** crear slice `features/<f>/` + entrada en `app/routes.ts` + item en sidebar.
- Estilos: solo tokens semánticos (`--color-accent`, `--bg-surface`), nunca hex ni primitivos en componentes.
- Naming de eventos: definidos en `core/tauri/event-map.ts` (FE) y `core/events.rs` (BE); ningún slice inventa strings sueltos.

---

## 12. Changelog

Entradas por fecha/fase: qué cambió y **por qué** (complementa git, no lo repite).

- **2026-06-30** — Creado `CONTEXT.md`. Planificación con 3 agentes (arquitectura FE, BE+factibilidad, roadmap). Definida arquitectura vertical-slice/screaming para FE y BE, contratos de comandos/eventos, `DownloadOptions`, y roadmap de 8 fases. Acento fijado en `#7C6BF0`.
- **2026-06-30 · Fase 0 (en curso)** — Fundación del shell:
  - Ventana redimensionable + **titlebar custom** (`decorations:false`, `1100×760`) + permisos `core:window:*`.
  - **Design tokens** `src/shared/styles/{tokens,base,shell,index}.css` con acento `#7C6BF0` y **tema claro/oscuro** (`[data-theme]`, persistido en localStorage). app.css se conserva y hereda los tokens (se carga antes de index.css).
  - `src/core/` (store observable, event-bus tipado, control de ventana) y `src/app/` (icons, theme, router de 5 secciones, shell wiring).
  - `index.html` reescrito como shell (titlebar + sidebar + outlet con 5 vistas). Paneles existentes (cookie/download/queue) migrados dentro de las vistas **conservando sus IDs** → setup, cookies y descarga siguen funcionando. Al pulsar Descargar salta a la vista Cola.
  - Build verificado: `npm run build` ✓ y `cargo check` ✓.
  - **Pendiente de Fase 0**: toasts, refactor del backend a `core/` + `features/`, migrar los componentes FE actuales a `features/*` (se hará al entrar en Fase 1). Nota: el overlay de setup cubre la titlebar durante el primer arranque (menor; revisar).
- _(próxima entrada al cerrar Fase 0 / iniciar Fase 1)_
