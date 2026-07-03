# Testing: qué se testea aquí y cómo

Filosofía del repo (commit fase4: "tests de lo fragil"): se testea la lógica que se rompe en
silencio, no el wiring. Hoy: 4 suites TS (queue.state, opts-model, paged-loader, format) y
tests Rust embebidos en ytdlp, download/service, session/service y settings/models.

## Qué SÍ se testea ("lo frágil")

| Categoría | Ejemplos reales |
|---|---|
| Parsers de texto externo | `parse_percent`/`parse_field` sobre líneas reales de yt-dlp; `parse_netscape` (cookies Netscape, `#HttpOnly_`, campos insuficientes) |
| Clasificación de errores | `classify_error`: cada patrón de auth, case-insensitive, prioridad auth>cache, None para el resto |
| Construcción de comandos | `YtdlpCmd::build` vía `Command::get_args`: `--encoding utf-8` al final, `--` antes de la URL, orden de args |
| Retro-compatibilidad de datos | `AppConfig`: JSON vacío → defaults; config viejo conserva lo suyo; default de Rust == default de serde |
| Máquinas de estado / schedulers | queue.state: dedupe, concurrencia, flujo de auth (pausar/reanudar), resume vs retry, clearFinished |
| Lógica anti-race | paged-loader: resultados stale descartados, dedupe entre páginas, cursor 1-based |
| Mapeos UI↔backend | opts-model: `av→video`, `4k→2160`, calidad desconocida→`auto`, overrides parciales |
| Formateo puro | fmtDuration/fmtSize/timeAgo (bordes: 0, undefined, fracciones, >1 GB) |
| Nombres/rutas | `template_with_suffix`, `path_with_suffix`, `expected_final_paths`, `sapisidhash` (formato) |

## Qué NO se testea

- Wiring DOM de las vistas (initX, addEventListener, repintados): no hay tests de descargar.ts,
  library-view, shell… Se valida con `npm run check` + uso.
- Procesos reales (yt-dlp/ffmpeg), red, webview de login: nada lanza binarios en tests.
- Los comandos Tauri en sí (los wrappers finos de commands.rs): se testea el service que llaman.
- Estilos/HTML estático.

## Patrones TS (vitest)

**Mock de fachadas + estado global de módulo** (queue.state.test.ts — el patrón más completo):

```ts
const mocks = vi.hoisted(() => ({ startDownload: vi.fn(), showToast: vi.fn(), /* … */ }));
vi.mock('../download', () => ({ startDownload: mocks.startDownload, cancelDownload: mocks.cancelDownload }));
vi.mock('../../shared/ui/toast', () => ({ showToast: mocks.showToast }));
// bus e i18n son puros: se usan REALES, no se mockean.

type QueueModule = typeof import('./queue.state');
async function cargarCola(): Promise<QueueModule> { return await import('./queue.state'); }

beforeEach(() => {
  vi.resetModules();                       // el módulo tiene estado global (items/seq): importar fresco
  for (const m of Object.values(mocks)) m.mockReset();
});
```

**Drenar microtasks** de cadenas `.then`: `async function flush() { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); }`.
**Promesas controladas**: `mockReturnValue(new Promise(() => {}))` (descarga eterna) o capturar el
`resolve` para terminar a voluntad.

**Entorno**: vitest.config.ts define dos proyectos — `dom` (jsdom) para `src/**/ui/**/*.test.ts` y
`src/app/**`, `node` para el resto. Si un test necesita DOM, además del path se marca explícito:

```ts
// @vitest-environment jsdom
// El loader cablea un botón "Ver más" real; jsdom aporta el document mínimo.
…
document.body.innerHTML = '<button id="btn-more">Ver más</button>';   // fixture mínima en beforeEach
```

**Estado de módulo sin resetModules** (cuando basta limpiar): opts-model.test.ts borra
`overrides` en `afterEach` (`for (const k of Object.keys(overrides)) delete overrides[k];`).

## Patrones Rust

**Tempdir de std con guard Drop** (sin crates de test) para FS real (session/service.rs):

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

**Inspeccionar un Command sin ejecutarlo** (core/ytdlp.rs):

```rust
fn args_de(cmd: &std::process::Command) -> Vec<String> {
    cmd.get_args().map(|a| a.to_string_lossy().into_owned()).collect()
}
let cmd = YtdlpCmd::new(Path::new("."), "https://youtu.be/x").build();
assert_eq!(&args_de(&cmd)[n - 4..], ["--encoding", "utf-8", "--", "https://youtu.be/x"]);
```

**Retro-compat serde** (settings/models.rs): deserializar `"{}"` y un JSON de la primera versión;
un tercer test compara `AppConfig::default()` contra el default por serde ("si alguien cambia un
default en un sitio y no en el otro, este test avisa").

**Fixtures de líneas reales**: constantes con salida literal de yt-dlp
(`const LINEA_PROGRESO: &str = "[download]  45.2% of ~120.5MiB at 2.5MiB/s ETA 00:42";`).

## Cómo correr

```
npm test                    # vitest run (proyectos dom + node; passWithNoTests)
cd src-tauri && cargo test  # tests Rust embebidos
```
Al añadir lógica nueva: si cae en la tabla de "lo frágil", el test va en el MISMO PR; si es
wiring de vista, no se fuerza un test.
