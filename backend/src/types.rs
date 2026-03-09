use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HouseholdRole {
    Admin,
    Member,
    Child,
    Guest,
}

impl HouseholdRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Member => "member",
            Self::Child => "child",
            Self::Guest => "guest",
        }
    }
}

impl TryFrom<&str> for HouseholdRole {
    type Error = &'static str;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "admin" => Ok(Self::Admin),
            "member" => Ok(Self::Member),
            "child" => Ok(Self::Child),
            "guest" => Ok(Self::Guest),
            _ => Err("unsupported household role"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBundle {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in_seconds: i64,
}
