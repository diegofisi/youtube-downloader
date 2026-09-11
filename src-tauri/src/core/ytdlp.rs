//! yt-dlp runner: unified command building + progress parsing.
//!
//! `YtdlpCmd` centralizes what download and preview used to duplicate: binary
//! resolution, `--encoding utf-8`, cookies, deno runtime, ffmpeg, CREATE_NO_WINDOW, trailing `--`.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::core::{paths, process};

/// Resolves the yt-dlp binary (bundle/dev) with fallback to the system PATH.
pub fn bin(app_dir: &Path) -> String {
    paths::find_executable(app_dir, "yt-dlp")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "yt-dlp".into())
}

/// Per-run copy of cookies.txt, deleted on drop. yt-dlp rewrites the file passed to
/// `--cookies` on exit, so concurrent runs must never share the canonical file.
pub struct TempCookies(PathBuf);

impl Drop for TempCookies {
    fn drop(&mut self) {
        std::fs::remove_file(&self.0).ok();
    }
}

const RUN_COOKIES_PREFIX: &str = "cookies-run-";

/// Copies `path` to `<app_dir>/cookies-run-<pid>-<n>.txt`; None if the copy fails.
fn copy_run_cookies(app_dir: &Path, path: &Path) -> Option<TempCookies> {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let dest = app_dir.join(format!(
        "{}{}-{}.txt",
        RUN_COOKIES_PREFIX,
        std::process::id(),
        n
    ));
    std::fs::copy(path, &dest).ok()?;
    Some(TempCookies(dest))
}

/// Removes run copies left behind by a dead process (crash/kill).
pub fn clean_stale_run_cookies(app_dir: &Path) {
    crate::core::fsx::remove_stale(app_dir, |name| name.starts_with(RUN_COOKIES_PREFIX));
}

/// A built yt-dlp command. Keep it alive until the process exits: dropping it deletes
/// the per-run cookie copy the process reads.
pub struct YtdlpRun {
    cmd: Command,
    _cookies: Option<TempCookies>,
}

impl YtdlpRun {
    pub fn spawn(&mut self) -> std::io::Result<std::process::Child> {
        self.cmd.spawn()
    }

    pub fn output(&mut self) -> std::io::Result<std::process::Output> {
        self.cmd.output()
    }

    #[cfg(test)]
    pub fn command(&self) -> &Command {
        &self.cmd
    }
}

/// An output template must stay inside the download folder: `Path::join` would replace
/// the base with a rooted/absolute template, and `..` walks out of it. Platform-independent.
pub fn is_safe_output_template(tpl: &str) -> bool {
    let tpl = tpl.trim();
    let rooted = tpl.starts_with('/') || tpl.starts_with('\\');
    let drive =
        tpl.len() >= 2 && tpl.as_bytes()[1] == b':' && tpl.as_bytes()[0].is_ascii_alphabetic();
    let parent = tpl.split(['/', '\\']).any(|seg| seg == "..");
    !rooted && !drive && !parent
}

/// Chainable yt-dlp command builder. `build()` ALWAYS adds `--encoding utf-8`
/// and ends with `-- <url>`; callers only declare their own flags/conditions.
pub struct YtdlpCmd {
    app_dir: PathBuf,
    url: String,
    args: Vec<String>,
    stdout: Stdio,
    stderr: Stdio,
    cookies: Option<TempCookies>,
}

impl YtdlpCmd {
    /// Creates the builder, resolving the binary from `app_dir`.
    /// stdout/stderr default to `piped` (the common case).
    pub fn new(app_dir: &Path, url: &str) -> Self {
        Self {
            app_dir: app_dir.to_path_buf(),
            url: url.to_string(),
            args: Vec::new(),
            stdout: Stdio::piped(),
            stderr: Stdio::piped(),
            cookies: None,
        }
    }

    /// Adds a single argument.
    pub fn arg(mut self, a: impl Into<String>) -> Self {
        self.args.push(a.into());
        self
    }

