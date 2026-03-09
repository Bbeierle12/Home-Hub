use std::{env, sync::Arc};

use chrono::Duration;

use crate::error::ApiError;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub app_host: String,
    pub app_port: u16,
    pub frontend_url: String,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_access_expiry_seconds: i64,
    pub jwt_refresh_expiry_seconds: i64,
    pub device_trust_ttl_seconds: usize,
    pub totp_issuer: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Arc<Self>, ApiError> {
        Ok(Arc::new(Self {
            app_host: read_env("APP_HOST", "0.0.0.0"),
            app_port: read_env("APP_PORT", "8080")
                .parse()
                .map_err(|_| ApiError::config("APP_PORT must be a valid u16"))?,
            frontend_url: read_env("FRONTEND_URL", "http://localhost:5173"),
            database_url: required_env("DATABASE_URL")?,
            redis_url: required_env("REDIS_URL")?,
            jwt_secret: required_env("JWT_SECRET")?,
            jwt_access_expiry_seconds: read_env("JWT_ACCESS_EXPIRY_SECONDS", "900")
                .parse()
                .map_err(|_| ApiError::config("JWT_ACCESS_EXPIRY_SECONDS must be an integer"))?,
            jwt_refresh_expiry_seconds: read_env("JWT_REFRESH_EXPIRY_SECONDS", "604800")
                .parse()
                .map_err(|_| ApiError::config("JWT_REFRESH_EXPIRY_SECONDS must be an integer"))?,
            device_trust_ttl_seconds: read_env("DEVICE_TRUST_TTL_SECONDS", "2592000")
                .parse()
                .map_err(|_| ApiError::config("DEVICE_TRUST_TTL_SECONDS must be an integer"))?,
            totp_issuer: read_env("TOTP_ISSUER", "HouseholdDashboard"),
        }))
    }

    pub fn access_expiry(&self) -> Duration {
        Duration::seconds(self.jwt_access_expiry_seconds)
    }

    pub fn refresh_expiry(&self) -> Duration {
        Duration::seconds(self.jwt_refresh_expiry_seconds)
    }
}

fn required_env(key: &str) -> Result<String, ApiError> {
    env::var(key).map_err(|_| ApiError::config(format!("Missing required environment variable `{key}`")))
}

fn read_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_owned())
}
