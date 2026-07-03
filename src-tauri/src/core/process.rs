//! Unified registry of active downloads (`DownloadRegistry`), managed as
//! Tauri State. Replaces 3 old statics that left cancels racing spawns.
//!
//! Anti-race scheme, all under the SAME map lock: `cancel()` sets the flag and
//! kills the PID if present; `set_pid()` kills the new process on the spot if
//! already cancelled; retries check `is_cancelled()` before each spawn.
//! Either cancel sees the PID or the spawn sees the cancel: no uncovered window.

use std::collections::HashMap;
use std::process::Command;
use std::sync::{Mutex, MutexGuard};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// State of an in-flight download. `pid` is None in the windows between
/// processes (before the simulation, between attempt and retry).
#[derive(Default)]
struct Entry {
    pid: Option<u32>,
    cancelled: bool,
}

/// Active-download registry: one entry per URL from `begin()` to `finish()`,
/// covering simulation, download and post-cache retry.
#[derive(Default)]
pub struct DownloadRegistry {
    inner: Mutex<HashMap<String, Entry>>,
}

impl DownloadRegistry {
    /// Anti-poisoning lock: if another thread panicked while holding it, the
    /// map (just urls/pids) is still consistent, so recover it.
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Entry>> {
        self.inner.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// Starts tracking a URL; resets any stale `cancelled` flag from a previous attempt.
    pub fn begin(&self, url: &str) {
        self.lock().insert(url.to_string(), Entry::default());
    }

    /// Registers a freshly spawned PID (download or simulation). If the URL was
    /// cancelled while no process existed, kills it right here under the lock.
    pub fn set_pid(&self, url: &str, pid: u32) {
        let mut map = self.lock();
        let entry = map.entry(url.to_string()).or_default();
        entry.pid = Some(pid);
        if entry.cancelled {
            kill_process(pid);
        }
    }

    /// Process ended but the download lives on (e.g. about to retry):
    /// clear the PID, keeping the entry and its `cancelled` flag.
    pub fn clear_pid(&self, url: &str) {
        if let Some(entry) = self.lock().get_mut(url) {
            entry.pid = None;
        }
    }

    /// Did the user cancel this URL? Checked by the simulation and the retry
    /// before spawning a new process.
    pub fn is_cancelled(&self, url: &str) -> bool {
        self.lock().get(url).map(|e| e.cancelled).unwrap_or(false)
    }

    /// Cancels one URL (or all active ones if None): sets `cancelled` and kills
    /// the PID if any, under the same lock. True if any active download was affected.
    pub fn cancel(&self, url: Option<&str>) -> bool {
        let mut map = self.lock();
        match url {
            Some(u) => match map.get_mut(u) {
                Some(entry) => {
                    entry.cancelled = true;
                    if let Some(pid) = entry.pid {
                        kill_process(pid);
                    }
                    true
                }
                None => false,
            },
            None => {
                let any = !map.is_empty();
                for entry in map.values_mut() {
                    entry.cancelled = true;
                    if let Some(pid) = entry.pid {
                        kill_process(pid);
                    }
                }
                any
            }
        }
    }

    /// End of a download's lifecycle (success or failure): removes the entry.
    pub fn finish(&self, url: &str) {
        self.lock().remove(url);
    }

    /// App shutdown: kill every live process so no orphan yt-dlp/ffmpeg
    /// keeps downloading in the background.
    pub fn kill_all(&self) {
        let map = self.lock();
        for entry in map.values() {
            if let Some(pid) = entry.pid {
                kill_process(pid);
            }
        }
    }
}

/// Prevents the console flash on Windows (no-op elsewhere).
/// Sole home of CREATE_NO_WINDOW.
pub fn hide_console(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    #[cfg(not(target_os = "windows"))]
    let _ = cmd;
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        // /T also kills children (ffmpeg spawned by yt-dlp for merge/extraction).
        let mut cmd = Command::new("taskkill");
        cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
        hide_console(&mut cmd);
        cmd.spawn().ok();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("kill")
            .args(["-9", &pid.to_string()])
            .spawn()
            .ok();
    }
}
