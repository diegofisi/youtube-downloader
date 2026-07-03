# Error handling (backend)

How the frontend surfaces these errors (toasts, panels, catch boundaries) is specified by the
stash-frontend skill. This file owns the backend side of the contract.

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
| `auth` | "sign in to confirm", "members-only", "cookies are no longer valid", "please sign in", "not a bot", "http error 401" | Fixed `AUTH_ERROR_MSG` message. The frontend queue pauses the batch and attempts a silent session reconnect (see stash-frontend). `auth` takes priority over `cache`. |
| `cache` | "http error 403", "forbidden", fragment+403 | The BACKEND clears yt-dlp's cache (`--rm-cache-dir`) and retries ONCE, checking `is_cancelled` before respawning |
| `other` / None | everything else | Regular error: the message travels to the frontend as-is |

On the stderr side only `ERROR:` lines count (the rest is noise). Preview has an explicit TODO
to classify auth there too — do NOT change that contract until the frontend branches on it.

Contract invariant for the `auth` flow: the failed download must come back as a RESOLVED
`DownloadResult` with `errorKind: 'auth'` (not a rejected promise) — the frontend queue's
pause/silent-reconnect/resume semantics depend on it.

## Rust: `.ok()` for side effects only

`.ok()` only on effects whose failure doesn't change the outcome:
`fs::create_dir_all(&dir).ok()`, `ww.close().ok()`, `existing.set_focus().ok()`,
`cmd.spawn().ok()` in `kill_process`, `fs::remove_file(&zip_path).ok()`.
With logging when it aids diagnosis: `println!("[download] …")` / `eprintln!` with a `[slice]`
prefix (`[download]`, `[login]`, `[silent-login]`, `[library]`).

If the user asked for the action explicitly, NEVER swallow the error: return the `Err` so the
frontend can show it.

Never `.unwrap()`/`.expect()` on runtime-reachable paths (the documented exception:
`paths::app_dir` in release falls back to temp with an `eprintln!` instead of panicking).
