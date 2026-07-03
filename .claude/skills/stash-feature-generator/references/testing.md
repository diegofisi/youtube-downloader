# Testing: what gets tested here and how

Repo philosophy (fase4 commit: "tests de lo fragil"): test the logic that breaks silently,
not the wiring. Today: 4 TS suites (queue.state, opts-model, paged-loader, format) and
embedded Rust tests in ytdlp, download/service, session/service and settings/models.

## What DOES get tested ("the fragile parts")

| Category | Real examples |
|---|---|
| External-text parsers | `parse_percent`/`parse_field` over real yt-dlp lines; `parse_netscape` (Netscape cookies, `#HttpOnly_`, insufficient fields) |
| Error classification | `classify_error`: every auth pattern, case-insensitive, auth>cache priority, None for the rest |
| Command construction | `YtdlpCmd::build` via `Command::get_args`: `--encoding utf-8` at the end, `--` before the URL, arg order |
| Data back-compat | `AppConfig`: empty JSON → defaults; old config keeps its values; Rust default == serde default |
| State machines / schedulers | queue.state: dedupe, concurrency, auth flow (pause/resume), resume vs retry, clearFinished |
| Anti-race logic | paged-loader: stale results discarded, dedupe across pages, 1-based cursor |
| UI↔backend mappings | opts-model: `av→video`, `4k→2160`, unknown quality→`auto`, partial overrides |
| Pure formatting | fmtDuration/fmtSize/timeAgo (edges: 0, undefined, fractions, >1 GB) |
| Names/paths | `template_with_suffix`, `path_with_suffix`, `expected_final_paths`, `sapisidhash` (format) |

## What does NOT get tested

- Views' DOM wiring (initX, addEventListener, repaints): no tests for descargar.ts,
  library-view, shell… Validated via `npm run check` + usage.
- Real processes (yt-dlp/ffmpeg), network, login webview: nothing launches binaries in tests.
- The Tauri commands themselves (the thin commands.rs wrappers): the service they call is tested.
- Styles/static HTML.

## TS patterns (vitest)

**Facade mocks + module-global state** (queue.state.test.ts — the most complete pattern):

```ts
const mocks = vi.hoisted(() => ({ startDownload: vi.fn(), showToast: vi.fn(), /* … */ }));
vi.mock('../download', () => ({ startDownload: mocks.startDownload, cancelDownload: mocks.cancelDownload }));
vi.mock('../../shared/ui/toast', () => ({ showToast: mocks.showToast }));
// bus and i18n are pure: use the REAL ones, don't mock them.

type QueueModule = typeof import('./queue.state');
async function cargarCola(): Promise<QueueModule> { return await import('./queue.state'); }

beforeEach(() => {
  vi.resetModules();                       // module has global state (items/seq): import fresh
  for (const m of Object.values(mocks)) m.mockReset();
});
```

**Draining microtasks** from `.then` chains: `async function flush() { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); }`.
**Controlled promises**: `mockReturnValue(new Promise(() => {}))` (never-ending download) or capture
the `resolve` to finish at will.

**Environment**: vitest.config.ts defines two projects — `dom` (jsdom) for `src/**/ui/**/*.test.ts` and
`src/app/**`, `node` for the rest. If a test needs the DOM, mark it explicitly besides the path:

```ts
// @vitest-environment jsdom
// The loader wires a real "Ver más" button; jsdom provides the minimal document.
…
document.body.innerHTML = '<button id="btn-more">Ver más</button>';   // minimal fixture in beforeEach
```

**Module state without resetModules** (when cleanup suffices): opts-model.test.ts clears
`overrides` in `afterEach` (`for (const k of Object.keys(overrides)) delete overrides[k];`).

## Rust patterns

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
npm test                    # vitest run (dom + node projects; passWithNoTests)
cd src-tauri && cargo test  # embedded Rust tests
```
When adding new logic: if it falls into the "fragile" table, the test ships in the SAME PR; if
it's view wiring, no test is forced.
