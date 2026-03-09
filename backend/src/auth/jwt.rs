use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{config::AppConfig, error::ApiError, types::HouseholdRole};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub household_id: Option<Uuid>,
    pub role: Option<HouseholdRole>,
    pub exp: usize,
    pub token_kind: TokenKind,
    pub jti: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TokenKind {
    Access,
    Refresh,
    TwoFactorPending,
}

pub fn encode_access_token(
    config: &AppConfig,
    user_id: Uuid,
    household_id: Option<Uuid>,
    role: Option<HouseholdRole>,
) -> Result<String, ApiError> {
    encode(
        &config.jwt_secret,
        Claims {
            sub: user_id,
            household_id,
            role,
            exp: (Utc::now() + config.access_expiry()).timestamp() as usize,
            token_kind: TokenKind::Access,
            jti: None,
        },
    )
}

pub fn encode_refresh_token(
    config: &AppConfig,
    user_id: Uuid,
    household_id: Option<Uuid>,
    role: Option<HouseholdRole>,
    session_id: String,
) -> Result<String, ApiError> {
    encode(
        &config.jwt_secret,
        Claims {
            sub: user_id,
            household_id,
            role,
            exp: (Utc::now() + config.refresh_expiry()).timestamp() as usize,
            token_kind: TokenKind::Refresh,
            jti: Some(session_id),
        },
    )
}

pub fn encode_two_factor_token(
    config: &AppConfig,
    user_id: Uuid,
    household_id: Option<Uuid>,
    role: Option<HouseholdRole>,
) -> Result<String, ApiError> {
    encode(
        &config.jwt_secret,
        Claims {
            sub: user_id,
            household_id,
            role,
            exp: (Utc::now() + chrono::Duration::minutes(10)).timestamp() as usize,
            token_kind: TokenKind::TwoFactorPending,
            jti: None,
        },
    )
}

pub fn decode_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    let token = jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token.claims)
}

fn encode(secret: &str, claims: Claims) -> Result<String, ApiError> {
    jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(ApiError::from)
}
