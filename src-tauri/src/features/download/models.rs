use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Clasificación del fallo: "auth" (sesión/cookies), "cache" (HTTP 403
    /// persistente tras limpiar cache) u "other". Llega al frontend como `errorKind`.
    #[serde(rename = "errorKind", skip_serializing_if = "Option::is_none")]
    pub error_kind: Option<String>,
    /// Ruta absoluta del archivo final descargado (capturada con
    /// `--print after_move:filepath`). None si no se pudo capturar.
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// Opciones de descarga (enviadas desde el frontend en camelCase).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    /// "video" | "audio"
    pub mode: String,
    /// "auto" | "max" | "2160" | "1440" | "1080" | "720" | "480" | "360"
    pub quality: String,
    /// "mp4" | "mkv" | "webm"
    pub container: String,
    /// "mp3" | "m4a" | "opus"
    pub audio_format: String,
    /// kbps (0 = por defecto)
    pub audio_bitrate: u32,
    pub subtitles: bool,
    /// idiomas separados por coma, p.ej. "es,en"
    pub sub_langs: String,
    pub embed_thumbnail: bool,
    #[serde(default)]
    pub output_template: Option<String>,
    /// "file" | "none"
    pub cookie_mode: String,
}

impl Default for DownloadOptions {
    fn default() -> Self {
        Self {
            mode: "video".into(),
            quality: "auto".into(),
            container: "mp4".into(),
            audio_format: "mp3".into(),
            audio_bitrate: 0,
            subtitles: false,
            sub_langs: "es,en".into(),
            embed_thumbnail: false,
            output_template: None,
            cookie_mode: "none".into(),
        }
    }
}

impl DownloadOptions {
    /// Traduce las opciones a argumentos de yt-dlp (sin los comunes, que añade el service).
    pub fn to_ytdlp_args(&self, output_dir: &Path) -> Vec<String> {
        let mut a: Vec<String> = Vec::new();

        if self.mode == "audio" {
            a.push("-x".into());
            a.push("--audio-format".into());
            a.push(self.audio_format.clone());
            if self.audio_bitrate > 0 {
                a.push("--audio-quality".into());
                a.push(format!("{}K", self.audio_bitrate));
            }
        } else {
            a.push("-f".into());
            a.push(self.format_selector());
            a.push("--merge-output-format".into());
            a.push(self.container.clone());
        }
        // "videoonly" ya se maneja dentro de format_selector.

        if self.subtitles {
            a.push("--write-subs".into());
            a.push("--write-auto-subs".into());
            a.push("--sub-langs".into());
            a.push(if self.sub_langs.trim().is_empty() {
                "es,en".into()
            } else {
                self.sub_langs.clone()
            });
            a.push("--embed-subs".into());
        }

        if self.embed_thumbnail {
            a.push("--embed-thumbnail".into());
        }

        let tpl = self
            .output_template
            .clone()
            .filter(|t| !t.trim().is_empty())
            .unwrap_or_else(|| "%(title)s [%(id)s].%(ext)s".into());
        a.push("-o".into());
        a.push(output_dir.join(tpl).to_string_lossy().into());

        a
    }

    fn format_selector(&self) -> String {
        let (vext, aext) = if self.container == "webm" {
            ("webm", "webm")
        } else {
            ("mp4", "m4a")
        };
        let height = match self.quality.as_str() {
            "2160" => Some(2160),
            "1440" => Some(1440),
            "1080" => Some(1080),
            "720" => Some(720),
            "480" => Some(480),
            "360" => Some(360),
            _ => None, // auto | max
        };
        if self.mode == "videoonly" {
            // Sin pista de audio.
            return match height {
                Some(h) => format!("bestvideo[height<={h}][ext={vext}]/bestvideo[height<={h}]/bestvideo"),
                None => "bestvideo".into(),
            };
        }
        match height {
            Some(h) => format!(
                "bestvideo[height<={h}][ext={vext}]+bestaudio[ext={aext}]/bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
            ),
            None => "bestvideo+bestaudio/best".into(),
        }
    }
}