    /// Adds several arguments (e.g. those derived from `DownloadOptions`).
    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.args.extend(args.into_iter().map(Into::into));
        self
    }

    /// `--no-update`: skip the yt-dlp self-update check on every run.
    pub fn no_update(self) -> Self {
        self.arg("--no-update")
    }

    /// `--no-warnings`: silences warnings that would pollute the parsed output.
    pub fn no_warnings(self) -> Self {
        self.arg("--no-warnings")
    }

    /// `--cookies <copy>` only if the file exists; yt-dlp gets a per-run copy so its
    /// exit-time rewrite never clobbers freshly renewed cookies (see `TempCookies`).
    pub fn cookies(mut self, path: &Path) -> Self {
        if !path.exists() {
            return self;
        }
        let run_path = match copy_run_cookies(&self.app_dir, path) {
            Some(tmp) => {
                let p = tmp.0.clone();
                self.cookies = Some(tmp);
                p
            }
            None => path.to_path_buf(),
        };
        self.args.push("--cookies".into());
        self.args.push(run_path.to_string_lossy().into());
        self
    }

    /// Deno JS runtime for the YouTube extractor (if the binary exists).
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

    /// `--ffmpeg-location` pointing at the bundled ffmpeg directory (if present).
    pub fn ffmpeg_location(mut self) -> Self {
        if let Some(ffmpeg) = paths::find_executable(&self.app_dir, "ffmpeg") {
            if let Some(dir) = ffmpeg.parent() {
                self.args.push("--ffmpeg-location".into());
                self.args.push(dir.to_string_lossy().into());
            }
        }
        self
    }

    /// Sets the process stdout (default `piped`).
    /// (No caller changes it today; kept for symmetry with `stderr`.)
    #[allow(dead_code)]
    pub fn stdout(mut self, s: Stdio) -> Self {
        self.stdout = s;
        self
    }

    /// Sets the process stderr (default `piped`).
    pub fn stderr(mut self, s: Stdio) -> Self {
        self.stderr = s;
        self
    }

    /// Builds the final command, ready for spawn/output (see `YtdlpRun` for its lifetime).
    pub fn build(mut self) -> YtdlpRun {
        // The packaged yt-dlp exe ignores PYTHONIOENCODING and, on piped output, drops chars not in
        // the Windows codepage (e.g. Japanese titles), corrupting paths/JSON. ALWAYS force UTF-8.
        self.args.push("--encoding".into());
        self.args.push("utf-8".into());

        // `--` ends the options: a URL starting with "-" isn't parsed as a flag.
        self.args.push("--".into());
        self.args.push(self.url);

        let mut cmd = Command::new(bin(&self.app_dir));
        cmd.args(&self.args).stdout(self.stdout).stderr(self.stderr);
        process::hide_console(&mut cmd);
        YtdlpRun {
            cmd,
            _cookies: self.cookies,
        }
    }
}

/// The part of a yt-dlp ERROR line that is yt-dlp's own wording: drops the `[ie] <id>: `
/// prefix (the id echoes the search query / handle) and anything after `: '` / `-> '`
/// (quoted file paths carry the video title). Both are user text and must not be classified.
fn classification_text(error_text: &str) -> String {
    let mut text = error_text.trim();
    let cut = [": '", "-> '"]
        .iter()
        .filter_map(|m| text.find(m))
        .min()
        .unwrap_or(text.len());
    text = &text[..cut];
    // `[youtube] abc: msg` / `[youtube:tab] handle: msg`; an `[Errno 13]` or an id-less
    // message (`[youtube:tab] Sign in…: use --cookies`) keeps its head.
    if let Some((ie, rest)) = text.strip_prefix('[').and_then(|r| r.split_once("] ")) {
        if !ie.contains(' ') {
            // Search extractors use the free-text query as id; everything else a bare token.
            let query_id = ie.ends_with(":search_url") || ie.ends_with(":search");
            match rest.split_once(": ") {
                Some((id, msg))
                    if query_id || (!id.contains(char::is_whitespace) && id.len() <= 64) =>
                {
                    text = msg;
                }
                _ => text = rest,
            }
        }
    }
    text.to_lowercase()
}

/// Classifies yt-dlp error text: "auth" (invalid session/cookies), "cache" (HTTP 403 /
/// forbidden fragments, typical of a stale cache) or None. Feed the ERROR line, not raw stderr.
pub fn classify_error(error_text: &str) -> Option<&'static str> {
    let e = classification_text(error_text);

    let is_auth = e.contains("sign in to confirm")
        || e.contains("this video is available to this channel's members")
        || e.contains("members-only")
        || e.contains("cookies are no longer valid")
        || e.contains("please sign in")
        || e.contains("not a bot")
        || e.contains("login required")
        || e.contains("login details are needed")
        || e.contains("http error 401");
    if is_auth {
        return Some("auth");
    }

    let is_cache = e.contains("http error 403")
        || e.contains("forbidden")
        || (e.contains("fragment") && e.contains("403"));
    if is_cache {
        return Some("cache");
    }

    None
}

/// Extracts the percentage from a yt-dlp progress line.
pub fn parse_percent(s: &str) -> Option<f64> {
    let pos = s.find('%')?;
    let before = &s[..pos];
    let num_start = before.rfind(|c: char| !c.is_ascii_digit() && c != '.')? + 1;
    before[num_start..].parse::<f64>().ok()
}

