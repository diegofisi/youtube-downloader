use serde::{Deserialize, Serialize};

/// Public info of the connected YouTube account (account_menu endpoint).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub name: String,
    pub handle: Option<String>,
    pub avatar_url: Option<String>,
}
