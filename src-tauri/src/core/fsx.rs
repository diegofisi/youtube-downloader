//! Utilidades de sistema de archivos transversales.
use std::fs;
use std::io;
use std::path::Path;

/// Escritura atómica: vuelca a "<archivo>.tmp" junto al destino y renombra.
/// Un corte a mitad de escritura deja el archivo original intacto (nunca un
/// JSON/cookies a medias). En Windows y Unix `rename` reemplaza el destino.
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
