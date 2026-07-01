//! Registro de procesos de descarga activos + cancelación por PID.
//! Generaliza el antiguo `ACTIVE_PROCESSES` de download_service.
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static ACTIVE_PROCESSES: Mutex<Option<HashMap<String, u32>>> = Mutex::new(None);

pub fn register(url: &str, pid: u32) {
    let mut guard = ACTIVE_PROCESSES.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(url.to_string(), pid);
}

pub fn unregister(url: &str) {
    let mut guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        map.remove(url);
    }
}

pub fn kill_by_url(url: &str) -> bool {
    let guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        if let Some(&pid) = map.get(url) {
            kill_process(pid);
            return true;
        }
    }
    false
}

pub fn kill_all() -> bool {
    let guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        for &pid in map.values() {
            kill_process(pid);
        }
        return !map.is_empty();
    }
    false
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/F", "/PID", &pid.to_string()]);
        cmd.creation_flags(0x08000000);
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
