# Arquitectura real de Stash

Vertical slicing + screaming architecture en ambos lados. Regla de capas del frontend
(cabecera literal de `eslint.config.js`): `core ← shared ← features ← app ← main`.

## Árbol frontend (`src/`)

```
src/
├── main.ts                        # composition root: applyStaticI18n() + initShell() + init de cada slice
├── app/
│   └── shell.ts                   # titlebar, nav sidebar, TITLES/NAV, router{navigate,setBadge}, banner de sesión
├── core/                          # infra sin dominio (no importa nada de la app)
│   ├── bus/event-bus.ts           # bus tipado AppEvents (on/emit)
│   ├── i18n.ts                    # t(es,en), getLang/setLang, applyStaticI18n (data-en/-ph/-title)
│   ├── theme.ts                   # THEMES dark/light → CSS vars en <html>; localStorage 'stash-theme'
│   └── tauri/
│       ├── client.ts              # invoke + onEvent (única puerta real a @tauri-apps)
│       └── window.ts              # minimize/toggleMaximize/close
├── shared/
│   ├── lib/                       # puro, sin DOM: html.ts (esc), format.ts (fmtDuration/fmtSize/timeAgo/fmtDate)
│   └── ui/                        # dom.ts ($), icons.ts (I), toast, modal, controls, gradients,
│                                  # media-card, paged-loader, anchored-menu, dl-actions (excepción documentada)
├── styles/stash.css               # reset + fuentes + animaciones + .hov/.acc-btn/.view/.seg/.chips
└── features/
    ├── download/    index.ts · download.api.ts · download.types.ts · opts-model.ts(+test)
    │                └── ui/ descargar.ts (orquestador) · preview-render.ts · video-opts-modal.ts · recent-links.ts
    ├── preview/     index.ts · preview.api.ts · preview.types.ts        (sin ui: lo pinta download)
    ├── queue/       index.ts · queue.state.ts(+test, scheduler sin DOM) · ui/queue-view.ts
    ├── session/     index.ts · session.api.ts · session.state.ts · session.types.ts
    ├── library/     index.ts · library.api.ts · library.types.ts · ui/library-view.ts
    ├── settings/    index.ts · settings.api.ts · settings.types.ts · ui/settings-view.ts
    ├── setup/       index.ts · setup.api.ts · setup.types.ts · ui/onboarding.ts
    ├── search/      index.ts · ui/search-view.ts                        (sin api: usa la fachada de preview)
    └── youtube-account/ index.ts · ui/account-view.ts · ui/account-card.ts
```

## Árbol backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                        # Builder: manage(DownloadRegistry) + plugins + generate_handler! + kill_all al cerrar
├── core/                          # "Infraestructura transversal (sin dominio). Cada feature la consume."
│   ├── fsx.rs                     # write_atomic (tmp + rename)
│   ├── models.rs                  # ProgressData (evento download-progress)
│   ├── paths.rs                   # app_dir(dev/release), find_executable, has_binary
│   ├── process.rs                 # DownloadRegistry (Tauri State) + hide_console + kill_process
│   └── ytdlp.rs                   # YtdlpCmd (builder) + parse_percent + parse_field
└── features/                      # "Cada carpeta = una capacidad."
    ├── download/  commands · service · models          (service privado: `mod service;`)
    ├── library/   commands · service · models          (service privado)
    ├── preview/   commands · service · models          (service privado)
    ├── session/   commands · service · models · webview (service PÚBLICO: cookies para download/preview)
    ├── settings/  commands · service · models          (service PÚBLICO: carpeta de descargas para download/library)
    └── setup/     commands · service · models          (service privado)
