mod auth;
mod compat;
mod config;
mod db;
mod error;
mod modules;
mod types;
mod ws;

use std::sync::Arc;

use axum::{routing::get, Router};
use redis::Client as RedisClient;
use sqlx::PgPool;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{config::AppConfig, error::ApiError, ws::broker::WsBroker};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db: PgPool,
    pub redis: RedisClient,
    pub ws_broker: WsBroker,
}

#[tokio::main]
async fn main() -> Result<(), ApiError> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().json())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = AppConfig::from_env()?;
    tracing::info!(db_backend = ?config.db_backend, "Database backend mode");

    let db = db::connect(&config).await?;
    let redis = RedisClient::open(config.redis_url.clone())
        .map_err(|error| ApiError::config(format!("Invalid REDIS_URL: {error}")))?;

    bootstrap_superadmin(&db).await?;

    tokio::fs::create_dir_all(&config.upload_dir)
        .await
        .map_err(|e| ApiError::config(format!("Cannot create upload dir: {e}")))?;

    let state = Arc::new(AppState {
        config: config.clone(),
        db,
        redis,
        ws_broker: WsBroker::default(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .nest("/auth", auth::router())
        .nest("/households", modules::router(config.db_backend))
        .route("/ws", get(ws::handler::ws_handler))
        .nest_service("/uploads", ServeDir::new(&config.upload_dir))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

    let address = format!("{}:{}", config.app_host, config.app_port);
    let listener = tokio::net::TcpListener::bind(&address)
        .await
        .map_err(|error| ApiError::internal(format!("Failed to bind {address}: {error}")))?;

    tracing::info!(address, "Household dashboard backend listening");
    axum::serve(listener, app)
        .await
        .map_err(|error| ApiError::internal(format!("Server failed: {error}")))
}

async fn health(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok",
        "db_backend": if state.config.db_backend.is_rustdb() { "rustdb" } else { "postgres" },
    }))
}

async fn bootstrap_superadmin(db: &sqlx::PgPool) -> Result<(), ApiError> {
    let email = match env::var("SUPERADMIN_EMAIL") {
        Ok(v) if !v.is_empty() => v.trim().to_lowercase(),
        _ => return Ok(()),
    };
    let password = env::var("SUPERADMIN_PASSWORD")
        .map_err(|_| ApiError::config("SUPERADMIN_EMAIL is set but SUPERADMIN_PASSWORD is missing"))?;
    if password.len() < 12 {
        return Err(ApiError::config("SUPERADMIN_PASSWORD must be at least 12 characters"));
    }

    let existing = sqlx::query_scalar::<_, uuid::Uuid>("SELECT id FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(db)
        .await?;

    if let Some(id) = existing {
        sqlx::query("UPDATE users SET is_superadmin = TRUE WHERE id = $1")
            .bind(id)
            .execute(db)
            .await?;
        tracing::info!(email, "Superadmin flag ensured on existing user");
    } else {
        use argon2::{password_hash::{rand_core::OsRng, SaltString}, Argon2, PasswordHasher};
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| ApiError::internal(format!("Password hashing failed: {e}")))?
            .to_string();

        let now = crate::compat::now_utc();
        sqlx::query(
            r#"
            INSERT INTO users (id, email, password_hash, display_name, totp_enabled, is_superadmin, created_at, updated_at)
            VALUES ($1, $2, $3, $4, FALSE, TRUE, $5, $6)
            "#,
        )
        .bind(crate::compat::new_id())
        .bind(&email)
        .bind(password_hash)
        .bind("Super Admin")
        .bind(now)
        .bind(now)
        .execute(db)
        .await?;
        tracing::info!(email, "Superadmin account created");
    }

    Ok(())
}

