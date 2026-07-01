use serde::{Deserialize, Serialize};

/// Progreso de descarga emitido al frontend (evento `download-progress`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressData {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub status: String,
    pub url: String,
}
