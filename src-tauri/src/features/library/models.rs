use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub id: String,
    pub url: String,
    pub title: String,
    pub format: String,
    pub folder: String,
    /// Unix timestamp en segundos.
    pub date: u64,
}
