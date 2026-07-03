---
name: stash-feature-generator
description: >
  Genera código nuevo en Stash (Tauri 2 + TS vanilla, vertical slices) siguiendo
  la arquitectura y convenciones REALES del repo. Usar cuando se pida una
  "nueva feature", "nuevo comando" (Tauri), "nueva vista", "añadir sección",
  "nuevo evento", "generate module", "add command/view/feature/slice", o
  cualquier cambio que cruce la frontera frontend↔backend.
---

# Stash Feature Generator

Examples > prose: cada patrón de abajo existe en el código; copia el ejemplo citado en vez de inventar. Español en textos de UI y mensajes de error; inglés en código y nombres de archivo.

## Referencias

| Archivo | Cuándo leerlo |
|---|---|
| `references/architecture.md` | Antes de crear un slice o mover código entre capas. Árboles reales, reglas ESLint, bus, decision log. |
| `references/tauri-commands.md` | Antes de tocar un comando o evento Tauri. Tabla completa del contrato FE↔BE, serde, spawn_blocking, YtdlpCmd. |
| `references/ui-patterns.md` | Antes de escribir cualquier vista o componente. innerHTML+rebind, componentes shared, prefijos de ids, CSS vars. |
| `references/error-handling.md` | Errores, toasts, `error_kind`, flujo de auth en la cola. |
| `references/i18n.md` | Cualquier texto visible nuevo. |
| `references/conventions.md` | Naming, commits, fachadas, estilo de tests. |
| `references/testing.md` | Antes de escribir tests (qué testear y con qué patrones). |

## Workflow A — Nuevo comando Tauri

Cadena completa (mirar `library` o `settings` como slice modelo):

