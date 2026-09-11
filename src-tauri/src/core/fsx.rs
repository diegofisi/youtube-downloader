//! Cross-cutting filesystem utilities.
use std::fs;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// Atomic write: dump to a per-writer "<file>.<pid>-<n>.tmp" next to the target, then rename,
/// so a mid-write crash never leaves a half-written file and concurrent writers never share a tmp.
pub fn write_atomic(path: &Path, content: impl AsRef<[u8]>) -> io::Result<()> {
    let mut name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(format!(
        ".{}-{}.tmp",
        std::process::id(),
        TMP_SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    let tmp = path.with_file_name(name);
    fs::write(&tmp, content.as_ref())?;
    fs::rename(&tmp, path).inspect_err(|_| {
        fs::remove_file(&tmp).ok();
    })
}

/// Files older than this are considered leftovers of a dead process; younger ones may
/// belong to a second running instance (no single-instance guard) and are left alone.
const STALE_AGE: std::time::Duration = std::time::Duration::from_secs(60 * 60);

/// Removes files in `dir` matching `pred` that are older than `STALE_AGE`.
pub fn remove_stale(dir: &Path, pred: impl Fn(&str) -> bool) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !pred(&name) {
            continue;
        }
        let old = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.elapsed().ok())
            .is_some_and(|age| age > STALE_AGE);
        if old {
            fs::remove_file(entry.path()).ok();
        }
    }
}

/// Removes `*.tmp` leftovers of previous processes (crash between write and rename).
pub fn clean_stale_temps(dir: &Path) {
    remove_stale(dir, |name| name.ends_with(".tmp"));
}
