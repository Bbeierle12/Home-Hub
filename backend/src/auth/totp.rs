use rand::{distr::Alphanumeric, Rng};
use totp_rs::{Algorithm, Secret, TOTP};

use crate::{config::AppConfig, error::ApiError};

pub fn generate_secret() -> String {
    rand::rng()
        .sample_iter(Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

pub fn provisioning_uri(
    config: &AppConfig,
    account_name: &str,
    secret: &str,
) -> Result<String, ApiError> {
    let secret = Secret::Encoded(secret.to_owned());
    let bytes = secret
        .to_bytes()
        .map_err(|error| ApiError::internal(format!("Failed to decode TOTP secret: {error}")))?;

    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes, Some(config.totp_issuer.clone()), account_name.to_owned())
        .map_err(|error| ApiError::internal(format!("Failed to build TOTP configuration: {error}")))?;

    Ok(totp.get_url())
}

pub fn verify_code(secret: &str, code: &str) -> Result<bool, ApiError> {
    let secret = Secret::Encoded(secret.to_owned());
    let bytes = secret
        .to_bytes()
        .map_err(|error| ApiError::internal(format!("Failed to decode TOTP secret: {error}")))?;

    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes, None, "HouseholdDashboard".to_owned())
        .map_err(|error| ApiError::internal(format!("Failed to build TOTP configuration: {error}")))?;

    totp.check_current(code)
        .map_err(|error| ApiError::internal(format!("Failed to validate TOTP code: {error}")))
}
