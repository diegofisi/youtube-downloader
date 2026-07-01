//! Utilidades del runner de yt-dlp. Por ahora, parseo de líneas de progreso.
//! (En fases posteriores albergará el runner completo con opciones.)

/// Extrae el porcentaje de una línea de progreso de yt-dlp.
pub fn parse_percent(s: &str) -> Option<f64> {
    let pos = s.find('%')?;
    let before = &s[..pos];
    let num_start = before.rfind(|c: char| !c.is_ascii_digit() && c != '.')? + 1;
    before[num_start..].parse::<f64>().ok()
}

/// Extrae un campo entre dos marcadores (`end_marker` vacío = hasta el final).
pub fn parse_field(s: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let start = s.find(start_marker)? + start_marker.len();
    if end_marker.is_empty() {
        Some(s[start..].trim().to_string())
    } else {
        let end = s[start..].find(end_marker).map(|i| start + i)?;
        Some(s[start..end].trim().to_string())
    }
}
