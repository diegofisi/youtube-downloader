use std::fs;
use std::path::{Path, PathBuf};

use sha1::{Digest, Sha1};

use super::models::AccountInfo;

/// User-Agent de navegador: única fuente, compartida por las ventanas de
/// login (commands) y las peticiones autenticadas de este service.
pub const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

pub fn get_cookies_path(app_dir: &Path) -> PathBuf {
    app_dir.join("cookies.txt")
}

/// Cookie de un cookies.txt en formato Netscape (solo los campos que usamos).
struct CookieRecord<'a> {
    domain: &'a str,
    name: &'a str,
    value: &'a str,
    /// Timestamp unix de expiración (0 = cookie de sesión / sin fecha).
    expiry: i64,
}

/// Parser único del formato Netscape: línea → strip `#HttpOnly_` → split por
/// tabs → 7+ campos. `session_status` y `parse_auth_cookies` son filtros
/// sobre este iterador (antes duplicaban el bucle).
fn parse_netscape(content: &str) -> impl Iterator<Item = CookieRecord<'_>> {
    content.lines().filter_map(|raw| {
        let line = raw.trim();
        if line.is_empty() {
            return None;
        }
        let line = line.strip_prefix("#HttpOnly_").unwrap_or(line);
        if line.starts_with('#') {
            return None;
        }
        let f: Vec<&str> = line.split('\t').collect();
        if f.len() < 7 {
            return None;
        }
        Some(CookieRecord {
            domain: f[0],
            name: f[5],
            value: f[6],
            expiry: f[4].parse().unwrap_or(0),
        })
    })
}

/// Estado REAL de la sesión de YouTube según cookies.txt:
/// - "connected": hay cookies de autenticación fuertes en `.youtube.com` y vigentes.
/// - "expired": hay cookies de YouTube pero la auth falta o venció (re-login necesario).
/// - "none": no hay archivo o no hay nada de YouTube.
///
/// Nota: exports del navegador suelen traer SAPISID solo en `.google.com`; yt-dlp
/// necesita la auth en `.youtube.com`, por eso se valida ese dominio en concreto.
pub fn session_status(app_dir: &Path) -> &'static str {
    let path = get_cookies_path(app_dir);
    let Ok(content) = fs::read_to_string(&path) else {
        return "none";
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    const STRONG: [&str; 4] = ["SAPISID", "__Secure-3PAPISID", "LOGIN_INFO", "SSID"];
    let mut has_any_yt = false;
    let mut strong_valid = false;
    let mut strong_expired = false;

    for c in parse_netscape(&content) {
        if !c.domain.contains("youtube.com") {
            continue;
        }
        has_any_yt = true;
        if STRONG.contains(&c.name) {
            if c.expiry != 0 && c.expiry < now {
                strong_expired = true;
            } else {
                strong_valid = true;
            }
        }
    }

    if strong_valid {
        "connected"
    } else if has_any_yt || strong_expired {
        "expired"
    } else {
        "none"
    }
}

/// Parsea cookies.txt (formato Netscape) y devuelve:
/// - el header `Cookie` con las cookies de youtube.com ÚNICAMENTE (mezclar las
///   de google.com hace que YouTube degrade la respuesta de account_menu: a
///   veces sin foto, a veces sin cuenta — verificado empíricamente), y
/// - el valor de SAPISID (o __Secure-3PAPISID) para firmar SAPISIDHASH.
fn parse_auth_cookies(content: &str) -> (String, Option<String>) {
    let mut pairs: Vec<(String, String)> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut sapisid: Option<String> = None;

    for c in parse_netscape(content) {
        if !c.domain.contains("youtube.com") {
            continue;
        }
        if seen.insert(c.name.to_string()) {
            pairs.push((c.name.to_string(), c.value.to_string()));
        }
        if (c.name == "SAPISID" || c.name == "__Secure-3PAPISID") && sapisid.is_none() {
            sapisid = Some(c.value.to_string());
        }
    }

    let header = pairs
        .iter()
        .map(|(n, v)| format!("{}={}", n, v))
        .collect::<Vec<_>>()
        .join("; ");
    (header, sapisid)
}

/// Firma SAPISIDHASH: SHA1("<ts> <SAPISID> https://www.youtube.com") en hex.
fn sapisidhash(sapisid: &str, origin: &str) -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = Sha1::new();
    hasher.update(format!("{} {} {}", ts, sapisid, origin).as_bytes());
    let hex: String = hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect();
    format!("SAPISIDHASH {}_{}", ts, hex)
}

