//! Runner de yt-dlp: construcción unificada de comandos + parseo de progreso.
//!
//! `YtdlpCmd` centraliza lo que antes duplicaban download (descarga y
//! simulación) y preview (análisis): resolución del binario, `--encoding
//! utf-8`, cookies, runtime deno, ffmpeg, CREATE_NO_WINDOW y el `--` final.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::core::{paths, process};

/// Resuelve el binario de yt-dlp (bundle/dev) con fallback al PATH del sistema.
pub fn bin(app_dir: &Path) -> String {
    paths::find_executable(app_dir, "yt-dlp")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "yt-dlp".into())
}

/// Builder de comandos de yt-dlp con opciones encadenables.
///
/// `build()` añade SIEMPRE `--encoding utf-8` y cierra con `-- <url>`;
/// los llamadores solo declaran sus flags específicos y las condiciones
/// (p. ej. cuándo aplican cookies) que les son propias.
pub struct YtdlpCmd {
    app_dir: PathBuf,
    url: String,
    args: Vec<String>,
    stdout: Stdio,
    stderr: Stdio,
}

impl YtdlpCmd {
    /// Crea el builder resolviendo el binario a partir de `app_dir`.
    /// stdout/stderr arrancan en `piped` (el caso más común).
    pub fn new(app_dir: &Path, url: &str) -> Self {
        Self {
            app_dir: app_dir.to_path_buf(),
            url: url.to_string(),
            args: Vec::new(),
            stdout: Stdio::piped(),
            stderr: Stdio::piped(),
        }
    }

    /// Añade un argumento suelto.
    pub fn arg(mut self, a: impl Into<String>) -> Self {
        self.args.push(a.into());
        self
    }

    /// Añade varios argumentos (p. ej. los derivados de `DownloadOptions`).
    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.args.extend(args.into_iter().map(Into::into));
        self
    }

    /// `--no-update`: no comprobar versiones nuevas de yt-dlp en cada ejecución.
    pub fn no_update(self) -> Self {
        self.arg("--no-update")
    }

    /// `--no-warnings`: silencia avisos que ensuciarían la salida parseada.
    pub fn no_warnings(self) -> Self {
        self.arg("--no-warnings")
    }

    /// `--cookies <path>` solo si el archivo existe. La condición de CUÁNDO
    /// aplicar cookies (por `cookie_mode` o incondicional) la decide el llamador.
    pub fn cookies(mut self, path: &Path) -> Self {
        if path.exists() {
            self.args.push("--cookies".into());
            self.args.push(path.to_string_lossy().into());
        }
        self
    }

    /// Runtime JS deno para el extractor de YouTube (si el binario existe).
    pub fn deno_runtime(mut self) -> Self {
        if let Some(deno) = paths::find_executable(&self.app_dir, "deno") {
            self.args.push("--extractor-args".into());
            self.args.push(format!(
                "youtube:js_runtimes=deno:{}",
                deno.to_string_lossy()
            ));
        }
        self
    }

    /// `--ffmpeg-location` apuntando al directorio del ffmpeg bundled (si existe).
    pub fn ffmpeg_location(mut self) -> Self {
        if let Some(ffmpeg) = paths::find_executable(&self.app_dir, "ffmpeg") {
            if let Some(dir) = ffmpeg.parent() {
                self.args.push("--ffmpeg-location".into());
                self.args.push(dir.to_string_lossy().into());
            }
        }
        self
    }

    /// Configura el stdout del proceso (por defecto `piped`).
    /// (Hoy ningún llamador lo cambia; se mantiene por simetría con `stderr`.)
    #[allow(dead_code)]
    pub fn stdout(mut self, s: Stdio) -> Self {
        self.stdout = s;
        self
    }

    /// Configura el stderr del proceso (por defecto `piped`).
    pub fn stderr(mut self, s: Stdio) -> Self {
        self.stderr = s;
        self
    }

    /// Construye el `Command` final listo para spawn/output.
    pub fn build(mut self) -> Command {
        // El exe empaquetado de yt-dlp ignora PYTHONIOENCODING y, al escribir a
        // una tubería, descarta los caracteres no representables en la página de
        // códigos de Windows (p. ej. títulos en japonés): las rutas/JSON llegarían
        // degradados y no coincidirían con los archivos reales. Forzar UTF-8
        // SIEMPRE en su salida.
        self.args.push("--encoding".into());
        self.args.push("utf-8".into());

        // `--` cierra las opciones: una URL que empiece con "-" no se
        // interpreta como flag.
        self.args.push("--".into());
        self.args.push(self.url);

        let mut cmd = Command::new(bin(&self.app_dir));
        cmd.args(&self.args).stdout(self.stdout).stderr(self.stderr);
        process::hide_console(&mut cmd);
        cmd
    }
}

