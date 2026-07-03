use serde::{Deserialize, Serialize};

/// Download progress emitted to the frontend (`download-progress` event).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressData {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub status: String,
    pub url: String,
}