/// Consulta el endpoint interno `account_menu` de YouTube para obtener nombre,
/// handle y avatar de la cuenta conectada (autenticado con SAPISIDHASH).
///
/// Devuelve Ok(None) sin ruido si no hay cookies/SAPISID o la respuesta no
/// trae cuenta. Solo es Err ante fallos inesperados de red/parseo.
pub fn get_account_info(app_dir: &Path) -> Result<Option<AccountInfo>, String> {
    let path = get_cookies_path(app_dir);
    let Ok(content) = fs::read_to_string(&path) else {
        return Ok(None);
    };
    let (cookie_header, sapisid) = parse_auth_cookies(&content);
    let Some(sapisid) = sapisid else {
        return Ok(None);
    };

    const ORIGIN: &str = "https://www.youtube.com";
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("No se pudo crear el cliente HTTP: {}", e))?;

    let resp = client
        .post("https://www.youtube.com/youtubei/v1/account/account_menu?prettyPrint=false")
        .header("Authorization", sapisidhash(&sapisid, ORIGIN))
        .header("Cookie", cookie_header)
        .header("Content-Type", "application/json")
        .header("Origin", ORIGIN)
        .header("X-Origin", ORIGIN)
        .header("User-Agent", BROWSER_UA)
        .body(r#"{"context":{"client":{"clientName":"WEB","clientVersion":"2.20250101.00.00"}}}"#)
        .send()
        .map_err(|e| format!("No se pudo consultar la cuenta: {}", e))?;

    if !resp.status().is_success() {
        // 401/403 etc.: sesión inválida — la UI genérica sigue funcionando.
        return Ok(None);
    }

    let body = resp
        .text()
        .map_err(|e| format!("Respuesta de cuenta ilegible: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Respuesta de cuenta ilegible: {}", e))?;

    // Rutas verificadas empíricamente (2026-07):
    // actions[0].openPopupAction.popup.multiPageMenuRenderer.header.activeAccountHeaderRenderer
    //   .accountName.simpleText / .channelHandle.simpleText / .accountPhoto.thumbnails[N].url
    let Some(header) = json.pointer(
        "/actions/0/openPopupAction/popup/multiPageMenuRenderer/header/activeAccountHeaderRenderer",
    ) else {
        return Ok(None);
    };

    let Some(name) = header
        .pointer("/accountName/simpleText")
        .and_then(|v| v.as_str())
    else {
        return Ok(None);
    };

    let handle = header
        .pointer("/channelHandle/simpleText")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    // Thumbnail de ~88px o más: el más pequeño que llegue a 88, o el mayor disponible.
    let avatar_url = header
        .pointer("/accountPhoto/thumbnails")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            let mut cands: Vec<(u64, &str)> = arr
                .iter()
                .filter_map(|t| {
                    let url = t.get("url")?.as_str()?;
                    let w = t.get("width").and_then(|w| w.as_u64()).unwrap_or(0);
                    Some((w, url))
                })
                .collect();
            cands.sort_by_key(|(w, _)| *w);
            cands
                .iter()
                .find(|(w, _)| *w >= 88)
                .or_else(|| cands.last())
                .map(|(_, u)| u.to_string())
        });

    // Entregar la foto como data URL (descargada aquí, en base64): así el
    // webview no depende de cargar yt3.ggpht.com por su cuenta (origen/referer).
    // Si la descarga falla, se devuelve la URL cruda como último recurso.
    let avatar_url = avatar_url.map(|u| fetch_as_data_url(&client, &u).unwrap_or(u));

    Ok(Some(AccountInfo {
        name: name.to_string(),
        handle,
        avatar_url,
    }))
}

/// Descarga una imagen y la devuelve como data URL base64 (None si falla).
fn fetch_as_data_url(client: &reqwest::blocking::Client, url: &str) -> Option<String> {
    use base64::Engine;
    let resp = client.get(url).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = resp.bytes().ok()?;
    // Un avatar pesa unos KB; 2 MB de tope por sanidad.
    if bytes.is_empty() || bytes.len() > 2 * 1024 * 1024 {
        return None;
    }
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", content_type, b64))
}

