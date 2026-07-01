use std::path::Path;
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde_json::Value;

use super::models::{AnalyzedEntry, PlaylistMeta, VideoMeta};
use crate::core::paths;
use crate::features::session::service as session;

/// Analiza una URL (video suelto o playlist/canal) resolviendo metadatos con yt-dlp.
pub fn analyze(app_dir: &Path, url: &str) -> Result<AnalyzedEntry, String> {
    let json = run_dump_json(app_dir, url)?;
    Ok(map_entry(&json, url))
}

fn run_dump_json(app_dir: &Path, url: &str) -> Result<Value, String> {
    let ytdlp = paths::find_executable(app_dir, "yt-dlp")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "yt-dlp".into());

    let mut args: Vec<String> = vec![
        "-J".into(),
        "--flat-playlist".into(),
        "--no-warnings".into(),
        "--no-update".into(),
    ];

    if let Some(deno) = paths::find_executable(app_dir, "deno") {
        args.push("--extractor-args".into());
        args.push(format!("youtube:js_runtimes=deno:{}", deno.to_string_lossy()));
    }

    let cookies = session::get_cookies_path(app_dir);
    if cookies.exists() {
        args.push("--cookies".into());
        args.push(cookies.to_string_lossy().into());
    }

    args.push(url.into());

    let mut cmd = Command::new(&ytdlp);
    cmd.args(&args).stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let out = cmd
        .output()
        .map_err(|e| format!("No se pudo ejecutar yt-dlp: {}", e))?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err
            .lines()
            .find(|l| l.trim_start().starts_with("ERROR:"))
            .map(|l| l.trim().trim_start_matches("ERROR:").trim().to_string())
            .unwrap_or_else(|| "No se pudo analizar la URL".into());
        return Err(msg);
    }

    serde_json::from_slice(&out.stdout).map_err(|e| format!("JSON inválido de yt-dlp: {}", e))
}

fn map_entry(v: &Value, url: &str) -> AnalyzedEntry {
    let is_playlist =
        v.get("_type").and_then(|t| t.as_str()) == Some("playlist") || v.get("entries").is_some();

    if is_playlist {
        let entries: Vec<VideoMeta> = v
            .get("entries")
            .and_then(|e| e.as_array())
            .map(|arr| arr.iter().filter_map(flat_video).collect())
            .unwrap_or_default();

        AnalyzedEntry::Playlist(PlaylistMeta {
            id: str_field(v, "id"),
            url: url.to_string(),
            title: str_field_or(v, "title", "Playlist"),
            channel: channel_field(v),
            count: entries.len(),
            entries,
            is_playlist: true,
        })
    } else {
        AnalyzedEntry::Video(full_video(v, url))
    }
}

fn full_video(v: &Value, url: &str) -> VideoMeta {
    VideoMeta {
        id: str_field(v, "id"),
        url: v
            .get("webpage_url")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| url.to_string()),
        title: str_field_or(v, "title", "(sin título)"),
        channel: channel_field(v),
        duration: v.get("duration").and_then(|x| x.as_f64()),
        thumbnail: thumbnail_field(v),
        view_count: v.get("view_count").and_then(|x| x.as_u64()),
        availability: v
            .get("availability")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        size_bytes: estimate_size(v),
        flat: false,
        is_playlist: false,
    }
}

/// Entrada "plana" de una playlist (sin formats/thumbnail/size resueltos).
fn flat_video(v: &Value) -> Option<VideoMeta> {
    let id = str_field(v, "id");
    if id.is_empty() {
        return None;
    }
    let url = v
        .get("url")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", id));

    Some(VideoMeta {
        id,
        url,
        title: str_field_or(v, "title", "(sin título)"),
        channel: channel_field(v),
        duration: v.get("duration").and_then(|x| x.as_f64()),
        thumbnail: thumbnail_field(v),
        view_count: v.get("view_count").and_then(|x| x.as_u64()),
        availability: v
            .get("availability")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        size_bytes: None,
        flat: true,
        is_playlist: false,
    })
}

fn str_field(v: &Value, key: &str) -> String {
    v.get(key)
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

fn str_field_or(v: &Value, key: &str, default: &str) -> String {
    let s = str_field(v, key);
    if s.is_empty() {
        default.to_string()
    } else {
        s
    }
}

fn channel_field(v: &Value) -> String {
    for key in ["channel", "uploader", "playlist_uploader", "playlist_channel"] {
        let s = str_field(v, key);
        if !s.is_empty() {
            return s;
        }
    }
    String::new()
}

fn thumbnail_field(v: &Value) -> Option<String> {
    if let Some(t) = v.get("thumbnail").and_then(|x| x.as_str()) {
        return Some(t.to_string());
    }
    // último thumbnail del array (mayor resolución)
    v.get("thumbnails")
        .and_then(|x| x.as_array())
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
}

/// Estimación aproximada de tamaño: mejor video-only (<=1080) + mejor audio-only.
fn estimate_size(v: &Value) -> Option<u64> {
    let formats = v.get("formats")?.as_array()?;

    let mut best_progressive: Option<u64> = None;
    let mut best_video: Option<u64> = None;
    let mut best_audio: Option<u64> = None;

    for f in formats {
        let vcodec = f.get("vcodec").and_then(|x| x.as_str()).unwrap_or("none");
        let acodec = f.get("acodec").and_then(|x| x.as_str()).unwrap_or("none");
        let height = f.get("height").and_then(|x| x.as_u64()).unwrap_or(0);
        let size = f
            .get("filesize")
            .and_then(|x| x.as_u64())
            .or_else(|| f.get("filesize_approx").and_then(|x| x.as_u64()));

        let Some(sz) = size else { continue };

        if vcodec != "none" && acodec != "none" {
            best_progressive = Some(best_progressive.map_or(sz, |b| b.max(sz)));
        } else if vcodec != "none" && height <= 1080 {
            best_video = Some(best_video.map_or(sz, |b| b.max(sz)));
        } else if acodec != "none" {
            best_audio = Some(best_audio.map_or(sz, |b| b.max(sz)));
        }
    }

    match (best_video, best_audio) {
        (Some(vsz), Some(asz)) => Some(vsz + asz),
        _ => best_progressive.or(best_video),
    }
}
