---
name: backend
description: >
  Backend doctrine for Tauri 2 + Rust apps organized in vertical slices. Use when
  asked to add a new Tauri command, a new Rust service, a new backend event
  (Rust → frontend), to change the frontend↔backend contract (serde shapes,
  command params, event payloads), to wrap an external CLI tool, to add
  cancellable subprocesses, or to persist JSON from the backend. For
  UI/frontend work use the frontend skill instead.
---

# Backend (Tauri 2 + Rust, vertical slices)

**Read `references/project.md` FIRST if present** — it binds this generic doctrine to the
current repo (real feature names, the live FE↔BE contract table, decision log, legacy
exceptions). Everything else in this skill is project-agnostic: `{feature}`, `{tool}`,
`{Entity}` are placeholders you replace with the project's real names.

Examples > prose: copy the cited pattern instead of inventing. User-facing error strings
are product copy in the app's default language (see error-handling.md → product-copy rule);
English for code, file names, and code comments (concise, max 1-2 lines).

This skill covers the Rust/Tauri side and the FE↔BE contract. New views, components,
state, or any UI work → skill `../frontend`.

## Topic index

| File | Covers | Read when |
|---|---|---|
| `references/project.md` | Project binding: real contract table, decision log, core inventory, legacy exceptions | ALWAYS first, if it exists |
| `references/architecture.md` | Slice anatomy (commands/service/models), core layer, composition root, cross-slice rules | Before creating a slice or moving code between layers |
| `references/tauri-commands.md` | Serde contract rules, spawn_blocking, external-CLI builder, process registry, events, atomic writes | Before touching a Tauri command or event |
| `references/error-handling.md` | `Result<T, String>`, error-code classification (error_kind pattern), `.ok()` discipline | Before returning or classifying errors |
| `references/conventions.md` | Naming, comments, commit style, Rust test style | Before naming anything or committing |
| `references/testing.md` | What deserves a backend test and the patterns to write it (tempdir, `get_args`, back-compat) | Before writing tests |

## Workflow A — New Tauri command

Full backend chain (pick an existing slice as the model — project.md names good ones):

1. **`src-tauri/src/features/{feature}/models.rs`** — input/output structs. NEW structs always:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   #[serde(rename_all = "camelCase")]
   pub struct {Entity} { pub file_path: Option<String>, /* arrives as filePath */ }
   ```
2. **`service.rs`** — ALL the logic. Typical signature:
   `pub fn {verb}(app_dir: &Path, ...) -> Result<{Entity}, String>`; the error string is
   user-facing product copy (see error-handling.md). No `tauri::` types except `AppHandle`
   when it emits events.
3. **`commands.rs`** — THIN wrapper:
   ```rust
   #[tauri::command]
   pub fn {command_name}(app: AppHandle, {arg}: String) -> Result<{Entity}, String> {
       let app_dir = paths::app_dir(&app);
       service::{verb}(&app_dir, &{arg})
   }
   ```
   If the work is heavy (external process, blocking HTTP, slow FS/COM): `async fn` +
   `tauri::async_runtime::spawn_blocking` — see tauri-commands.md → spawn_blocking pattern.
4. **`main.rs`** — add `{feature}::commands::{command_name}` to `tauri::generate_handler![…]`.
5. **Frontend side** — the frontend consumes commands through its typed invoke adapter layer
   (see the frontend skill's data-flow reference). Hand over the contract: command name, flat
   camelCase args (Tauri maps them to snake_case on its own: `videoId` → `video_id`), and the
   serde shape of the return type. Register the new row in the project's contract table
   (project.md).
6. Verify (final checklist).

## Workflow B — New view/section

Frontend territory. Do NOT handle it here → skill `../frontend`.

## Workflow C — New backend event (Rust → frontend)

Kebab-case name (`{feature}-progress`). The payload is ALWAYS a serde struct — never a tuple
or a bare value (legacy tuple payloads, if any, are listed in project.md; do not imitate them).
In Rust:

```rust
app.emit("{event-name}", {Payload} { … })
```

The frontend subscribes through its typed event adapter and is responsible for releasing the
listener (frontend skill's data-flow reference). Register the new row in the project's events
table (project.md).

Frontend-only events (slice → slice inside the UI) are NOT Tauri events — they belong to the
frontend skill.

## Workflow D — Where does shared Rust logic live?

| The logic… | Goes in |
|---|---|
| Cross-cutting, no domain (fs helpers, paths, process control, external-CLI invocation) | `src-tauri/src/core/` |
| Belongs to ONE slice's domain | The owning slice's `service.rs`; `pub mod service` in `mod.rs` ONLY if another slice consumes it (the current public-service slices are listed in project.md) |

## Final validation checklist

Run the project's verification commands (they live in CLAUDE.md / project.md — typically
`cargo check`, `cargo clippy -- -D warnings`, `cargo test` from `src-tauri/`).

- [ ] New command registered in `generate_handler!`.
- [ ] New serde structs carry `rename_all = "camelCase"`.
- [ ] The project's contract table (project.md) updated with the new command/event row.
- [ ] The frontend side of the contract (adapter, types, consumption) is validated by the
      frontend skill's own checklist — do not duplicate it here.

## DO NOT

- Domain logic in `commands.rs` (it belongs in `service.rs`).
- Blocking work in an async command without `spawn_blocking`.
- New Tauri event payloads as tuples or bare values.
- New serde structs without `rename_all = "camelCase"` — and the reverse: "fixing" legacy
  snake_case structs (listed in project.md) without a migration plan.
- Invoking the external CLI tool with a raw `Command::new`: use the project's `{Tool}Cmd`
  builder (it guarantees the mandatory flags and safe argument termination).
- Cancellable processes not registered in the process registry (Tauri State).
- Persisting JSON with a direct `fs::write`: use the atomic write helper (tmp + rename).
- `.unwrap()`/`.expect()` on runtime-reachable paths (see error-handling.md).
