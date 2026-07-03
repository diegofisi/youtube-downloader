# Manejo de errores

## Rust: `Result<T, String>` con mensajes en español

No hay thiserror ni tipos de error propios: los services devuelven `Result<T, String>` y el
mensaje llega tal cual al frontend (es texto para el usuario, no para logs):

```rust
fsx::write_atomic(&path, content).map_err(|e| format!("No se pudo escribir {…}: {}", e))?;
```

Convenciones del mensaje: empieza por "No se pudo …" / "Error …", incluye el detalle `{}` del
error original, y si hay acción posible la sugiere ("Verifica que la configuración inicial se
completó correctamente.").

## `error_kind`: clasificación de fallos de descarga

`DownloadResult` lleva `errorKind?: 'auth' | 'cache' | 'other'` (serde `rename = "errorKind"`).
La clasificación vive en `download/service.rs::classify_error` sobre el texto de `ERROR:` de yt-dlp:

| kind | Patrones (lowercase) | Reacción |
|---|---|---|
| `auth` | "sign in to confirm", "members-only", "cookies are no longer valid", "please sign in", "not a bot", "http error 401" | Mensaje fijo `AUTH_ERROR_MSG` + flujo de auth de la cola (abajo). `auth` tiene prioridad sobre `cache`. |
| `cache` | "http error 403", "forbidden", fragment+403 | El BACKEND limpia el cache de yt-dlp (`--rm-cache-dir`) y reintenta UNA vez, consultando `is_cancelled` antes del respawn |
| `other` / None | resto | Error normal: el item queda `error` con su mensaje |

Del lado stderr solo cuentan las líneas `ERROR:` (el resto es ruido). En preview hay un TODO
explícito para clasificar auth también ahí — NO cambiar ese contrato hasta que el frontend ramifique.

## Flujo completo de auth en la cola (queue.state.ts)

Cuando `startDownload` resuelve con `errorKind === 'auth'`:

1. El item fallido pasa a `paused` con `pausedByAuth = true` (no `error`: "para no quemar el
   resto de la tanda").
2. TODOS los items `queued` pasan también a `paused` + `pausedByAuth`.
3. `handleAuthFailure()` (single-flight con `authReconnectInFlight`) llama a
   `attemptSilentReconnect()` (session): ventana oculta de login pasivo, ~20 s de timeout.
4. Si reconecta: toast "Sesión renovada" y los `paused && pausedByAuth` vuelven a `queued`
   (+ `pump()`); si no: toast warn "Tu sesión de YouTube caducó — Reconecta en Mi YouTube".
5. En paralelo, `session:expired` (del bus) hace aparecer el banner del shell con botón "Reconectar".

Al añadir estados/acciones a la cola, preservar esta semántica: `pause` cancela el proceso pero
conserva el progreso (yt-dlp retoma el `.part`); `retry` resetea `progress = 0`.

## Toasts: título corto + detalle + kind

`showToast(title, body, kind)` — título de 2-4 palabras, detalle opcional en body, kind semántico:

```ts
showToast(t('Añadido a la cola', 'Added to queue'), it.title, 'done');
showToast(t('Sin enlaces', 'No links'), t('Pega al menos un enlace…', 'Paste at least…'), 'warn');
showToast(t('No se pudieron cargar más', 'Could not load more'), String(e), 'error');
```

`error` = falló algo que el usuario pidió; `warn` = precondición/aviso; `info` = FYI; `done` = éxito.
Errores en medio de un panel (no transitorios) se pintan además en el propio panel
(settings-view: el error de reparación queda visible en `#fix-progress`).

## Degradación silenciosa: SOLO cosmética

`.catch(() => {})` / `catch { /* noop */ }` se permiten únicamente cuando el fallo no bloquea el
flujo principal y hay fallback visual:

- `getHistory().catch(() => [])` — sin historial, la preview no marca duplicados (nada más).
- `getSettings().catch(() => null)` / `paintFolder().catch(() => {})` — se quedan los defaults.
- addHistory tras una descarga OK: "La descarga terminó bien; si el historial falla, no rompemos el flujo".
- `img.onerror` del avatar → letra "A" de fallback.

Si el usuario pidió la acción explícitamente, NUNCA tragarse el error: toast o mensaje en panel.

## Rust: `.ok()` para efectos secundarios

Mismo criterio en Rust — `.ok()` solo en efectos cuyo fallo no cambia el resultado:
`fs::create_dir_all(&dir).ok()`, `ww.close().ok()`, `existing.set_focus().ok()`,
`cmd.spawn().ok()` en `kill_process`, `fs::remove_file(&zip_path).ok()`.
Con logging cuando aporta diagnóstico: `println!("[download] …")` / `eprintln!` con prefijo
`[slice]` (`[download]`, `[login]`, `[silent-login]`, `[library]`).

Nunca `.unwrap()`/`.expect()` en rutas alcanzables en runtime (la excepción documentada:
`paths::app_dir` en release cae a temp con `eprintln!` en vez de panicar).

## Frontend: dónde se captura

- Las vistas capturan en el borde del handler (`try/catch` en `analyze()`, `.catch(...)` en clicks).
- `queue.state::run()` tiene un `.catch` final que marca `error` con
  `t('Error interno', 'Internal error')` — un rechazo inesperado nunca cuelga el scheduler.
- El lint (`no-floating-promises`) obliga a decidir: `await`, `.catch`, o `void` explícito.
