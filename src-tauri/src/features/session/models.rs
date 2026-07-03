use serde::{Deserialize, Serialize};

/// Información pública de la cuenta de YouTube conectada (endpoint account_menu).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub name: String,
    pub handle: Option<String>,
    pub avatar_url: Option<String>,
}
