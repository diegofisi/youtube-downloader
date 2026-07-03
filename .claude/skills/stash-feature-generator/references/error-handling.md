# Error handling

## Rust: `Result<T, String>` with user-facing messages in Spanish

No thiserror or custom error types: services return `Result<T, String>` and the message reaches
the frontend verbatim. These are UI strings for the user (not logs, not comments): they stay in
Spanish until backend i18n exists.

```rust
fsx::write_atomic(&path, content).map_err(|e| format!("No se pudo escribir {…}: {}", e))?;
```

Message conventions: starts with "No se pudo …" / "Error …", includes the original error's `{}`
detail, and when there is a possible action, suggests it ("Verifica que la configuración inicial
se completó correctamente.").

## `error_kind`: download failure classification

`DownloadResult` carries `errorKind?: 'auth' | 'cache' | 'other'` (serde `rename = "errorKind"`).
The classification lives in `download/service.rs::classify_error` over yt-dlp's `ERROR:` text:

| kind | Patterns (lowercase) | Reaction |
|---|---|---|
| `auth` | "sign in to confirm", "members-only", "cookies are no longer valid", "please sign in", "not a bot", "http error 401" | Fixed `AUTH_ERROR_MSG` message + the queue's auth flow (below). `auth` takes priority over `cache`. |
| `cache` | "http error 403", "forbidden", fragment+403 | The BACKEND clears yt-dlp's cache (`--rm-cache-dir`) and retries ONCE, checking `is_cancelled` before respawning |
| `other` / None | everything else | Regular error: the item ends up `error` with its message |

On the stderr side only `ERROR:` lines count (the rest is noise). Preview has an explicit TODO
to classify auth there too — do NOT change that contract until the frontend branches on it.

## Full auth flow in the queue (queue.state.ts)

When `startDownload` resolves with `errorKind === 'auth'`:

1. The failed item goes to `paused` with `pausedByAuth = true` (not `error`: "so the rest of the
   batch isn't burned").
2. ALL `queued` items also go to `paused` + `pausedByAuth`.
3. `handleAuthFailure()` (single-flight via `authReconnectInFlight`) calls
   `attemptSilentReconnect()` (session): hidden passive-login window, ~20 s timeout.
4. On reconnect: "Sesión renovada" toast and the `paused && pausedByAuth` items go back to
   `queued` (+ `pump()`); otherwise: warn toast "Tu sesión de YouTube caducó — Reconecta en Mi YouTube".
5. In parallel, `session:expired` (from the bus) brings up the shell banner with a "Reconectar" button.

When adding queue states/actions, preserve this semantics: `pause` cancels the process but
keeps the progress (yt-dlp resumes the `.part`); `retry` resets `progress = 0`.

## Toasts: short title + detail + kind

`showToast(title, body, kind)` — 2-4 word title, optional detail in body, semantic kind:

```ts
showToast(t('Añadido a la cola', 'Added to queue'), it.title, 'done');
showToast(t('Sin enlaces', 'No links'), t('Pega al menos un enlace…', 'Paste at least…'), 'warn');
showToast(t('No se pudieron cargar más', 'Could not load more'), String(e), 'error');
```

`error` = something the user asked for failed; `warn` = precondition/notice; `info` = FYI; `done` = success.
Errors inside a panel (non-transient) are also painted in the panel itself
(settings-view: the repair error stays visible in `#fix-progress`).

## Silent degradation: ONLY cosmetic

`.catch(() => {})` / `catch { /* noop */ }` are allowed only when the failure doesn't block the
main flow and there is a visual fallback:

- `getHistory().catch(() => [])` — without history, the preview doesn't mark duplicates (that's all).
- `getSettings().catch(() => null)` / `paintFolder().catch(() => {})` — defaults remain.
- addHistory after a successful download: "the download finished fine; if history fails, we don't break the flow".
- Avatar `img.onerror` → fallback letter "A".

If the user asked for the action explicitly, NEVER swallow the error: toast or panel message.

## Rust: `.ok()` for side effects

Same criterion in Rust — `.ok()` only on effects whose failure doesn't change the outcome:
`fs::create_dir_all(&dir).ok()`, `ww.close().ok()`, `existing.set_focus().ok()`,
`cmd.spawn().ok()` in `kill_process`, `fs::remove_file(&zip_path).ok()`.
With logging when it aids diagnosis: `println!("[download] …")` / `eprintln!` with a `[slice]`
prefix (`[download]`, `[login]`, `[silent-login]`, `[library]`).

Never `.unwrap()`/`.expect()` on runtime-reachable paths (the documented exception:
`paths::app_dir` in release falls back to temp with an `eprintln!` instead of panicking).

## Frontend: where errors are caught

- Views catch at the handler boundary (`try/catch` in `analyze()`, `.catch(...)` on clicks).
- `queue.state::run()` has a final `.catch` that marks `error` with
  `t('Error interno', 'Internal error')` — an unexpected rejection never hangs the scheduler.
- The lint (`no-floating-promises`) forces a decision: `await`, `.catch`, or an explicit `void`.
