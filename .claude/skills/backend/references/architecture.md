# Backend architecture (Tauri 2 + Rust, vertical slices)

Vertical slicing + screaming architecture on both sides of the app. This file covers the
Rust/Tauri side generically; the current repo's real tree, module inventory, and decision
log live in `project.md`. Frontend architecture lives in the `frontend` skill — do not
duplicate it here.

## Backend tree shape (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs              # Composition root: .manage(state) + plugins + generate_handler! + shutdown hooks
├── core/                # Cross-cutting infrastructure (no domain). Every feature consumes it.
│   ├── fsx.rs           # atomic write helper (tmp + rename)
│   ├── models.rs        # shared event payload structs
│   ├── paths.rs         # app_dir (dev/release), executable discovery
│   ├── process.rs       # process registry (Tauri State) + console hiding + kill helpers
│   └── {tool}.rs        # {Tool}Cmd builder + output parsers for the external CLI tool
└── features/            # Each folder = one capability (one vertical slice).
    └── {feature}/       # commands · service · models (· extra modules when justified)
```

## Canonical anatomy of a slice

| File | Role |
|---|---|
| `models.rs` | Serde structs of the FE↔BE contract (plus internal groupers) |
| `service.rs` | ALL the logic; `Result<T, String>` — error strings are user-facing product copy (see error-handling.md); `#[cfg(test)] mod tests` at the end |
| `commands.rs` | Thin `#[tauri::command]` wrappers: resolve `app_dir`, delegate, `spawn_blocking` when heavy |
| `mod.rs` | `pub mod commands; pub mod models; mod service;` — `pub mod service` ONLY if another slice consumes it |

Cross-slice Rust dependencies are the exception, not the rule: a slice may depend on
another slice's PUBLIC service only when there is a real domain need (the current repo's
list is in project.md). Everything else shares via `core::*`.

## Composition root (`main.rs`)

The builder does four things, in order:

1. `.manage(...)` — register shared state (e.g. the process registry) as Tauri State;
   no statics.
2. Register plugins (dialog/shell/fs/…).
3. `generate_handler![...]` — every command, one flat list.
4. `on_window_event` — when the main window is destroyed, kill every registered child
   process (never leave orphaned subprocesses of the external tool).

## Layer rules

- `core/` never imports from `features/` — the dependency arrow points one way.
- `service.rs` stays Tauri-free except `AppHandle` for event emission; this keeps services
  unit-testable without a running app.
- A slice's `models.rs` owns the serde shapes it returns; shared payloads (e.g. a progress
  event used by more than one flow) live in `core/models.rs`.