1. **`src-tauri/src/features/{slice}/models.rs`** — struct de entrada/salida. Structs NUEVOS siempre con:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")]
   pub struct {Thing} { pub file_path: Option<String>, /* llega como filePath */ }
   ```
2. **`service.rs`** — TODA la lógica. Firma típica: `pub fn {verb}(app_dir: &Path, ...) -> Result<{Thing}, String>` con mensajes en español (`format!("No se pudo …: {}", e)`). Sin `tauri::` salvo `AppHandle` si emite eventos.
3. **`commands.rs`** — wrapper FINO:
   ```rust
   #[tauri::command]
   pub fn {verb}_{noun}(app: AppHandle, {arg}: String) -> Result<{Thing}, String> {
       let app_dir = paths::app_dir(&app);
       service::{verb}(&app_dir, &{arg})
   }
   ```
   Si el trabajo es pesado (proceso externo, `reqwest::blocking`, papelera/COM): `async fn` + `tauri::async_runtime::spawn_blocking` — copia el patrón y el comentario de `download/commands.rs::start_download` o `library/commands.rs::delete_history_file`.
4. **`main.rs`** — añadir `{slice}::commands::{verb}_{noun}` al `tauri::generate_handler![…]`.
5. **`src/features/{slice}/{slice}.api.ts`** — único sitio donde se puede llamar `invoke` (el lint lo impone):
   ```ts
   export function {verbNoun}({arg}: string): Promise<{Thing}> {
     return invoke<{Thing}>('{verb}_{noun}', { {arg} });
   }
   ```
   Args planos en camelCase: Tauri los mapea solo a snake_case (`videoId` → `video_id`).
6. **`{slice}.types.ts`** — espejo TS del modelo, camelCase.
7. **`index.ts`** — exportar el wrapper SOLO si otro slice/app lo necesita.
8. Verificar (checklist final).

## Workflow B — Nueva vista/sección

1. **`index.html`** — `<section class="view" data-view="{id}">` dentro de `<main>`. Todos los ids con prefijo propio (`{pfx}-…`, ver tabla en ui-patterns). Textos estáticos en español + `data-en` / `data-en-ph` / `data-en-title` con el inglés.
2. **`src/app/shell.ts`** — añadir el id al union `ViewId`, una entrada en `TITLES` (con `t(es, en)`) y otra en `NAV` (icono del registro `I` a 18px).
3. **Slice** `src/features/{slice}/ui/{slice}-view.ts` exportando `init{Name}(): void` — el wiring de botones estáticos se hace UNA vez en init; las listas se repintan con innerHTML + rebind (ver ui-patterns).
4. **`index.ts`** del slice exporta `init{Name}`.
5. **`src/main.ts`** — llamar `init{Name}()` (con `void` delante si es async: `no-floating-promises` es error).
6. Refresco al entrar en la vista: `bus.on('nav:changed', ({ view }) => { if (view !== '{id}') return; … })` (patrón de `library-view.ts` / `descargar.ts`).

La vista NO importa nada de `app/`: para navegar emite `bus.emit('nav:goto', { view: '…' })`.

## Workflow C — Nuevo evento

| Caso | Mecanismo |
|---|---|
| Slice FE → otros slices FE / shell | Bus tipado (`core/bus/event-bus.ts`) |
| Backend Rust → frontend | Evento Tauri + wrapper en `{slice}.api.ts` |

**Bus:** añadir la clave a `AppEvents` (nombre `dominio:accion`, ej. `download:completed`), con payload tipado o `void`. Emisor: `bus.emit(...)`; oyentes: `bus.on(...)`. Nunca strings sueltos fuera de esa interfaz.

**Tauri:** nombre en kebab-case (`download-progress`). El payload es SIEMPRE un struct serde (`preview-progress` usa tupla `(done, total)` — legado, NO imitar). En Rust: `app.emit("{event-name}", {Payload} { … })`. En el api.ts:
```ts
export function on{X}(cb: (data: {Payload}) => void): Promise<UnlistenFn> {
  return onEvent<{Payload}>('{event-name}', cb);
}
```
El consumidor guarda el unlisten y lo libera (`descargar.ts::analyze`: `const unlisten = await onPreviewProgress(…)` … `finally { unlisten(); }`).

## Workflow D — ¿Dónde vive la lógica compartida?

| La lógica… | Va en |
|---|---|
| Toca DOM y es genérica (tarjetas, menús, chips, toasts) | `shared/ui/` |
| Es pura, sin DOM (formateo, escape, hashes) | `shared/lib/` |
| Tiene dominio de UN slice (mapeos de opciones, estado de cola…) | El slice dueño; se comparte exportándola por su `index.ts` |
| Orquesta VARIOS slices para vistas | Excepción única ya existente: `shared/ui/dl-actions.ts` (deuda documentada en eslint.config.js). NO crear más; valorar un evento de bus. |

## Checklist final de validación

```
npm run check        # tsc --noEmit + eslint src + cargo check
npm run check:rust   # cargo check + cargo clippy -- -D warnings
npm test             # vitest run (proyectos node + jsdom)
cd src-tauri && cargo test
```
- [ ] Textos nuevos con `t(es, en)` (dinámicos) o `data-en` (estáticos).
- [ ] Todo dato dinámico interpolado en innerHTML pasa por `esc()`.
- [ ] Comando nuevo registrado en `generate_handler!` y con wrapper en su `.api.ts`.
- [ ] Ids DOM nuevos con el prefijo de su vista.

## DO NOT

**El lint ya lo caza** (no pierdas tiempo intentándolo):
- Importar `@tauri-apps/*` o `core/tauri/client` fuera de `*.api.ts` / `core/tauri/*`.
- Importar internos de otro slice (solo su `index.ts`).
- `features` → `app`, `shared` → `features` (salvo dl-actions), `core` → cualquiera.
- Promesas sueltas en handlers (`no-floating-promises`).

**El lint NO lo caza** (disciplina manual):
- Interpolar strings en innerHTML sin `esc()`.
- Payloads de eventos Tauri como tuplas o valores pelados nuevos.
- Structs serde nuevos sin `rename_all = "camelCase"` — y al revés: "arreglar" los legados snake_case (`AppConfig`, `VideoMeta`) sin plan de migración.
- `Record`s con textos traducidos como valores estáticos (usar getters; ver i18n.md).
- `addEventListener` dentro de un `paint()` que se re-ejecuta (acumula listeners; usar `.onclick`, ver `video-opts-modal.ts`).
- Lógica de dominio en `commands.rs` (va en `service.rs`).
- Trabajo bloqueante en un command async sin `spawn_blocking`.
- Claves de localStorage fuera del prefijo `stash.` (nuevas).
- Invocar yt-dlp con `Command::new` a mano: usar el builder `YtdlpCmd` (garantiza `--encoding utf-8` y `-- <url>`).
- Procesos cancelables sin registrarlos en `DownloadRegistry`.
- Persistir JSON con `fs::write` directo: usar `core::fsx::write_atomic`.
