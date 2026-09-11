//! Unified registry of active downloads (`DownloadRegistry`), managed as
//! Tauri State. Replaces 3 old statics that left cancels racing spawns.
//!
//! Entries are keyed by a per-run id chosen by the frontend (`<item>:<runSeq>`), never by
//! URL: two runs of the same video cannot collide, and a cancel can only ever hit its own run.
//! Anti-race scheme, all under the SAME map lock: `cancel()` sets the flag and kills the PID
//! if present; `set_pid()` kills the new process on the spot if already cancelled; retries
//! check `is_cancelled()` before each spawn. A cancel that arrives before `begin()` leaves a
//! tombstone that `begin()` consumes.

use std::collections::HashMap;
use std::process::Command;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// State of an in-flight download. `pid` is None in the windows between
/// processes (before the simulation, between attempt and retry).
struct Entry {
    pid: Option<u32>,
    cancelled: bool,
    /// Set when the entry was created by a cancel without a run (tombstone).
    tombstoned_at: Option<Instant>,
}

/// Tombstones whose run never showed up (cancel after finish) are evicted after this.
const TOMBSTONE_TTL: Duration = Duration::from_secs(60);

/// Active-download registry: one entry per run id from `begin()` to `finish()`,
/// covering simulation, download and post-cache retry.
#[derive(Default)]
pub struct DownloadRegistry {
    inner: Mutex<HashMap<String, Entry>>,
}

impl DownloadRegistry {
    /// Anti-poisoning lock: if another thread panicked while holding it, the
    /// map (just ids/pids) is still consistent, so recover it.
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Entry>> {
        let mut map = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        map.retain(|_, e| {
            e.tombstoned_at
                .is_none_or(|at| at.elapsed() <= TOMBSTONE_TTL)
        });
        map
    }

    /// Starts tracking a run. A cancel that arrived first (tombstone) is honoured.
    pub fn begin(&self, run_id: &str) {
        let mut map = self.lock();
        let cancelled = map.remove(run_id).is_some_and(|e| e.cancelled);
        map.insert(
            run_id.to_string(),
            Entry {
                pid: None,
                cancelled,
                tombstoned_at: None,
            },
        );
    }

    /// Registers a freshly spawned PID (download or simulation). If the run was
    /// cancelled meanwhile (or is unknown), kills it right here under the lock.
    pub fn set_pid(&self, run_id: &str, pid: u32) {
        match self.lock().get_mut(run_id) {
            Some(entry) => {
                entry.pid = Some(pid);
                if entry.cancelled {
                    kill_process(pid);
                }
            }
            None => kill_process(pid),
        }
    }

    /// Process ended but the download lives on (e.g. about to retry):
    /// clear the PID, keeping the entry and its `cancelled` flag.
    pub fn clear_pid(&self, run_id: &str) {
        if let Some(entry) = self.lock().get_mut(run_id) {
            entry.pid = None;
        }
    }

    /// Did the user cancel this run? Checked by the simulation and the retry before spawning.
    pub fn is_cancelled(&self, run_id: &str) -> bool {
        self.lock().get(run_id).is_some_and(|e| e.cancelled)
    }

    /// Cancels one run (or every live one if None): sets `cancelled` and kills the PID
    /// if any, under the same lock. An unknown id leaves a tombstone for a `begin()`
    /// still on its way. True if a live run was affected.
    pub fn cancel(&self, run_id: Option<&str>) -> bool {
        let mut map = self.lock();
        match run_id {
            Some(id) => match map.get_mut(id) {
                Some(entry) => {
                    entry.cancelled = true;
                    if let Some(pid) = entry.pid {
                        kill_process(pid);
                    }
                    entry.tombstoned_at.is_none()
                }
                None => {
                    map.insert(
                        id.to_string(),
                        Entry {
                            pid: None,
                            cancelled: true,
                            tombstoned_at: Some(Instant::now()),
                        },
                    );
                    false
                }
            },
            None => {
                let mut any = false;
                for entry in map.values_mut().filter(|e| e.tombstoned_at.is_none()) {
                    any = true;
                    entry.cancelled = true;
                    if let Some(pid) = entry.pid {
                        kill_process(pid);
                    }
                }
                any
            }
        }
    }

    /// End of a run's lifecycle (success or failure): removes the entry.
    pub fn finish(&self, run_id: &str) {
        self.lock().remove(run_id);
    }

    /// App shutdown: kill every live process so no orphan yt-dlp/ffmpeg
    /// keeps downloading in the background.
    pub fn kill_all(&self) {
        for entry in self.lock().values() {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_before_begin_is_honoured_as_a_tombstone() {
        let reg = DownloadRegistry::default();
        assert!(!reg.cancel(Some("q1:1")));
        reg.begin("q1:1");
        assert!(reg.is_cancelled("q1:1"));
    }

    #[test]
    fn a_new_run_of_the_same_item_is_not_affected_by_an_old_cancel() {
        let reg = DownloadRegistry::default();
        reg.begin("q1:1");
        assert!(reg.cancel(Some("q1:1")));
        reg.finish("q1:1");
        reg.cancel(Some("q1:1")); // late cancel for the finished run
        reg.begin("q1:2");
        assert!(!reg.is_cancelled("q1:2"));
    }

    #[test]
    fn two_items_with_the_same_url_are_independent_runs() {
        let reg = DownloadRegistry::default();
        reg.begin("q1:1");
        reg.begin("q2:1");
        assert!(reg.cancel(Some("q1:1")));
        assert!(!reg.is_cancelled("q2:1"));
    }

    #[test]
    fn cancel_all_ignores_tombstones() {
        let reg = DownloadRegistry::default();
        reg.cancel(Some("ghost:1"));
        assert!(!reg.cancel(None));
        reg.begin("live:1");
        assert!(reg.cancel(None));
    }
}
