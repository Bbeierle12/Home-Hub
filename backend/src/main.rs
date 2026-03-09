mod auth;
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
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{config::AppConfig, error::ApiError, ws::broker::WsBroker};

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
    let db = db::connect(&config).await?;
    let redis = RedisClient::open(config.redis_url.clone())
        .map_err(|error| ApiError::config(format!("Invalid REDIS_URL: {error}")))?;

    let state = Arc::new(AppState {
        config: config.clone(),
        db,
        redis,
        ws_broker: WsBroker::default(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .nest("/auth", auth::router())
        .nest("/households", modules::router())
        .route("/ws", get(ws::handler::ws_handler))
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

async fn health() -> &'static str {
    "ok"
}
