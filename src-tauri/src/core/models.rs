use serde::{Deserialize, Serialize};

/// Download progress emitted to the frontend (`download-progress` event).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressData {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub status: String,
    pub url: String,
    /// The frontend's run id (`<item>:<runSeq>`): two queue items may share a URL.
    #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
}
