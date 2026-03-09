use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::{config::AppConfig, error::ApiError};

pub async fn connect(config: &AppConfig) -> Result<PgPool, ApiError> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .map_err(ApiError::from)
}
