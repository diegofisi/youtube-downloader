use std::path::Path;

use serde_json::Value;

use super::models::{AnalyzedEntry, PlaylistMeta, VideoMeta};
use crate::core::ytdlp::{classify_error, YtdlpCmd};
use crate::features::session::service as session;

/// Failed analysis: yt-dlp's message plus its class ("auth" when the session was rejected).
pub struct AnalyzeError {
    pub kind: Option<&'static str>,
    pub message: String,
}

/// Entry cap for Mixes/radios (YouTube's infinite auto-generated lists).
const RADIO_CAP: u32 = 25;
/// Cap for account feeds (subscriptions, history): continuous, no real end.
const FEED_CAP: u32 = 50;

/// Result of `analyze`: the entry plus whether the stored cookies had to be dropped
/// because YouTube rejected them (the frontend then renews the session).
pub struct Analysis {
    pub entry: AnalyzedEntry,
    pub session_rejected: bool,
}

/// Analyzes a URL (single video or playlist/channel), resolving metadata with yt-dlp.
/// `range`: 1-based (start, end) mapped to `--playlist-items START:END`; `None` applies the default caps.
pub fn analyze(
    app_dir: &Path,
    url: &str,
    range: Option<(u32, u32)>,
) -> Result<Analysis, AnalyzeError> {
    // Mix/radio (list=RD…, start_radio): infinite → cap at 25 like YouTube. Account
    // feeds (/feed/...): continuous → cap at 50. Real playlists/channels: no cap.
    let is_radio = url.contains("list=RD") || url.contains("start_radio=");
    let is_feed = url.contains("/feed/");
    let cap = if is_radio {
        Some(RADIO_CAP)
    } else if is_feed {
        Some(FEED_CAP)
    } else {
        None
    };
    let cookies = session::get_cookies_path(app_dir);
    match run_dump_json(app_dir, url, cap, range, true) {
        Ok(json) => Ok(Analysis {
            entry: map_entry(&json, url),
            session_rejected: false,
        }),
        // Stale cookies are rejected server-side even before they expire; a public URL
        // still resolves without them, so retry cookie-less and report the rejection.
        Err(e) if e.kind == Some("auth") && cookies.exists() => {
            eprintln!(
                "[preview] Sesión rechazada por YouTube; reintento sin cookies: {}",
                url
            );
            match run_dump_json(app_dir, url, cap, range, false) {
                Ok(json) => Ok(Analysis {
                    entry: map_entry(&json, url),
                    session_rejected: true,
                }),
                Err(_) => Err(e),
            }
        }
        Err(e) => Err(e),
    }
}

/// Error entry for a failed URL. The frontend reads the class from the `availability` prefix
/// (`error: …` generic, `error:auth: …` session rejected): legacy `VideoMeta` stays untouched.
pub fn error_entry(url: &str, err: &AnalyzeError) -> AnalyzedEntry {
    let availability = match err.kind {
        Some("auth") => format!("error:auth: {}", err.message),
        _ => format!("error: {}", err.message),
    };
    AnalyzedEntry::Video(VideoMeta {
        id: String::new(),
        url: url.to_string(),
        title: url.to_string(),
        channel: String::new(),
        duration: None,
        thumbnail: None,
        view_count: None,
        availability: Some(availability),
        size_bytes: None,
        playlist_count: None,
        flat: false,
        is_playlist: false,
    })
}

fn run_dump_json(
    app_dir: &Path,
    url: &str,
    cap: Option<u32>,
    range: Option<(u32, u32)>,
    use_cookies: bool,
) -> Result<Value, AnalyzeError> {
    // The builder resolves the binary and adds --encoding utf-8 and `-- <url>`.
    let mut builder = YtdlpCmd::new(app_dir, url)
        .arg("-J")
        .arg("--flat-playlist")
        .no_warnings()
        .no_update();

    if let Some((start, end)) = range {
        // Explicit range (frontend pagination): replaces the fixed cap.
        builder = builder
            .arg("--playlist-items")
            .arg(format!("{}:{}", start, end));
    } else if let Some(c) = cap {
        builder = builder.arg("--playlist-end").arg(c.to_string());
    }

    // Cookies by default (if present): previews benefit from the session for
    // private/members-only content; `analyze` drops them once YouTube rejects them.
    builder = builder.deno_runtime();
    if use_cookies {
        builder = builder.cookies(&session::get_cookies_path(app_dir));
    }

    let mut run = builder.build();
    let out = run.output().map_err(|e| AnalyzeError {
        kind: None,
        message: format!("No se pudo ejecutar yt-dlp: {}", e),
    })?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err
            .lines()
            .find(|l| l.trim_start().starts_with("ERROR:"))
            .map(|l| l.trim().trim_start_matches("ERROR:").trim().to_string())
            .unwrap_or_else(|| "No se pudo analizar la URL".into());
        eprintln!("[preview] yt-dlp falló para {}: {}", url, msg);
        return Err(AnalyzeError {
            kind: classify_error(&msg),
            message: msg,
        });
    }

    serde_json::from_slice(&out.stdout).map_err(|e| AnalyzeError {
        kind: None,
        message: format!("JSON inválido de yt-dlp: {}", e),
    })
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
        playlist_count: v.get("playlist_count").and_then(|x| x.as_u64()),
        flat: false,
        is_playlist: false,
    }
}

/// "Flat" playlist entry (formats/thumbnail/size not resolved).
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
        playlist_count: v.get("playlist_count").and_then(|x| x.as_u64()),
        flat: true,
        // Flat entries pointing at another playlist (e.g. /feed/playlists).
        is_playlist: v.get("ie_key").and_then(|x| x.as_str()) == Some("YoutubeTab"),
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
    for key in [
        "channel",
        "uploader",
        "playlist_uploader",
        "playlist_channel",
    ] {
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
    // last thumbnail in the array (highest resolution)
    v.get("thumbnails")
        .and_then(|x| x.as_array())
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
}

/// Rough size estimate: best video-only (<=1080) + best audio-only.
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

#[cfg(test)]
mod tests {
    use super::*;

    fn availability_of(entry: AnalyzedEntry) -> String {
        match entry {
            AnalyzedEntry::Video(v) => v.availability.unwrap_or_default(),
            AnalyzedEntry::Playlist(_) => panic!("error_entry must be a Video"),
        }
    }

    #[test]
    fn error_entry_generic_uses_error_prefix() {
        let err = AnalyzeError {
            kind: None,
            message: "Video unavailable".into(),
        };
        assert_eq!(
            availability_of(error_entry("https://youtu.be/x", &err)),
            "error: Video unavailable"
        );
    }

    #[test]
    fn error_entry_auth_uses_error_auth_prefix() {
        let err = AnalyzeError {
            kind: Some("auth"),
            message: "cookies are no longer valid".into(),
        };
        let entry = error_entry("https://youtu.be/x", &err);
        let AnalyzedEntry::Video(ref v) = entry else {
            panic!()
        };
        assert!(v.id.is_empty(), "an error entry has no id");
        assert_eq!(
            availability_of(entry),
            "error:auth: cookies are no longer valid"
        );
    }

    #[test]
    fn error_entry_cache_is_treated_as_generic() {
        let err = AnalyzeError {
            kind: Some("cache"),
            message: "HTTP Error 403".into(),
        };
        assert_eq!(
            availability_of(error_entry("u", &err)),
            "error: HTTP Error 403"
        );
    }
}
