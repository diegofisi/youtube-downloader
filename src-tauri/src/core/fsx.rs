//! Cross-cutting filesystem utilities.
use std::fs;
use std::io;
use std::path::Path;

/// Atomic write: dump to "<file>.tmp" next to the target, then rename, so a
/// mid-write crash never leaves a half-written file. `rename` replaces the target on Windows and Unix.
pub fn write_atomic(path: &Path, content: impl AsRef<[u8]>) -> io::Result<()> {
    let mut name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(".tmp");
    let tmp = path.with_file_name(name);
    fs::write(&tmp, content.as_ref())?;
    fs::rename(&tmp, path)
}