/// Extracts a field between two markers (empty `end_marker` = to end of line).
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

    // ---------- classify_error ----------

    #[test]
    fn classify_error_detecta_cada_patron_de_auth() {
        let patrones = [
            "Sign in to confirm you're not a bot",
            "This video is available to this channel's members on level: X",
            "Join this channel to get access to members-only content",
            "The provided YouTube account cookies are no longer valid",
            "Please sign in to view this video",
            "confirm you are not a bot",
            "HTTP Error 401: Unauthorized",
            "[youtube:tab] Login required to access this page",
            "[youtube:tab] subscriptions: Login details are needed to download this content.",
        ];
        for p in patrones {
            assert_eq!(
                classify_error(p),
                Some("auth"),
                "patrón no clasificado como auth: {}",
                p
            );
        }
    }

    #[test]
    fn classify_error_ignores_the_search_query_echoed_as_id() {
        assert_eq!(
            classify_error(
                "[youtube:search_url] sign in to confirm tutorial: Unable to download webpage"
            ),
            None
        );
        assert_eq!(
            classify_error("[youtube:search_url] t: Sign in to confirm you're not a bot"),
            Some("auth")
        );
        assert_eq!(
            classify_error("[youtube:search_url] not a bot: Sign in to confirm you're not a bot"),
            Some("auth")
        );
        assert_eq!(
            classify_error("[youtube:tab] @forbidden-club: This channel does not exist"),
            None
        );
    }

    #[test]
    fn classify_error_keeps_an_id_less_extractor_message_intact() {
        assert_eq!(
            classify_error("[youtube:tab] Sign in to confirm you're not a bot: use --cookies"),
            Some("auth")
        );
        assert_eq!(
            classify_error("[Errno 13] Permission denied: 'C:\\v\\Forbidden Planet.mp4.part'"),
            None
        );
    }

    #[test]
    fn classify_error_ignores_video_titles_inside_quoted_paths() {
        assert_eq!(
            classify_error("unable to open for writing: [Errno 13] Permission denied: 'C:\\v\\Forbidden Planet.mp4.part'"),
            None
        );
        assert_eq!(
            classify_error(
                "unable to rename file: [WinError 32] in use: 'a.part' -> 'Login Required.mkv'"
            ),
            None
        );
    }

    #[test]
    fn classify_error_es_case_insensitive() {
        assert_eq!(classify_error("SIGN IN TO CONFIRM your age"), Some("auth"));
        assert_eq!(classify_error("http ERROR 403: FORBIDDEN"), Some("cache"));
    }

    #[test]
    fn classify_error_detecta_cache_por_403_y_forbidden() {
        assert_eq!(classify_error("HTTP Error 403: Forbidden"), Some("cache"));
        assert_eq!(
            classify_error("unable to download: Forbidden"),
            Some("cache")
        );
        assert_eq!(
            classify_error("fragment 3 not found, HTTP error 403"),
            Some("cache")
        );
    }

    #[test]
    fn classify_error_auth_tiene_prioridad_sobre_cache() {
        // An error mentioning both: the invalid session is the root cause.
        assert_eq!(
            classify_error("HTTP Error 401 then forbidden"),
            Some("auth")
        );
    }

    #[test]
    fn classify_error_devuelve_none_para_otros_errores() {
        assert_eq!(classify_error("Video unavailable"), None);
        assert_eq!(classify_error("HTTP Error 404: Not Found"), None);
        assert_eq!(classify_error(""), None);
    }

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

    // ---------- is_safe_output_template ----------

    #[test]
    fn safe_template_accepts_relative_templates() {
        assert!(is_safe_output_template("%(title)s [%(id)s].%(ext)s"));
        assert!(is_safe_output_template("%(uploader)s/%(title)s.%(ext)s"));
        assert!(is_safe_output_template("  %(title)s.%(ext)s  "));
    }

    #[test]
    fn safe_template_rejects_rooted_absolute_and_parent_paths() {
        assert!(!is_safe_output_template("C:\\Windows\\%(title)s.%(ext)s"));
        assert!(!is_safe_output_template("/etc/%(title)s"));
        assert!(!is_safe_output_template("\\%(title)s"));
        assert!(!is_safe_output_template("..\\..\\%(title)s"));
        assert!(!is_safe_output_template("../%(title)s"));
        assert!(!is_safe_output_template("  ../%(title)s"));
    }

    // ---------- YtdlpCmd::build ----------

    fn args_de(cmd: &std::process::Command) -> Vec<String> {
        cmd.get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn build_fuerza_encoding_utf8_y_cierra_con_doble_guion_antes_de_la_url() {
        let run = YtdlpCmd::new(Path::new("."), "https://youtu.be/x").build();
        let args = args_de(run.command());
        let n = args.len();
        assert_eq!(
            &args[n - 4..],
            ["--encoding", "utf-8", "--", "https://youtu.be/x"]
        );
    }

    #[test]
    fn build_una_url_que_parece_flag_queda_tras_el_doble_guion() {
        let run = YtdlpCmd::new(Path::new("."), "-rf https://evil").build();
        let args = args_de(run.command());
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
        let run = YtdlpCmd::new(Path::new("."), "https://youtu.be/x")
            .arg("--newline")
            .no_update()
            .no_warnings()
            .build();
        let args = args_de(run.command());
        let pos = |flag: &str| args.iter().position(|a| a == flag).unwrap();
        assert!(pos("--newline") < pos("--encoding"));
        assert!(pos("--no-update") < pos("--encoding"));
        assert!(pos("--no-warnings") < pos("--encoding"));
    }
}
