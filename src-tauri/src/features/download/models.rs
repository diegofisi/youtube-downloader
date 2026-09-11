use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::core::ytdlp::is_safe_output_template;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Failure class: "auth" (session/cookies), "cache" (HTTP 403 persisting
    /// after a cache clear) or "other". Reaches the frontend as `errorKind`.
    #[serde(rename = "errorKind", skip_serializing_if = "Option::is_none")]
    pub error_kind: Option<String>,
    /// Absolute path of the downloaded file (captured via
    /// `--print after_move:filepath`). None if it couldn't be captured.
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

pub const UNSAFE_TEMPLATE_MSG: &str =
    "Plantilla de nombre inválida: debe ser relativa a la carpeta de descargas (sin ruta absoluta ni \"..\").";

/// Download options (sent from the frontend in camelCase).
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
    /// kbps (0 = default)
    pub audio_bitrate: u32,
    pub subtitles: bool,
    /// comma-separated languages, e.g. "es,en"
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
    /// Translates the options into yt-dlp args (without the common ones the service adds).
    pub fn to_ytdlp_args(&self, output_dir: &Path) -> Vec<String> {
        let mut a: Vec<String> = Vec::new();

        if self.mode == "audio" {
            // Without -f yt-dlp fetches the full video (bestvideo+bestaudio) just to drop it.
            a.push("-f".into());
            a.push("bestaudio/best".into());
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
        // "videoonly" is handled inside format_selector.

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

        // yt-dlp's EmbedThumbnail has no webm support: it would fail the whole download.
        if self.embed_thumbnail && !(self.mode != "audio" && self.container == "webm") {
            a.push("--embed-thumbnail".into());
        }

        a.push("-o".into());
        a.push(
            output_dir
                .join(self.effective_template())
                .to_string_lossy()
                .into(),
        );

        a
    }

    /// The user's template (trimmed), or the default when empty, always ending in `.%(ext)s`:
    /// without it a single-format run (video only) writes a file with no extension.
    pub fn effective_template(&self) -> String {
        let tpl = match self.output_template.as_deref().map(str::trim) {
            Some(t) if !t.is_empty() => t.to_string(),
            _ => "%(title)s [%(id)s]".to_string(),
        };
        if tpl.ends_with(".%(ext)s") {
            tpl
        } else {
            format!("{}.%(ext)s", tpl)
        }
    }

    /// Rejects options that must not reach yt-dlp (product copy: the queue shows it as the error).
    pub fn validate(&self) -> Result<(), String> {
        if !is_safe_output_template(&self.effective_template()) {
            return Err(UNSAFE_TEMPLATE_MSG.into());
        }
        Ok(())
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
            // No audio track.
            return match height {
                Some(h) => {
                    format!("bestvideo[height<={h}][ext={vext}]/bestvideo[height<={h}]/bestvideo")
                }
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

#[cfg(test)]
mod tests {
    use super::DownloadOptions;

    fn with_template(t: Option<&str>) -> DownloadOptions {
        DownloadOptions {
            output_template: t.map(str::to_string),
            ..DownloadOptions::default()
        }
    }

    #[test]
    fn effective_template_always_carries_the_extension_placeholder() {
        assert_eq!(
            with_template(None).effective_template(),
            "%(title)s [%(id)s].%(ext)s"
        );
        assert_eq!(
            with_template(Some("%(title)s [%(id)s]")).effective_template(),
            "%(title)s [%(id)s].%(ext)s"
        );
        assert_eq!(
            with_template(Some("  %(uploader)s/%(title)s.%(ext)s ")).effective_template(),
            "%(uploader)s/%(title)s.%(ext)s"
        );
        // %(ext)s used as a folder still needs the file extension at the end.
        assert_eq!(
            with_template(Some("%(ext)s/%(title)s")).effective_template(),
            "%(ext)s/%(title)s.%(ext)s"
        );
    }

    #[test]
    fn webm_video_never_embeds_the_thumbnail() {
        let mut o = DownloadOptions::default();
        o.embed_thumbnail = true;
        o.container = "webm".into();
        let args = o.to_ytdlp_args(std::path::Path::new("."));
        assert!(!args.iter().any(|a| a == "--embed-thumbnail"));
        o.container = "mp4".into();
        let args = o.to_ytdlp_args(std::path::Path::new("."));
        assert!(args.iter().any(|a| a == "--embed-thumbnail"));
    }

    #[test]
    fn audio_mode_requests_audio_only_formats() {
        let mut o = DownloadOptions::default();
        o.mode = "audio".into();
        let args = o.to_ytdlp_args(std::path::Path::new("."));
        let pos = args.iter().position(|a| a == "-f").unwrap();
        assert_eq!(args[pos + 1], "bestaudio/best");
    }
}
