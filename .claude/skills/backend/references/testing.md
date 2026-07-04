# Testing: what gets tested here and how (backend)

Philosophy: **test the logic that breaks silently, not the wiring.** Frontend testing
(component/state test patterns) is specified by the frontend skill; this file covers the
Rust side. The project's real test inventory (which modules carry embedded tests today)
lives in project.md.

## What DOES get tested ("the fragile parts")

| Category | Examples |
|---|---|
| External-text parsers | percent/field extractors over REAL output lines of `{tool}`; file-format parsers (edge rows, comment-prefixed rows, insufficient fields) |
| Error classification | `classify_error`: every pattern of every kind, case-insensitive, kind priority order, `None` for the rest |
| Command construction | `{Tool}Cmd::build` via `Command::get_args`: mandatory flags present and last, `--` before the positional, arg order |
| Data back-compat | Persisted config structs: empty JSON → defaults; a first-version JSON keeps its values; Rust `default()` == serde default |
| Names/paths | Filename/suffix/template helpers, hash or token formatters |

## What does NOT get tested

- Real processes (`{tool}` and its helpers), network, login webviews: nothing launches
  binaries in tests.
- The Tauri commands themselves (the thin `commands.rs` wrappers): the service they call
  is tested.

## Rust patterns

Tests live in `#[cfg(test)] mod tests { use super::*; … }` at the END of the same file;
new test names in English snake_case (legacy names stay — see conventions.md).

**std tempdir with a Drop guard** (no test crates) for real FS:

```rust
struct TempDir(PathBuf);
impl TempDir {
    fn new(tag: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("{app}-test-{}-{}", tag, std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        TempDir(dir)
    }
}
impl Drop for TempDir { fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); } }
```

**Inspecting a Command without running it**:

```rust
fn args_of(cmd: &std::process::Command) -> Vec<String> {
    cmd.get_args().map(|a| a.to_string_lossy().into_owned()).collect()
}
let cmd = {Tool}Cmd::new(Path::new("."), "https://example.com/x").build();
assert_eq!(&args_of(&cmd)[n - 4..], ["--encoding", "utf-8", "--", "https://example.com/x"]);
```

**Serde back-compat**: deserialize `"{}"` and a first-version JSON; a third test compares
`{Config}::default()` against the serde default ("if someone changes a default in one place
and not the other, this test flags it").

**Real-line fixtures**: constants with LITERAL output captured from `{tool}`
(`const PROGRESS_LINE: &str = "[download]  45.2% of ~120.5MiB at 2.5MiB/s ETA 00:42";`) —
never hand-invented approximations.

## How to run

```
cd src-tauri && cargo test   # embedded Rust tests
```

The frontend suites belong to the frontend skill's checklist. When adding new logic: if it
falls into the "fragile" table, the test ships in the SAME PR; if it's a thin command
wrapper, no test is forced.
