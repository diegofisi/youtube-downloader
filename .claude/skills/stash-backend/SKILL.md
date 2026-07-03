---
name: stash-backend
description: >
  Generates backend code in Stash (Tauri 2 + Rust, vertical slices) following the
  repo's REAL architecture and conventions. Use when asked to add a new Tauri
  command, a new Rust service, a new backend event, or to change the frontend↔backend
  contract — including the Spanish trigger phrases "nuevo comando", "nuevo servicio
  Rust", "nuevo evento Tauri", "cambio de contrato backend". For UI/frontend work
  use the stash-frontend skill instead.
---

# Stash Backend

Examples > prose: every pattern below exists in the code; copy the cited example instead of inventing. Spanish for user-facing error messages; English for code, file names, and code comments (concise, max 1-2 lines).

This skill covers the Rust/Tauri side and the FE↔BE contract. New views, components, state, or any React work → skill `../stash-frontend`.

## References

| File | When to read it |
|---|---|
| `references/architecture.md` | Before creating a slice or moving code between layers. Real backend tree, slice anatomy, core/ modules, decision log. |
| `references/tauri-commands.md` | Before touching a Tauri command or event. Full FE↔BE contract table, serde, spawn_blocking, YtdlpCmd, DownloadRegistry. |
| `references/error-handling.md` | Errors: `Result<T, String>`, `error_kind`, Spanish user-facing strings. |
| `references/conventions.md` | Naming, comments, commits, Rust test style. |
| `references/testing.md` | Before writing tests (what to test and with which patterns). |

## Workflow A — New Tauri command

Full backend chain (use `library` or `settings` as the model slice):

1. **`src-tauri/src/features/{slice}/models.rs`** — input/output structs. NEW structs always:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")]
   pub struct {Thing} { pub file_path: Option<String>, /* arrives as filePath */ }
   ```
2. **`service.rs`** — ALL the logic. Typical signature: `pub fn {verb}(app_dir: &Path, ...) -> Result<{Thing}, String>` with user-facing messages in Spanish (`format!("No se pudo …: {}", e)`). No `tauri::` except `AppHandle` when it emits events.
3. **`commands.rs`** — THIN wrapper:
   ```rust
   #[tauri::command]
   pub fn {verb}_{noun}(app: AppHandle, {arg}: String) -> Result<{Thing}, String> {
       let app_dir = paths::app_dir(&app);
       service::{verb}(&app_dir, &{arg})
   }
   ```
   If the work is heavy (external process, `reqwest::blocking`, trash/COM): `async fn` + `tauri::async_runtime::spawn_blocking` — copy the pattern and comment from `download/commands.rs::start_download` or `library/commands.rs::delete_history_file`.
4. **`main.rs`** — add `{slice}::commands::{verb}_{noun}` to `tauri::generate_handler![…]`.
5. **Frontend side** — the frontend consumes commands through its typed invoke adapter layer (see stash-frontend data-flow). Hand over the contract: command name, flat camelCase args (Tauri maps them to snake_case on its own: `videoId` → `video_id`), and the serde shape of the return type. Register the new row in the contract table of `references/tauri-commands.md`.
6. Verify (final checklist).

## Workflow B — New view/section

Frontend territory. Do NOT handle it here → skill `../stash-frontend`.

## Workflow C — New backend event (Rust → frontend)

Kebab-case name (`download-progress`). The payload is ALWAYS a serde struct (`preview-progress` uses a `(done, total)` tuple — legacy, do NOT imitate). In Rust:

```rust
app.emit("{event-name}", {Payload} { … })
```

The frontend subscribes through its typed event adapter and is responsible for releasing the listener (see stash-frontend data-flow). Register the new row in the events table of `references/tauri-commands.md`.

Frontend-only events (slice → slice inside the UI) are NOT Tauri events — they belong to the frontend skill.

## Workflow D — Where does shared Rust logic live?

| The logic… | Goes in |
|---|---|
| Cross-cutting, no domain (fs, paths, process control, yt-dlp invocation) | `src-tauri/src/core/` |
| Belongs to ONE slice's domain | The owning slice's `service.rs`; `pub mod service` in `mod.rs` ONLY if another slice consumes it (today: only `session` and `settings`) |

## Final validation checklist

```
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings   # or: npm run check:rust
cd src-tauri && cargo test
```
- [ ] New command registered in `generate_handler!`.
- [ ] New serde structs carry `rename_all = "camelCase"`.
- [ ] Contract table in `references/tauri-commands.md` updated.
- [ ] The frontend side of the contract (adapter, types, consumption) is validated by the stash-frontend skill's own checklist — do not duplicate it here.

## DO NOT

- Domain logic in `commands.rs` (it belongs in `service.rs`).
- Blocking work in an async command without `spawn_blocking`.
- New Tauri event payloads as tuples or bare values.
- New serde structs without `rename_all = "camelCase"` — and the reverse: "fixing" the legacy snake_case ones (`AppConfig`, `VideoMeta`) without a migration plan.
- Invoking yt-dlp with a raw `Command::new`: use the `YtdlpCmd` builder (guarantees `--encoding utf-8` and `-- <url>`).
- Cancelable processes not registered in `DownloadRegistry`.
- Persisting JSON with a direct `fs::write`: use `core::fsx::write_atomic`.
- `.unwrap()`/`.expect()` on runtime-reachable paths (see error-handling.md).
