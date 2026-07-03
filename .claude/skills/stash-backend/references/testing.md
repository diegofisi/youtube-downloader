# Testing: what gets tested here and how (backend)

Repo philosophy (fase4 commit, "tests for the fragile parts"): test the logic that breaks silently,
not the wiring. Frontend testing (vitest patterns, component/state tests) is specified by the
stash-frontend skill; this file covers the Rust side. Today: embedded Rust tests in ytdlp,
download/service, session/service and settings/models.

## What DOES get tested ("the fragile parts")

| Category | Real examples |
|---|---|
| External-text parsers | `parse_percent`/`parse_field` over real yt-dlp lines; `parse_netscape` (Netscape cookies, `#HttpOnly_`, insufficient fields) |
| Error classification | `classify_error`: every auth pattern, case-insensitive, auth>cache priority, None for the rest |
| Command construction | `YtdlpCmd::build` via `Command::get_args`: `--encoding utf-8` at the end, `--` before the URL, arg order |
| Data back-compat | `AppConfig`: empty JSON → defaults; old config keeps its values; Rust default == serde default |
| Names/paths | `template_with_suffix`, `path_with_suffix`, `expected_final_paths`, `sapisidhash` (format) |

## What does NOT get tested

- Real processes (yt-dlp/ffmpeg), network, login webview: nothing launches binaries in tests.
- The Tauri commands themselves (the thin commands.rs wrappers): the service they call is tested.

## Rust patterns

Tests live in `#[cfg(test)] mod tests { use super::*; … }` at the END of the same file; new
test names in English snake_case (existing tests keep their legacy names — see conventions.md).

**std tempdir with a Drop guard** (no test crates) for real FS (session/service.rs):

```rust
struct TempDir(PathBuf);
impl TempDir {
    fn new(tag: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("stash-test-{}-{}", tag, std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        TempDir(dir)
    }
}
impl Drop for TempDir { fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); } }
```

**Inspecting a Command without running it** (core/ytdlp.rs):

```rust
fn args_de(cmd: &std::process::Command) -> Vec<String> {
    cmd.get_args().map(|a| a.to_string_lossy().into_owned()).collect()
}
let cmd = YtdlpCmd::new(Path::new("."), "https://youtu.be/x").build();
assert_eq!(&args_de(&cmd)[n - 4..], ["--encoding", "utf-8", "--", "https://youtu.be/x"]);
```

**Serde back-compat** (settings/models.rs): deserialize `"{}"` and a first-version JSON;
a third test compares `AppConfig::default()` against the serde default ("if someone changes a
default in one place and not the other, this test flags it").

**Real-line fixtures**: constants with literal yt-dlp output
(`const LINEA_PROGRESO: &str = "[download]  45.2% of ~120.5MiB at 2.5MiB/s ETA 00:42";`).

## How to run

```
cd src-tauri && cargo test  # embedded Rust tests
```
The frontend suites run with `npm test` and belong to the stash-frontend skill's checklist.
When adding new logic: if it falls into the "fragile" table, the test ships in the SAME PR; if
it's a thin command wrapper, no test is forced.