/// Extrae el porcentaje de una línea de progreso de yt-dlp.
pub fn parse_percent(s: &str) -> Option<f64> {
    let pos = s.find('%')?;
    let before = &s[..pos];
    let num_start = before.rfind(|c: char| !c.is_ascii_digit() && c != '.')? + 1;
    before[num_start..].parse::<f64>().ok()
}

/// Extrae un campo entre dos marcadores (`end_marker` vacío = hasta el final).
pub fn parse_field(s: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let start = s.find(start_marker)? + start_marker.len();
    if end_marker.is_empty() {
        Some(s[start..].trim().to_string())
    } else {
        let end = s[start..].find(end_marker).map(|i| start + i)?;
        Some(s[start..end].trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LINEA_PROGRESO: &str = "[download]  45.2% of ~120.5MiB at 2.5MiB/s ETA 00:42";

    // ---------- parse_percent ----------

    #[test]
    fn parse_percent_extrae_el_porcentaje_de_una_linea_real() {
        assert_eq!(parse_percent(LINEA_PROGRESO), Some(45.2));
    }

    #[test]
    fn parse_percent_soporta_100_por_ciento() {
        assert_eq!(
            parse_percent("[download] 100% of 120.50MiB in 00:01:23 at 1.45MiB/s"),
            Some(100.0)
        );
    }

    #[test]
    fn parse_percent_none_sin_signo_de_porcentaje() {
        assert_eq!(parse_percent("[download] Destination: video.mp4"), None);
        assert_eq!(parse_percent(""), None);
    }

    // ---------- parse_field ----------

    #[test]
    fn parse_field_extrae_velocidad_entre_marcadores() {
        assert_eq!(
            parse_field(LINEA_PROGRESO, "at ", " ETA"),
            Some("2.5MiB/s".to_string())
        );
    }

    #[test]
    fn parse_field_con_end_vacio_toma_hasta_el_final() {
        assert_eq!(
            parse_field(LINEA_PROGRESO, "ETA ", ""),
            Some("00:42".to_string())
        );
    }

    #[test]
    fn parse_field_none_si_falta_un_marcador() {
        assert_eq!(
            parse_field("[download] 45.2% of ~120.5MiB", "at ", " ETA"),
            None
        );
        assert_eq!(parse_field("[download] at 2.5MiB/s", "at ", " ETA"), None);
    }

    // ---------- YtdlpCmd::build ----------

    fn args_de(cmd: &std::process::Command) -> Vec<String> {
        cmd.get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn build_fuerza_encoding_utf8_y_cierra_con_doble_guion_antes_de_la_url() {
        let cmd = YtdlpCmd::new(Path::new("."), "https://youtu.be/x").build();
        let args = args_de(&cmd);
        let n = args.len();
        assert_eq!(
            &args[n - 4..],
            ["--encoding", "utf-8", "--", "https://youtu.be/x"]
        );
    }

    #[test]
    fn build_una_url_que_parece_flag_queda_tras_el_doble_guion() {
        let cmd = YtdlpCmd::new(Path::new("."), "-rf https://evil").build();
        let args = args_de(&cmd);
        let pos_sep = args.iter().position(|a| a == "--").unwrap();
        assert_eq!(args[pos_sep + 1], "-rf https://evil");
        assert_eq!(
            pos_sep + 2,
            args.len(),
            "la URL debe ser el último argumento"
        );
    }

    #[test]
    fn build_conserva_los_args_del_llamador_antes_de_los_comunes() {
        let cmd = YtdlpCmd::new(Path::new("."), "https://youtu.be/x")
            .arg("--newline")
            .no_update()
            .no_warnings()
            .build();
        let args = args_de(&cmd);
        let pos = |flag: &str| args.iter().position(|a| a == flag).unwrap();
        assert!(pos("--newline") < pos("--encoding"));
        assert!(pos("--no-update") < pos("--encoding"));
        assert!(pos("--no-warnings") < pos("--encoding"));
    }
}
