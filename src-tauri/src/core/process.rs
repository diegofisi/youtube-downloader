//! Registro unificado de descargas activas (`DownloadRegistry`), gestionado
//! como Tauri State (`app.manage()` en main.rs) y accedido vía `State<>`.
//!
//! Sustituye a los 3 statics antiguos (ACTIVE_PROCESSES aquí + CANCELLED_URLS
//! y ACTIVE_URLS en download::service), que llevaban doble contabilidad y
//! dejaban una race: entre el fin de un proceso y el spawn del siguiente
//! (reintento post-cache, o durante la simulación de nombre) no había PID
//! registrado y un cancel en esa ventana no mataba nada.
//!
//! Esquema anti-race (todo bajo el MISMO lock del mapa):
//! - `cancel()` marca `cancelled = true` y mata el PID si lo hay.
//! - `set_pid()` registra el PID recién lanzado y, si la entrada ya estaba
//!   cancelada, mata el proceso ahí mismo antes de soltar el lock.
//! - El reintento consulta `is_cancelled()` antes de cada spawn.
//!
//! Así, o el cancel ve el PID (y lo mata), o el spawn ve el cancel (y se mata
//! a sí mismo al registrarse): no queda ventana sin cobertura.

use std::collections::HashMap;
use std::process::Command;
use std::sync::{Mutex, MutexGuard};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Estado de una descarga en curso. `pid` es None en las ventanas entre
/// procesos (antes de la simulación, entre intento y reintento).
#[derive(Default)]
struct Entry {
    pid: Option<u32>,
    cancelled: bool,
}

/// Registro de descargas activas: una entrada por URL desde `begin()` hasta
/// `finish()`, cubriendo simulación, descarga y reintento post-cache.
#[derive(Default)]
pub struct DownloadRegistry {
    inner: Mutex<HashMap<String, Entry>>,
}

impl DownloadRegistry {
    /// Lock anti-poisoning: si otro hilo panicó con el lock tomado, el mapa
    /// sigue siendo consistente (solo urls/pids), así que lo recuperamos.
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Entry>> {
        self.inner.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// Inicia el seguimiento de una URL. Resetea un `cancelled` residual de
    /// un intento anterior (equivalente al antiguo track_start).
    pub fn begin(&self, url: &str) {
        self.lock().insert(url.to_string(), Entry::default());
    }

    /// Asocia el PID de un proceso recién lanzado (descarga o simulación).
    /// Si la URL fue cancelada mientras no había proceso, lo mata aquí mismo
    /// bajo el lock: el cancel "alcanza" al proceso nacido tarde.
    pub fn set_pid(&self, url: &str, pid: u32) {
        let mut map = self.lock();
        let entry = map.entry(url.to_string()).or_default();
        entry.pid = Some(pid);
        if entry.cancelled {
            kill_process(pid);
        }
    }

    /// El proceso terminó pero la descarga sigue viva (p. ej. va a reintentar):
    /// se limpia el PID conservando la entrada y su flag `cancelled`.
    pub fn clear_pid(&self, url: &str) {
        if let Some(entry) = self.lock().get_mut(url) {
            entry.pid = None;
        }
    }

    /// ¿El usuario canceló esta URL? Lo consultan la simulación y el
    /// reintento antes de lanzar un nuevo proceso.
    pub fn is_cancelled(&self, url: &str) -> bool {
        self.lock().get(url).map(|e| e.cancelled).unwrap_or(false)
    }

    /// Cancela una URL (o todas las activas si `url` es None): marca
    /// `cancelled` y mata el PID si existe, bajo el mismo lock.
    /// Devuelve true si había alguna descarga activa afectada.
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

    /// Fin del ciclo de vida de una descarga (éxito o fallo): elimina la entrada.
    pub fn finish(&self, url: &str) {
        self.lock().remove(url);
    }

    /// Cierre de la app: mata todos los procesos vivos para no dejar
    /// yt-dlp/ffmpeg huérfanos descargando en segundo plano.
    pub fn kill_all(&self) {
        let map = self.lock();
        for entry in map.values() {
            if let Some(pid) = entry.pid {
                kill_process(pid);
            }
        }
    }
}

/// Evita el flash de consola en Windows (no-op en otros SO). Único punto
/// donde vive CREATE_NO_WINDOW.
pub fn hide_console(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    #[cfg(not(target_os = "windows"))]
    let _ = cmd;
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        // /T mata también los hijos (ffmpeg lanzado por yt-dlp para merge/extraccion).
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
