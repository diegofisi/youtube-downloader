# FE↔BE contract: Tauri commands and events

The frontend consumes commands through its typed invoke adapter layer (frontend skill's
data-flow reference); this file owns the contract DOCTRINE: serde case rules, blocking
discipline, external-CLI invocation, cancellable processes, events, persistence. The
project's LIVE contract table (every real command and event) lives in `project.md` —
update it there whenever the contract changes.

## Serde rules (contract case)

1. **Flat command args**: Tauri converts camelCase (JS) ↔ snake_case (Rust) on its own.
   `invoke('{command_name}', { videoId })` arrives as `video_id: Option<String>`. Nothing
   extra needed.
2. **NEW structs**: always `#[serde(rename_all = "camelCase")]`. Targeted renames when the
   struct doesn't have it wholesale: `#[serde(rename = "errorKind")]` on a single field.
3. **snake_case legacy is UNTOUCHABLE without a migration**: some old structs predate the
   camelCase rule and are wired into both the frontend AND persisted files on disk; changing
   their case breaks both. The project's list of legacy structs (and their back-compat
   contracts, e.g. `#[serde(default = "…")]` on every field plus deserialization tests) is
   in project.md.
4. Optional output fields: `#[serde(skip_serializing_if = "Option::is_none")]` → in TS they
   are `field?: T`.

## `spawn_blocking`: when and how

`async` command + `tauri::async_runtime::spawn_blocking` whenever the body blocks:
external process, blocking HTTP client, or slow FS/COM work (e.g. sending files to the
system trash).

```rust
#[tauri::command]
pub async fn {command_name}(app: AppHandle, url: String, options: {Opts}) -> Result<{Out}, String> {
    let app_dir = paths::app_dir(&app);
    // spawn_blocking uses tokio's blocking pool (hundreds of threads): a long-running job
    // never ties up an async worker (which would freeze every other command).
    //                                  ← keep this comment (in English) in new heavy commands
    tauri::async_runtime::spawn_blocking(move || {
        // State<> cannot move into a blocking thread: recover it from the handle.
        let registry = app.state::<ProcessRegistry>();
        service::{verb}(&app, &registry, &app_dir, &url, &options)
    })
    .await
    .map_err(|e| format!("{internal-thread-error product copy}: {}", e))  // see error-handling.md
}
```

Fast synchronous commands (reading a small JSON, deleting a small file) stay plain `fn`.

## `{Tool}Cmd`: EVERY invocation of the external CLI goes through the builder

One builder in `core/{tool}.rs` owns the invariants of the external tool; callers only
declare their own flags and their conditions. `build()` ALWAYS appends the mandatory flags
(e.g. forcing UTF-8 output on Windows, where piped output otherwise degrades to the local
codepage) and closes with `-- <positional>` (a positional argument starting with `-` must
never be parsed as a flag):

```rust
let mut builder = {Tool}Cmd::new(app_dir, url)
    .arg("-J").arg("--flat-output")        // caller's own flags
    .no_warnings().no_update()
    .bundled_helpers();                    // bundled helper binaries if present
if {auth_condition} {
    builder = builder.auth_file(&{feature}::get_auth_path(app_dir)); // only if the file exists
}
let out = builder.build().output()…        // or .spawn() when the PID must be registered
```

Raw `Command::new("{tool}")` outside the builder is forbidden (the only acceptable
exceptions are maintenance calls that don't operate on user input — list them in
project.md). Output parsing helpers (percent/field extractors) live next to the builder.

## Process registry: cancellable subprocesses

Any process the user can cancel follows this cycle against a registry held in Tauri State:

```rust
registry.begin(key);                       // at the entry of the flow
let child = builder.build().spawn()…;
registry.set_pid(key, child.id());         // if already cancelled, set_pid kills it under the lock
// … wait/read …
registry.clear_pid(key);                   // process ended but the flow continues (retry)
if registry.is_cancelled(key) { /* abort before each new spawn */ }
registry.finish(key);                      // ALWAYS at the end (success or failure)
```

The registry closes the cancel/spawn race by doing both sides under THE SAME lock:
`cancel()` marks+kills, and `set_pid()` kills if already cancelled — "either cancel sees
the PID, or spawn sees the cancel". The cancel command takes an `Option<String>` key:
`None` cancels everything. On Windows the kill is `taskkill /F /T` (includes helper child
processes), and every new `Command` gets the console-hiding flag.

## Event emission (Rust → frontend)

Names in **kebab-case** (`{feature}-progress`). The payload is ALWAYS a serde struct —
never a tuple or bare value. In Rust:

```rust
app.emit("{event-name}", {Payload} { … })
```

The frontend subscribes through its typed event adapter and owns the listener lifecycle
(subscribe/release). Register every new event in the project's events table (project.md).

## JSON persistence

Always `core::fsx::write_atomic(&path, content)` (tmp + rename): a mid-write crash never
leaves a persisted JSON file corrupted. Tolerant reads for non-critical stores:
`serde_json::from_str(&content).unwrap_or_default()` — a corrupt file degrades to defaults
instead of breaking the app.

## Pinned external dependencies

External tools and helper binaries the app downloads or bundles are pinned to CONCRETE
versions/tags — never `releases/latest`: the app must not break because a new upstream
version changes behavior nobody tested. Updates are deliberate: bump the pin, test, commit.
The project's current pins live in project.md.