```

## Anatomía canónica de un slice

**Frontend** (todo opcional salvo `index.ts`):

| Archivo | Rol | Regla |
|---|---|---|
| `index.ts` | Fachada pública | Lo ÚNICO importable desde fuera del slice |
| `{slice}.api.ts` | Puerta al backend | Único archivo del slice que puede usar `invoke`/`onEvent` |
| `{slice}.types.ts` | Tipos del contrato | Espejo TS de los modelos Rust |
| `{slice}.state.ts` / `opts-model.ts` | Estado y lógica SIN DOM | Testeable en entorno node; la vista se suscribe (`subscribe/notify` en queue) |
| `ui/*.ts` | Render + wiring DOM | Exporta `init{Name}()`; importa el state, nunca al revés |
| `*.test.ts` | Tests junto al código | Ver testing.md |

**Backend:**

| Archivo | Rol |
|---|---|
| `models.rs` | Structs serde del contrato (y agrupadores internos como `NewEntry`) |
| `service.rs` | Toda la lógica; `Result<T, String>` con mensajes en español; `#[cfg(test)] mod tests` al final |
| `commands.rs` | Wrappers `#[tauri::command]` finos: resolver `app_dir`, delegar, `spawn_blocking` si pesa |
| `mod.rs` | `pub mod commands; pub mod models; mod service;` — `pub mod service` SOLO si otro slice lo consume (session, settings) |

Cruces entre slices Rust existentes (los únicos): download/preview → `session::service` (cookies),
download/library → `settings::service` (carpeta). Todo lo demás comparte por `core::*`.

## Reglas de import (impuestas por `eslint.config.js`)

| Desde | PERMITIDO hacia | PROHIBIDO |
|---|---|---|
| `core` | (nada de la app) | todo lo demás |
| `shared` | `core`, `shared` | `features`, `app` (excepción: `dl-actions.ts` → `features/*/index.ts`) |
| `features` | `core`, `shared`, su propio slice, `features/*/index.ts` ajenos | internos de otro slice, `app`, `main` |
| `app` | `core`, `shared`, `app`, `features/*/index.ts` | internos de slices |
| `main` | `core`, `shared`, `app`, `features/*/index.ts` | — |

Mensajes literales del lint: *"De otro feature solo puede importarse su index.ts (fachada pública)"*,
*"El acceso a Tauri va encapsulado: usa el *.api.ts del slice (o core/tauri/*)"*,
*"invoke/onEvent solo se consumen desde los *.api.ts de cada slice"*.
Además: `no-floating-promises: error` y `_` como prefijo de parámetros sin usar.

## Composition roots

- **FE `main.ts`** (orden real): `applyStaticI18n()` → `initShell()` → `void initSession()` →
  `initQueueView()` → `initDescargar()` → `initSearch()` → `initAccount()` → `initLibrary()` →
  `void initSettings()` → `void initOnboarding()`. Los init async van con `void`.
- **BE `main.rs`**: `.manage(DownloadRegistry::default())` → plugins (dialog/shell/fs) →
  `generate_handler![...]` (20 comandos) → `on_window_event`: al destruirse `main`, `kill_all()`
  (no dejar yt-dlp/ffmpeg huérfanos).

## Event bus (tabla real)

| Evento | Payload | Emisor(es) | Oyente(s) |
|---|---|---|---|
| `session:expired` | void | session.state (refreshSession) | shell (muestra banner) |
| `session:connected` | void | session.state | shell (oculta banner) |
| `session:changed` | void | session.state (refresh/doLogout) | account-view (repinta tarjeta/grid) |
| `theme:changed` | void | shell (toggle), settings-view | shell (repinta icono sol/luna) |
| `nav:changed` | `{view}` | shell.navigate | descargar, library-view, search-view, account-view (refresco al entrar) |
| `nav:goto` | `{view}` | descargar, dl-actions | shell (navega) |
| `download:completed` | `{url,title,format,videoId?}` | queue.state | descargar (marca "ya descargado"), library-view (recarga) |
| `queue:count` | `{active}` | queue.state (emitCount) | shell (badge de la cola) |
| `descargar:prefill` | `{urls}` | dl-actions | descargar (rellena textarea + analiza) |

## Decision Log

| # | Decisión | Por qué (razonamiento real del código) |
|---|---|---|
| D1 | **Bus tipado en vez de imports cruzados** | "Desacopla slices: un slice emite y otros reaccionan sin importarse entre sí. Corta ciclos preview↔queue↔session" (event-bus.ts). También evita `features → app`: navegar es `nav:goto`. |
| D2 | **DownloadRegistry como Tauri State (no statics)** | Sustituye 3 statics con doble contabilidad. Cierra la race cancel/spawn: `cancel()` marca+mata y `set_pid()` mata si ya estaba cancelado, todo bajo EL MISMO lock — "o el cancel ve el PID, o el spawn ve el cancel" (core/process.rs). |
| D3 | **`error_kind: Option<String>` ("auth"\|"cache"\|"other") en vez de thiserror/enums** | A esta escala hay UN consumidor (la cola) que ramifica en 3 casos, y el error viaja como String al frontend igualmente. `preview/service.rs` deja un TODO explícito: unificar en `{message, kind}` SOLO cuando el frontend de preview ramifique por kind. |
| D4 | **Avatar como data URL base64** | El webview no puede cargar `yt3.ggpht.com` por su cuenta (origen/referer); el backend descarga la imagen y la inyecta como `data:` con fallback a la URL cruda (session/service.rs). |
| D5 | **Versiones de dependencias FIJADAS** | yt-dlp `2026.03.17`, deno `v2.9.1`, ffmpeg serie 7.1 — tags concretos, no `releases/latest`: "que la app no se rompa si una versión nueva cambia el comportamiento sin haberla probado. Actualizar deliberadamente" (setup/service.rs). |
| D6 | **`--encoding utf-8` SIEMPRE (en `YtdlpCmd::build()`)** | El exe de yt-dlp, al escribir a una tubería en Windows, descarta caracteres fuera de la página de códigos (títulos en japonés): las rutas/JSON llegarían degradados y no coincidirían con los archivos reales (core/ytdlp.rs). |
| D7 | **Cookies solo de `youtube.com` en el header de account_menu** | Mezclar las de google.com hace que YouTube degrade la respuesta: a veces sin foto, a veces sin cuenta — "verificado empíricamente" (session/service.rs). Ojo: la VALIDACIÓN de sesión también exige la auth en `.youtube.com` (exports del navegador traen SAPISID solo en `.google.com`). |
| D8 | **Historial en JSON (tope 500) con `write_atomic`** | Escala doméstica; tmp+rename garantiza que un corte nunca deja el JSON a medias. SQLite solo si crece. |
| D9 | **Sin framework: innerHTML + rebind, estilos inline con CSS vars** | La paleta entera vive en `core/theme.ts` como CSS vars; cambiar de tema no repinta componentes. Sin estado reactivo: cada vista repinta su lista y recablea con `data-*`. |
| D10 | **`dl-actions.ts` como deuda aceptada** | Comparte el flujo de descarga entre Buscar y Mi YouTube desde `shared/`, entrando SOLO por fachadas. Moverlo a `app/` rompería "features no importan app". Regla ESLint específica lo acota (eslint.config.js). |
| D11 | **`spawn_blocking` para todo lo pesado** | El pool bloqueante de tokio tiene cientos de hilos: una descarga larga no congela `analyze_urls`, login, etc. (download/commands.rs). |