/// Cierra la sesión eliminando cookies.txt.
pub fn logout(app_dir: &Path) -> Result<(), String> {
    let path = get_cookies_path(app_dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("No se pudo borrar cookies.txt: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Línea Netscape válida: domain, flag, path, secure, expiry, name, value.
    fn linea(domain: &str, expiry: &str, name: &str, value: &str) -> String {
        format!("{}\tTRUE\t/\tTRUE\t{}\t{}\t{}", domain, expiry, name, value)
    }

    // ---------- parse_netscape ----------

    #[test]
    fn parse_netscape_extrae_los_campos_de_una_linea_valida() {
        let contenido = linea(".youtube.com", "1900000000", "SAPISID", "abc123");
        let cookies: Vec<_> = parse_netscape(&contenido).collect();
        assert_eq!(cookies.len(), 1);
        assert_eq!(cookies[0].domain, ".youtube.com");
        assert_eq!(cookies[0].name, "SAPISID");
        assert_eq!(cookies[0].value, "abc123");
        assert_eq!(cookies[0].expiry, 1900000000);
    }

    #[test]
    fn parse_netscape_acepta_lineas_httponly() {
        let contenido = format!(
            "#HttpOnly_{}",
            linea(".youtube.com", "0", "LOGIN_INFO", "xyz")
        );
        let cookies: Vec<_> = parse_netscape(&contenido).collect();
        assert_eq!(cookies.len(), 1);
        assert_eq!(cookies[0].domain, ".youtube.com");
        assert_eq!(cookies[0].name, "LOGIN_INFO");
    }

    #[test]
    fn parse_netscape_ignora_comentarios_y_lineas_vacias() {
        let contenido = format!(
            "# Netscape HTTP Cookie File\n\n# comentario\n{}\n",
            linea(".youtube.com", "0", "PREF", "v")
        );
        let cookies: Vec<_> = parse_netscape(&contenido).collect();
        assert_eq!(cookies.len(), 1);
    }

    #[test]
    fn parse_netscape_descarta_lineas_con_campos_insuficientes() {
        // 6 campos (falta value) y una línea separada por espacios, no tabs.
        let contenido =
            ".youtube.com\tTRUE\t/\tTRUE\t0\tSAPISID\n.youtube.com TRUE / TRUE 0 SAPISID abc";
        assert_eq!(parse_netscape(contenido).count(), 0);
    }

    #[test]
    fn parse_netscape_expiry_ilegible_se_trata_como_cookie_de_sesion() {
        let contenido = linea(".youtube.com", "no-numerico", "SSID", "v");
        let cookies: Vec<_> = parse_netscape(&contenido).collect();
        assert_eq!(cookies[0].expiry, 0);
    }

    // ---------- session_status (con cookies.txt real en un dir temporal) ----------

    /// Dir temporal único por test; se limpia al soltar el guard.
    struct TempDir(PathBuf);
    impl TempDir {
        fn new(tag: &str) -> Self {
            let dir =
                std::env::temp_dir().join(format!("stash-test-{}-{}", tag, std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn escribir_cookies(dir: &TempDir, contenido: &str) {
        std::fs::write(get_cookies_path(&dir.0), contenido).unwrap();
    }

    #[test]
    fn session_status_none_sin_archivo() {
        let dir = TempDir::new("none");
        assert_eq!(session_status(&dir.0), "none");
    }

    #[test]
    fn session_status_none_si_solo_hay_cookies_de_google() {
        let dir = TempDir::new("google");
        escribir_cookies(&dir, &linea(".google.com", "1900000000", "SAPISID", "v"));
        assert_eq!(session_status(&dir.0), "none");
    }

    #[test]
    fn session_status_connected_con_cookie_fuerte_vigente() {
        let dir = TempDir::new("connected");
        // expiry 0 = cookie de sesión: cuenta como vigente.
        let contenido = format!(
            "{}\n{}",
            linea(".youtube.com", "0", "LOGIN_INFO", "v"),
            linea(".youtube.com", "1900000000", "SAPISID", "v")
        );
        escribir_cookies(&dir, &contenido);
        assert_eq!(session_status(&dir.0), "connected");
    }

    #[test]
    fn session_status_expired_si_la_auth_vencio() {
        let dir = TempDir::new("expired");
        escribir_cookies(&dir, &linea(".youtube.com", "1000000", "SAPISID", "v"));
        assert_eq!(session_status(&dir.0), "expired");
    }

    #[test]
    fn session_status_expired_con_cookies_de_youtube_sin_auth() {
        let dir = TempDir::new("weak");
        escribir_cookies(&dir, &linea(".youtube.com", "0", "PREF", "v"));
        assert_eq!(session_status(&dir.0), "expired");
    }

    // ---------- sapisidhash ----------

    #[test]
    fn sapisidhash_tiene_formato_ts_guionbajo_sha1_hex() {
        let firma = sapisidhash("mi-sapisid", "https://www.youtube.com");
        let resto = firma
            .strip_prefix("SAPISIDHASH ")
            .expect("debe empezar con 'SAPISIDHASH '");
        let (ts, hex) = resto.split_once('_').expect("debe tener ts_hash");
        assert!(ts.parse::<u64>().is_ok(), "timestamp no numérico: {}", ts);
        assert_eq!(hex.len(), 40, "SHA1 hex debe tener 40 chars: {}", hex);
        assert!(hex
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }
}
